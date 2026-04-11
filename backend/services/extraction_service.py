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
from backend.prompts.extraction_prompt import EXTRACTION_PROMPT
from backend.schemas.extraction import ExtractionResult, WorkItemExtracted

logger = logging.getLogger(__name__)

PARSE_VERSION = "1.0"


def build_extraction_chain(model: str | None = None):
    """
    Builds and returns the LangChain extraction chain.
    Chain: prompt | llm | OutputFixingParser(PydanticOutputParser)
    """
    llm = get_llm(model)
    base_parser = PydanticOutputParser(pydantic_object=ExtractionResult)
    fixing_parser = OutputFixingParser.from_llm(parser=base_parser, llm=llm)

    chain = EXTRACTION_PROMPT | llm | fixing_parser
    return chain, llm


def run_extraction(
    raw_message: str,
    work_date: date | None = None,
    model: str | None = None,
) -> tuple[ExtractionResult | None, str, str]:
    """
    Run extraction chain on a raw message.

    Returns:
        (result, extraction_status, model_name)
        - result is None if extraction failed after retries
        - extraction_status: "success" | "failed" | "needs_review"
        - model_name: the LLM model used
    """
    today = work_date or date.today()
    model_name = model or settings.LLM_MODEL

    logger.info("Starting extraction | model=%s | message_len=%d", model_name, len(raw_message))

    try:
        chain, llm = build_extraction_chain(model_name)
        result: ExtractionResult = chain.invoke({
            "today": today.isoformat(),
            "raw_message": raw_message,
        })

        # Override work_date if caller specified one explicitly
        if work_date:
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
