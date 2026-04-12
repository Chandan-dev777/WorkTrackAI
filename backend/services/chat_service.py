"""
LangGraph RAG chat agent.

Three tools:
  date_resolver  — converts relative date expressions to {start_date, end_date}
  sql_query      — aggregation queries against SQLite via dashboard_service
  vector_search  — semantic search over ChromaDB work items

Access control:
  - employee: both tools filter by user_id; cannot see others' data
  - manager / admin: can query across all users or filter by employee_id
"""

import json
import logging
import re
import uuid
from datetime import date, timedelta
from typing import Optional

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.prebuilt import create_react_agent
from sqlalchemy.orm import Session

from backend.config import get_llm, settings
from backend.models.chat_history import ChatHistory
from backend.schemas.chat import SourceReference
from backend.services.chroma_service import search_work_items
from backend.models.user import User
from backend.services.dashboard_service import (
    get_daily_trend,
    get_hours_by_category,
    get_hours_summary,
    get_status_distribution,
    get_team_summary,
)

logger = logging.getLogger(__name__)


# ── date_resolver: pure Python, no LLM call ──────────────────────────────────

def _resolve_date_expression(expr: str, today: date) -> dict[str, str]:
    """
    Convert a natural-language date expression to a {start_date, end_date} dict.
    Returns ISO-formatted date strings.
    """
    expr = expr.strip().lower()

    if expr == "today":
        return {"start_date": today.isoformat(), "end_date": today.isoformat()}

    if expr == "yesterday":
        d = today - timedelta(days=1)
        return {"start_date": d.isoformat(), "end_date": d.isoformat()}

    if expr in ("this week", "current week"):
        start = today - timedelta(days=today.weekday())
        return {"start_date": start.isoformat(), "end_date": today.isoformat()}

    if expr == "last week":
        end = today - timedelta(days=today.weekday() + 1)   # last Sunday
        start = end - timedelta(days=6)                      # last Monday
        return {"start_date": start.isoformat(), "end_date": end.isoformat()}

    if expr in ("this month", "current month"):
        start = today.replace(day=1)
        return {"start_date": start.isoformat(), "end_date": today.isoformat()}

    if expr == "last month":
        first_this = today.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        first_prev = last_prev.replace(day=1)
        return {"start_date": first_prev.isoformat(), "end_date": last_prev.isoformat()}

    # "last N days" / "past N days"
    m = re.match(r"(?:last|past)\s+(\d+)\s+days?", expr)
    if m:
        n = int(m.group(1))
        return {"start_date": (today - timedelta(days=n - 1)).isoformat(), "end_date": today.isoformat()}

    # "last N weeks"
    m = re.match(r"(?:last|past)\s+(\d+)\s+weeks?", expr)
    if m:
        n = int(m.group(1))
        return {"start_date": (today - timedelta(weeks=n)).isoformat(), "end_date": today.isoformat()}

    # "last N months" (approximate)
    m = re.match(r"(?:last|past)\s+(\d+)\s+months?", expr)
    if m:
        n = int(m.group(1))
        return {"start_date": (today - timedelta(days=n * 30)).isoformat(), "end_date": today.isoformat()}

    # Fallback: current week
    logger.warning("date_resolver: unrecognised expression %r — defaulting to this week", expr)
    start = today - timedelta(days=today.weekday())
    return {"start_date": start.isoformat(), "end_date": today.isoformat()}


# ── Tool factories (closures capture user context + DB session) ───────────────

def make_tools(user_id: str, user_role: str, db: Session, user_team_name: Optional[str] = None) -> list:
    today = date.today()

    @tool
    def date_resolver(expression: str) -> str:
        """Convert a natural language date expression to a start/end date range.

        Use this tool first for any query that mentions relative dates such as
        'last week', 'yesterday', 'this month', 'last 30 days'.

        Args:
            expression: A natural language date expression.

        Returns:
            JSON string with start_date and end_date in YYYY-MM-DD format.
        """
        result = _resolve_date_expression(expression, today)
        return json.dumps(result)

    @tool
    def sql_query(
        metric: str,
        start_date: str,
        end_date: str,
        category: Optional[str] = None,
        status: Optional[str] = None,
        target_employee_id: Optional[str] = None,
        team_name: Optional[str] = None,
    ) -> str:
        """Query structured work data from the database.

        Use this for counts, sums, breakdowns, AND to fetch actual task details.

        Args:
            metric: One of:
                list_items        — fetch actual task records with descriptions (use when
                                    the user asks to see a task, wants details, or asks
                                    "what task?", "show me that", "describe it").
                total_hours_summary — total hours, done/blocked/in_progress counts.
                hours_by_category   — hours grouped by work category.
                status_distribution — count of items per status.
                daily_trend         — hours per day over the date range.
                team_summary        — per-employee summary (manager only).
            start_date: Start date in YYYY-MM-DD format.
            end_date: End date in YYYY-MM-DD format.
            category: Optional — filter by work category (e.g. "ticket", "meeting").
            status: Optional — filter by item status (e.g. "done", "blocked").
            target_employee_id: Optional — manager only, filter to one employee.
                       Pass the employee_id from team_summary (e.g. "EMP-CB-001").
            team_name: Optional — manager only, filter team_summary to a specific team name.
                       When the user says "my team", pass the manager's own team name here.

        Returns:
            JSON string with the query results.
        """
        try:
            s = date.fromisoformat(start_date)
            e = date.fromisoformat(end_date)
        except ValueError:
            return json.dumps({"error": f"Invalid dates: {start_date}, {end_date}"})

        # For manager queries: resolve target_employee_id (e.g. "EMP-CB-001") to the
        # internal user UUID that WorkLog.user_id references.
        query_uid = user_id
        if target_employee_id and user_role in ("manager", "admin"):
            target_user = (
                db.query(User)
                .filter(
                    (User.employee_id == target_employee_id) | (User.id == target_employee_id)
                )
                .first()
            )
            if target_user:
                query_uid = target_user.id
            else:
                return json.dumps({"error": f"Employee not found: {target_employee_id}"})

        try:
            if metric == "list_items":
                from backend.models.work_item import WorkItem
                from backend.models.work_log import WorkLog
                q = (
                    db.query(WorkItem)
                    .join(WorkLog, WorkItem.work_log_id == WorkLog.id)
                    .filter(
                        WorkLog.user_id == query_uid,
                        WorkLog.is_deleted == False,  # noqa: E712
                        WorkItem.work_date >= s,
                        WorkItem.work_date <= e,
                    )
                )
                if category:
                    q = q.filter(WorkItem.work_category == category)
                if status:
                    q = q.filter(WorkItem.status == status)
                items = q.order_by(WorkItem.work_date.desc()).limit(20).all()
                return json.dumps([
                    {
                        "id": i.id,
                        "work_date": i.work_date.isoformat(),
                        "task_description": i.task_description,
                        "work_category": i.work_category,
                        "hours_spent": i.hours_spent,
                        "status": i.status,
                        "priority": i.priority,
                        "project_name": i.project_name,
                        "ticket_id": i.ticket_id,
                        "blockers": i.blockers,
                        "next_steps": i.next_steps,
                    }
                    for i in items
                ])

            if metric == "total_hours_summary":
                data = get_hours_summary(db, query_uid, s, e)
                return data.model_dump_json()

            if metric == "hours_by_category":
                rows = get_hours_by_category(db, query_uid, s, e)
                return json.dumps([r.model_dump() for r in rows])

            if metric == "status_distribution":
                rows = get_status_distribution(db, query_uid, s, e)
                return json.dumps([r.model_dump() for r in rows])

            if metric == "daily_trend":
                rows = get_daily_trend(db, query_uid, s, e)
                return json.dumps([
                    {"date": r.date.isoformat(), "hours": r.hours, "item_count": r.item_count}
                    for r in rows
                ])

            if metric == "team_summary" and user_role in ("manager", "admin"):
                rows = get_team_summary(db, s, e, team_name=team_name)
                return json.dumps([r.model_dump(mode="json") for r in rows])

            return json.dumps({"error": f"Unknown metric: {metric}"})

        except Exception as exc:
            logger.error("sql_query tool error: %s", exc)
            return json.dumps({"error": str(exc)})

    @tool
    def vector_search(
        query: str,
        n_results: int = 5,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> str:
        """Search work entries by semantic similarity.

        Use this for open-ended recall: 'what was I working on related to X',
        'find tasks involving the API', 'show me blocked items about deployment'.

        Args:
            query: Natural language description of what to search for.
            n_results: Number of results to return (default 5, max 20).
            start_date: Optional date filter (YYYY-MM-DD).
            end_date: Optional date filter (YYYY-MM-DD).

        Returns:
            JSON array of matching work items with metadata.
        """
        # Employees are always scoped to their own data
        search_uid = user_id if user_role == "employee" else None

        # ChromaDB $gte/$lte require numeric values — use work_date_num (YYYYMMDD int).
        # Multiple conditions on the same field require $and.
        where_clauses = []
        if start_date:
            where_clauses.append({"work_date_num": {"$gte": int(start_date.replace("-", ""))}})
        if end_date:
            where_clauses.append({"work_date_num": {"$lte": int(end_date.replace("-", ""))}})

        if not where_clauses:
            where_filter = None
        elif len(where_clauses) == 1:
            where_filter = where_clauses[0]
        else:
            where_filter = {"$and": where_clauses}

        try:
            results = search_work_items(
                query=query,
                user_id=search_uid,
                n_results=min(int(n_results), 20),
                where=where_filter,
            )
            # Shape for LLM consumption
            output = [
                {
                    "id": r["id"],
                    "document": r["document"],
                    "work_date": r["metadata"].get("work_date"),
                    "category": r["metadata"].get("work_category"),
                    "status": r["metadata"].get("status"),
                    "hours": r["metadata"].get("hours_spent"),
                    "employee_id": r["metadata"].get("employee_id"),
                    "project": r["metadata"].get("project_name"),
                    "ticket": r["metadata"].get("ticket_id"),
                    "similarity": round(1 - r["distance"], 3),
                }
                for r in results
            ]
            return json.dumps(output)
        except Exception as exc:
            logger.error("vector_search tool error: %s", exc)
            return json.dumps([])

    return [date_resolver, sql_query, vector_search]


# ── System prompt ─────────────────────────────────────────────────────────────

def _build_system_prompt(
    user_id: str,
    user_role: str,
    today: date,
    user_team_name: Optional[str] = None,
) -> str:
    if user_role == "employee":
        role_context = "You can only see your own work data."
    elif user_team_name:
        role_context = (
            f"You are a manager of the '{user_team_name}' team. "
            f"When the user asks about 'my team', use team_name='{user_team_name}' in sql_query. "
            "You can also omit team_name to query across all teams, or use target_employee_id to focus on one person."
        )
    else:
        role_context = (
            "As a manager/admin, you can query data for all team members using the "
            "team_summary metric or target_employee_id."
        )

    team_line = f"- Team: {user_team_name}" if user_team_name else ""

    return f"""You are WorkTrack AI, a helpful assistant that answers questions about work logs and progress tracking.

User context:
- User ID: {user_id}
- Role: {user_role}
{team_line + chr(10) if team_line else ""}- Today: {today.isoformat()}
- {role_context}

You have three tools:
1. date_resolver — Use FIRST for any query involving relative dates ("last week", "yesterday", "this month").
2. sql_query — Use for counts, totals, breakdowns. Metrics: total_hours_summary, hours_by_category, status_distribution, daily_trend, team_summary.
3. vector_search — Use for open-ended recall ("what was I working on", "find tasks about X").

Guidelines:
- Always resolve relative dates with date_resolver before calling other tools.
- For "how many hours" or "how many tasks" → use sql_query with total_hours_summary.
- For "show me the task", "what task?", "task details", "describe it", "what did I work on" → use sql_query with metric=list_items. This retrieves actual task descriptions from the database. Prefer this over vector_search when the user simply wants to see their tasks.
- For vague follow-ups in a conversation (e.g. "ticket", "description", "that task"), use the date range from the prior turn and call sql_query with metric=list_items immediately — do not ask for clarification.
- For semantic recall ("find tasks about X", "anything related to deployment") → use vector_search.
- For complex questions, combine both sql_query and vector_search.
- Cite specific dates and task descriptions when possible.
- If no data found for a requested date range, try a broader range (e.g. this week or last 30 days) and tell the user what range you searched instead.
- Keep answers concise and factual."""


# ── Main entry point ──────────────────────────────────────────────────────────

def run_chat_query(
    question: str,
    user_id: str,
    user_role: str,
    db: Session,
    session_id: Optional[str] = None,
    model: Optional[str] = None,
    team_name: Optional[str] = None,
) -> tuple[str, str, list[SourceReference], str]:
    """
    Run the chat agent on a question.

    Returns:
        (answer, query_source, sources, session_id)
        - answer: agent's synthesised text response
        - query_source: "sql" | "vector" | "hybrid"
        - sources: work items referenced from vector_search results
        - session_id: the session ID used (new UUID if none was provided)
    """
    if not session_id:
        session_id = str(uuid.uuid4())

    today = date.today()
    tools = make_tools(user_id, user_role, db, user_team_name=team_name)
    llm = get_llm(model or settings.LLM_MODEL_CHAT)
    agent = create_react_agent(llm, tools)

    system_prompt = _build_system_prompt(user_id, user_role, today, user_team_name=team_name)

    # Load recent session history so the agent has conversation context (last 10 turns)
    recent_history = get_chat_history(db, user_id, session_id=session_id, limit=10)
    history_messages = []
    for turn in reversed(recent_history):  # chronological order (oldest first)
        history_messages.append(HumanMessage(content=turn.question))
        history_messages.append(AIMessage(content=turn.answer))

    try:
        result = agent.invoke({
            "messages": [
                SystemMessage(content=system_prompt),
                *history_messages,
                HumanMessage(content=question),
            ]
        })
    except Exception as exc:
        logger.error("Chat agent failed: %s", exc)
        answer = "I'm sorry, I couldn't process your question due to a technical issue. Please try again."
        _save_history(db, user_id, session_id, question, answer, "sql")
        return answer, "sql", [], session_id

    # Extract final answer (last AIMessage)
    answer = result["messages"][-1].content
    if not isinstance(answer, str):
        answer = str(answer)

    # Detect which tools were called
    tool_messages = [m for m in result["messages"] if isinstance(m, ToolMessage)]
    tool_names_used = {m.name for m in tool_messages if m.name}

    data_tools = tool_names_used - {"date_resolver"}
    if "sql_query" in data_tools and "vector_search" in data_tools:
        query_source = "hybrid"
    elif "vector_search" in data_tools:
        query_source = "vector"
    else:
        query_source = "sql"

    # Extract source references from vector_search tool results
    sources: list[SourceReference] = []
    for m in tool_messages:
        if m.name == "vector_search":
            try:
                items = json.loads(m.content)
                for item in items[:5]:
                    sources.append(SourceReference(
                        work_item_id=item.get("id", ""),
                        work_date=item.get("work_date", ""),
                        task_description=item.get("document", "")[:200],
                        work_category=item.get("category", ""),
                        employee_id=item.get("employee_id", ""),
                    ))
            except (json.JSONDecodeError, KeyError):
                pass

    _save_history(db, user_id, session_id, question, answer, query_source)

    logger.info(
        "Chat query completed | source=%s | tools=%s | session=%s",
        query_source, tool_names_used, session_id,
    )
    return answer, query_source, sources, session_id


def _save_history(
    db: Session,
    user_id: str,
    session_id: str,
    question: str,
    answer: str,
    query_source: str,
) -> None:
    record = ChatHistory(
        id=str(uuid.uuid4()),
        user_id=user_id,
        session_id=session_id,
        question=question,
        answer=answer,
        query_source=query_source,
    )
    db.add(record)
    try:
        db.commit()
    except Exception as exc:
        logger.error("Failed to save chat history: %s", exc)
        db.rollback()


def get_chat_history(
    db: Session,
    user_id: str,
    session_id: Optional[str] = None,
    limit: int = 50,
) -> list[ChatHistory]:
    q = db.query(ChatHistory).filter(ChatHistory.user_id == user_id)
    if session_id:
        q = q.filter(ChatHistory.session_id == session_id)
    return q.order_by(ChatHistory.created_at.desc()).limit(limit).all()
