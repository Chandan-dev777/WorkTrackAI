"""
User templates router.

GET    /templates/        — list own templates (newest first)
POST   /templates/        — create a new template
PUT    /templates/{id}    — edit label and/or text
DELETE /templates/{id}    — delete permanently
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models.user import User
from backend.models.user_template import UserTemplate
from backend.routers.auth import get_current_user
from backend.schemas.user_template import (
    UserTemplateCreate,
    UserTemplateResponse,
    UserTemplateUpdate,
)

router = APIRouter(prefix="/templates", tags=["templates"])


@router.get("/", response_model=list[UserTemplateResponse])
def list_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[UserTemplateResponse]:
    templates = (
        db.query(UserTemplate)
        .filter(UserTemplate.user_id == current_user.id)
        .order_by(UserTemplate.created_at.desc())
        .all()
    )
    return [UserTemplateResponse.model_validate(t) for t in templates]


@router.post("/", response_model=UserTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: UserTemplateCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserTemplateResponse:
    template = UserTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        label=payload.label,
        text=payload.text,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return UserTemplateResponse.model_validate(template)


@router.put("/{template_id}", response_model=UserTemplateResponse)
def update_template(
    template_id: str,
    payload: UserTemplateUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserTemplateResponse:
    template = db.query(UserTemplate).filter(
        UserTemplate.id == template_id,
        UserTemplate.user_id == current_user.id,
    ).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    if payload.label is not None:
        template.label = payload.label.strip()
    if payload.text is not None:
        template.text = payload.text

    db.commit()
    db.refresh(template)
    return UserTemplateResponse.model_validate(template)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    template = db.query(UserTemplate).filter(
        UserTemplate.id == template_id,
        UserTemplate.user_id == current_user.id,
    ).first()
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    db.delete(template)
    db.commit()
