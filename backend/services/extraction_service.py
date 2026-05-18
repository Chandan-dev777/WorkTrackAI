"""
LLM extraction service.

Takes a raw natural-language work update and returns an ExtractionResult
using a LangChain chain with PydanticOutputParser + OutputFixingParser.
"""

import logging
from datetime import date, datetime, timezone

from langchain_classic.output_parsers import OutputFixingParser
from langchain_core.output_parsers import PydanticOutputParser

from backend.config import get_llm, settings
from backend.prompts.extraction_prompt import EXTRACTION_PROMPT, EXTRACTION_PROMPT_WITH_CONTEXT
from backend.schemas.extraction import ExtractionResult, WorkItemExtracted

logger = logging.getLogger(__name__)

PARSE_VERSION = "1.0"


def build_extraction_chain(
    model: str | None = None,
    fixing_model: str | None = None,
    with_context: bool = False,
):
    """
    Builds and returns the LangChain extraction chain.
    Chain: prompt | llm | OutputFixingParser(PydanticOutputParser)

    Uses two separate models:
    - llm: primary extraction model (default: LLM_MODEL_EXTRACTION — Sonnet for accuracy)
    - fixing_llm: OutputFixingParser retry model (default: LLM_MODEL_FIXING — Haiku for speed)

    with_context=True uses the prompt variant that includes active tasks for continuation detection.
    """
    llm = get_llm(model or settings.LLM_MODEL_EXTRACTION)
    fixing_llm = get_llm(fixing_model or settings.LLM_MODEL_FIXING)
    base_parser = PydanticOutputParser(pydantic_object=ExtractionResult)
    fixing_parser = OutputFixingParser.from_llm(parser=base_parser, llm=fixing_llm)

    prompt = EXTRACTION_PROMPT_WITH_CONTEXT if with_context else EXTRACTION_PROMPT
    chain = prompt | llm | fixing_parser
    return chain, llm


def run_extraction(
    raw_message: str,
    work_date: date | None = None,
    model: str | None = None,
    open_tasks: list | None = None,
) -> tuple[ExtractionResult | None, str, str]:
    """
    Run extraction chain on a raw message.

    Returns:
        (result, extraction_status, model_name)
        - result is None if extraction failed after retries
        - extraction_status: "success" | "failed" | "needs_review"
        - model_name: the LLM model used
    """
    import json as _json

    today = work_date or date.today()
    model_name = model or settings.LLM_MODEL_EXTRACTION

    logger.info("Starting extraction | model=%s | message_len=%d | open_tasks=%d",
                model_name, len(raw_message), len(open_tasks) if open_tasks else 0)

    try:
        use_context = bool(open_tasks)
        chain, llm = build_extraction_chain(model=model_name, with_context=use_context)

        invoke_kwargs: dict = {"today": today.isoformat(), "raw_message": raw_message}
        if use_context:
            compact = [
                {
                    "id": t.id,
                    "task_description": t.task_description,
                    "project_name": t.project_name or "",
                    "ticket_id": t.ticket_id or "",
                    "status": t.status or "",
                    "work_date": t.work_date.isoformat(),
                }
                for t in open_tasks
            ]
            invoke_kwargs["active_tasks_json"] = _json.dumps(compact, ensure_ascii=False)

        result: ExtractionResult = chain.invoke(invoke_kwargs)

        # Only override work_date if caller passed a date different from today
        # (explicit user selection). If it's today's date, trust the LLM's
        # resolution of relative phrases like "yesterday" or "last Monday".
        if work_date and work_date != date.today():
            result = result.model_copy(update={"work_date": work_date})

        # Compute total_hours_warning
        total_hours = sum(
            item.hours_spent for item in result.items if item.hours_spent is not None
        )
        if total_hours > 12:
            result = result.model_copy(update={"total_hours_warning": True})

        has_clarification = any(item.clarification_needed for item in result.items)
        status = "needs_review" if has_clarification else "success"

        logger.info(
            "Extraction complete | status=%s | items=%d | total_hours=%.1f | warning=%s",
            status, len(result.items), total_hours, result.total_hours_warning,
        )
        return result, status, model_name

    except Exception as exc:
        logger.error("Extraction failed after retries: %s", exc)
        return None, "failed", model_name


def fallback_extraction(raw_message: str, work_date: date) -> ExtractionResult:
    """
    Best-effort extraction when the LLM is unavailable (no API key, network error, etc.).

    Preserves the raw message as the task description so no data is lost.
    All fields are flagged for manual completion in the UI preview step.
    Data models and the confirm flow are unchanged — the user simply fills
    in category/hours/status manually before confirming.
    """
    logger.warning("Using fallback extraction — LLM unavailable. User will complete fields manually.")
    return ExtractionResult(
        work_date=work_date,
        items=[
            WorkItemExtracted(
                task_description=raw_message.strip()[:1000],
                work_category="other",
                hours_spent=None,
                status=None,
                confidence_score=0.0,
                clarification_needed=True,
                clarification_reason=(
                    "AI extraction is currently unavailable. "
                    "Please select the correct category, hours spent, and status below."
                ),
            )
        ],
    )
