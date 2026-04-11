"""
Updates router.

POST /updates/submit  — run extraction, return preview (nothing persisted yet)
PUT  /updates/{id}/confirm — persist confirmed items to SQLite + ChromaDB
GET  /updates/        — list own work logs (paginated)
GET  /updates/{id}    — get a specific work log + items
PUT  /updates/{id}    — re-submit / replace a work log
DELETE /updates/{id}  — soft-delete a work log
"""

import logging
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from backend.database import get_db
from backend.models.user import User
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.routers.auth import get_current_user
from backend.schemas.work_log import (
    ConfirmUpdateRequest,
    SubmitUpdateRequest,
    SubmitUpdateResponse,
    WorkLogResponse,
)
from backend.services.chroma_service import delete_work_log, upsert_work_items
from backend.services.extraction_service import PARSE_VERSION, fallback_extraction, run_extraction

router = APIRouter(prefix="/updates", tags=["updates"])


@router.post("/submit", response_model=SubmitUpdateResponse, status_code=status.HTTP_200_OK)
def submit_update(
    payload: SubmitUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmitUpdateResponse:
    """
    Run LLM extraction on the raw message.
    Creates a WorkLog with status=pending (not yet confirmed).
    Returns the extraction preview for the user to review and edit.
    """
    work_date = payload.work_date or date.today()

    # Create a pending WorkLog to hold the raw message
    work_log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        work_date=work_date,
        raw_message=payload.raw_message,
        extraction_status="pending",
    )
    db.add(work_log)
    db.commit()
    db.refresh(work_log)

    # Run extraction
    result, extraction_status, model_name = run_extraction(
        raw_message=payload.raw_message,
        work_date=work_date,
    )

    if result is None:
        # LLM unavailable — fall back to manual entry rather than blocking the user.
        # Raw message is preserved; user completes fields in the preview step.
        result = fallback_extraction(payload.raw_message, work_date)
        extraction_status = "needs_review"

    # Update WorkLog with final extraction outcome (single commit)
    work_log.extraction_status = extraction_status
    work_log.model_name = model_name
    work_log.parse_version = PARSE_VERSION
    db.commit()

    return SubmitUpdateResponse(
        work_log_id=work_log.id,
        work_date=result.work_date,
        extraction_status=extraction_status,
        items=result.items,
        total_hours_warning=result.total_hours_warning,
        has_clarification_needed=any(i.clarification_needed for i in result.items),
    )


@router.put("/{work_log_id}/confirm", response_model=WorkLogResponse)
def confirm_update(
    work_log_id: str,
    payload: ConfirmUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkLogResponse:
    """
    Persist confirmed (and possibly user-edited) work items.
    Writes to SQLite first, then upserts into ChromaDB.
    """
    work_log = db.query(WorkLog).options(selectinload(WorkLog.work_items)).filter(
        WorkLog.id == work_log_id,
        WorkLog.user_id == current_user.id,
        WorkLog.is_deleted == False,  # noqa: E712
    ).first()

    if work_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work log not found")

    if work_log.extraction_status == "success" and work_log.work_items:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This work log has already been confirmed",
        )

    # Delete any previously created (un-confirmed) work items for this log
    db.query(WorkItem).filter(WorkItem.work_log_id == work_log_id).delete()

    # Persist work items
    orm_items = []
    for extracted in payload.items:
        item = WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=work_log_id,
            employee_id=current_user.employee_id,
            work_date=payload.work_date,
            task_description=extracted.task_description,
            work_category=extracted.work_category,
            hours_spent=extracted.hours_spent,
            status=extracted.status,
            priority=extracted.priority,
            blockers=extracted.blockers,
            next_steps=extracted.next_steps,
            tags=extracted.tags,
            links=extracted.links,
            project_name=extracted.project_name,
            ticket_id=extracted.ticket_id,
            confidence_score=extracted.confidence_score,
            needs_review=extracted.clarification_needed,
            clarification_needed=extracted.clarification_needed,
            clarification_reason=extracted.clarification_reason,
            is_user_corrected=False,
        )
        db.add(item)
        orm_items.append(item)

    work_log.extraction_status = "success"
    db.commit()

    # Re-fetch with eager-loaded work_items to avoid lazy-load issues
    work_log = db.query(WorkLog).options(selectinload(WorkLog.work_items)).filter(
        WorkLog.id == work_log_id
    ).first()

    # Upsert into ChromaDB (SQLite is already committed = source of truth first)
    try:
        upsert_work_items(orm_items, current_user.id)
    except Exception as exc:
        # ChromaDB failure is non-fatal — log and continue
        logging.getLogger(__name__).error("ChromaDB upsert failed: %s", exc)

    return WorkLogResponse.model_validate(work_log)


@router.get("/", response_model=list[WorkLogResponse])
def list_updates(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkLogResponse]:
    logs = (
        db.query(WorkLog)
        .options(selectinload(WorkLog.work_items))
        .filter(WorkLog.user_id == current_user.id, WorkLog.is_deleted == False)  # noqa: E712
        .order_by(WorkLog.work_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [WorkLogResponse.model_validate(log) for log in logs]


@router.get("/{work_log_id}", response_model=WorkLogResponse)
def get_update(
    work_log_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkLogResponse:
    log = db.query(WorkLog).options(selectinload(WorkLog.work_items)).filter(
        WorkLog.id == work_log_id,
        WorkLog.user_id == current_user.id,
        WorkLog.is_deleted == False,  # noqa: E712
    ).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Work log not found")
    return WorkLogResponse.model_validate(log)


@router.put("/{work_log_id}", response_model=SubmitUpdateResponse)
def resubmit_update(
    work_log_id: str,
    payload: SubmitUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmitUpdateResponse:
    """
    Re-submit an existing work log with new text.
    Soft-deletes the old log (raw_message preserved) and creates a fresh one.
    Returns a new work_log_id and extraction preview for the user to confirm.
    """
    old_log = db.query(WorkLog).filter(
        WorkLog.id == work_log_id,
        WorkLog.user_id == current_user.id,
        WorkLog.is_deleted == False,  # noqa: E712
    ).first()

    if old_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Work log not found")

    work_date = payload.work_date or old_log.work_date

    # Soft-delete the old log (raw_message stays immutable on the old record)
    old_log.is_deleted = True
    db.commit()

    # Remove old items from ChromaDB if it was confirmed
    try:
        delete_work_log(work_log_id)
    except Exception as exc:
        logging.getLogger(__name__).error("ChromaDB delete on resubmit failed: %s", exc)

    # Create a new pending WorkLog
    new_log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        work_date=work_date,
        raw_message=payload.raw_message,
        extraction_status="pending",
    )
    db.add(new_log)
    db.commit()
    db.refresh(new_log)

    # Run extraction
    result, extraction_status, model_name = run_extraction(
        raw_message=payload.raw_message,
        work_date=work_date,
    )

    if result is None:
        result = fallback_extraction(payload.raw_message, work_date)
        extraction_status = "needs_review"

    new_log.extraction_status = extraction_status
    new_log.model_name = model_name
    new_log.parse_version = PARSE_VERSION
    db.commit()

    return SubmitUpdateResponse(
        work_log_id=new_log.id,
        work_date=result.work_date,
        extraction_status=extraction_status,
        items=result.items,
        total_hours_warning=result.total_hours_warning,
        has_clarification_needed=any(i.clarification_needed for i in result.items),
    )


@router.delete("/{work_log_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_update(
    work_log_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    log = db.query(WorkLog).filter(
        WorkLog.id == work_log_id,
        WorkLog.user_id == current_user.id,
        WorkLog.is_deleted == False,  # noqa: E712
    ).first()
    if log is None:
        raise HTTPException(status_code=404, detail="Work log not found")

    log.is_deleted = True
    db.commit()

    try:
        delete_work_log(work_log_id)
    except Exception as exc:
        logging.getLogger(__name__).error("ChromaDB delete failed: %s", exc)
