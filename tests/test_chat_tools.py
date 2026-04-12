"""Unit tests for the three chat tools (date_resolver, sql_query, vector_search)."""

import json
import uuid
from datetime import date, timedelta

import pytest

from backend.services.chat_service import _resolve_date_expression, make_tools
from backend.models.work_item import WorkItem
from backend.models.work_log import WorkLog
from backend.models.user import User


TODAY = date.today()


# ── date_resolver tests ───────────────────────────────────────────────────────

class TestDateResolver:
    def test_today(self):
        r = _resolve_date_expression("today", TODAY)
        assert r["start_date"] == TODAY.isoformat()
        assert r["end_date"] == TODAY.isoformat()

    def test_yesterday(self):
        r = _resolve_date_expression("yesterday", TODAY)
        expected = (TODAY - timedelta(days=1)).isoformat()
        assert r["start_date"] == expected
        assert r["end_date"] == expected

    def test_this_week(self):
        r = _resolve_date_expression("this week", TODAY)
        monday = TODAY - timedelta(days=TODAY.weekday())
        assert r["start_date"] == monday.isoformat()
        assert r["end_date"] == TODAY.isoformat()

    def test_last_week(self):
        r = _resolve_date_expression("last week", TODAY)
        last_sunday = TODAY - timedelta(days=TODAY.weekday() + 1)
        last_monday = last_sunday - timedelta(days=6)
        assert r["start_date"] == last_monday.isoformat()
        assert r["end_date"] == last_sunday.isoformat()

    def test_this_month(self):
        r = _resolve_date_expression("this month", TODAY)
        assert r["start_date"] == TODAY.replace(day=1).isoformat()
        assert r["end_date"] == TODAY.isoformat()

    def test_last_month(self):
        r = _resolve_date_expression("last month", TODAY)
        first_this = TODAY.replace(day=1)
        last_prev = first_this - timedelta(days=1)
        first_prev = last_prev.replace(day=1)
        assert r["start_date"] == first_prev.isoformat()
        assert r["end_date"] == last_prev.isoformat()

    def test_last_n_days(self):
        r = _resolve_date_expression("last 7 days", TODAY)
        assert r["start_date"] == (TODAY - timedelta(days=6)).isoformat()
        assert r["end_date"] == TODAY.isoformat()

    def test_last_n_weeks(self):
        r = _resolve_date_expression("last 2 weeks", TODAY)
        assert r["start_date"] == (TODAY - timedelta(weeks=2)).isoformat()
        assert r["end_date"] == TODAY.isoformat()

    def test_past_n_days_alias(self):
        r = _resolve_date_expression("past 30 days", TODAY)
        assert r["start_date"] == (TODAY - timedelta(days=29)).isoformat()

    def test_unknown_expression_returns_this_week(self):
        r = _resolve_date_expression("some random phrase", TODAY)
        monday = TODAY - timedelta(days=TODAY.weekday())
        assert r["start_date"] == monday.isoformat()


# ── sql_query tool tests ──────────────────────────────────────────────────────

def _setup_user_with_items(db):
    user = User(
        employee_id="EMP-001",
        full_name="Test User",
        email="test@x.com",
        hashed_password="hashed",
        role="employee",
    )
    db.add(user)
    db.flush()

    log = WorkLog(
        id=str(uuid.uuid4()),
        user_id=user.id,
        work_date=TODAY,
        raw_message="test",
        extraction_status="success",
    )
    db.add(log)
    db.flush()

    for cat, hrs, status in [
        ("ticket", 2.0, "done"),
        ("meeting", 0.5, "done"),
        ("project", 3.0, "in_progress"),
    ]:
        db.add(WorkItem(
            id=str(uuid.uuid4()),
            work_log_id=log.id,
            employee_id=user.employee_id,
            work_date=TODAY,
            task_description=f"Task in {cat}",
            work_category=cat,
            hours_spent=hrs,
            status=status,
        ))
    db.commit()
    return user


class TestSqlQueryTool:
    def test_total_hours_summary(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "total_hours_summary",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        assert result["total_hours"] == 5.5
        assert result["done_count"] == 2
        assert result["in_progress_count"] == 1

    def test_hours_by_category(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "hours_by_category",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        cats = {r["category"]: r["hours"] for r in result}
        assert cats["ticket"] == 2.0
        assert cats["meeting"] == 0.5
        assert cats["project"] == 3.0

    def test_status_distribution(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "status_distribution",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        statuses = {r["status"]: r["count"] for r in result}
        assert statuses["done"] == 2
        assert statuses["in_progress"] == 1

    def test_manager_can_query_employee_by_employee_id_string(self, db):
        """Regression: target_employee_id='EMP-CB-001' must resolve to user UUID.
        Previously the string was passed directly to WorkLog.user_id, returning nothing."""
        mgr = User(
            employee_id="MGR-001", full_name="Manager", email="mgr@x.com",
            hashed_password="h", role="manager",
        )
        emp = User(
            employee_id="EMP-CB-001", full_name="Priya Sharma", email="priya@x.com",
            hashed_password="h", role="employee",
        )
        db.add(mgr)
        db.add(emp)
        db.flush()

        log = WorkLog(
            id=str(uuid.uuid4()), user_id=emp.id, work_date=TODAY,
            raw_message="test", extraction_status="success",
        )
        db.add(log)
        db.flush()
        db.add(WorkItem(
            id=str(uuid.uuid4()), work_log_id=log.id, employee_id=emp.employee_id,
            work_date=TODAY, task_description="Priya's task", work_category="ticket",
            hours_spent=3.0, status="done",
        ))
        db.commit()

        tools = make_tools(mgr.id, "manager", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "list_items",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
            "target_employee_id": "EMP-CB-001",
        }))

        assert isinstance(result, list)
        assert len(result) == 1
        assert result[0]["task_description"] == "Priya's task"

    def test_manager_unknown_employee_id_returns_error(self, db):
        mgr = User(
            employee_id="MGR-002", full_name="Manager2", email="mgr2@x.com",
            hashed_password="h", role="manager",
        )
        db.add(mgr)
        db.commit()

        tools = make_tools(mgr.id, "manager", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "list_items",
            "start_date": TODAY.isoformat(),
            "end_date": TODAY.isoformat(),
            "target_employee_id": "EMP-DOES-NOT-EXIST",
        }))
        assert "error" in result

    def test_employee_cannot_query_others(self, db):
        user_a = _setup_user_with_items(db)

        user_b = User(
            employee_id="EMP-002", full_name="B", email="b@x.com",
            hashed_password="h", role="employee",
        )
        db.add(user_b)
        db.commit()

        # user_b's tools should only see user_b's data (zero items)
        tools = make_tools(user_b.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")
        result = json.loads(sql_tool.invoke({
            "metric": "total_hours_summary",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))
        assert result["total_hours"] == 0.0

    def test_list_items_returns_task_descriptions(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "list_items",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        assert isinstance(result, list)
        assert len(result) == 3
        descs = {r["task_description"] for r in result}
        assert "Task in ticket" in descs
        assert "Task in meeting" in descs
        assert all("work_date" in r for r in result)
        assert all("hours_spent" in r for r in result)

    def test_list_items_filtered_by_category(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "list_items",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
            "category": "ticket",
        }))

        assert len(result) == 1
        assert result[0]["work_category"] == "ticket"

    def test_invalid_metric_returns_error(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "nonexistent_metric",
            "start_date": TODAY.isoformat(),
            "end_date": TODAY.isoformat(),
        }))
        assert "error" in result

    def test_invalid_dates_return_error(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "total_hours_summary",
            "start_date": "not-a-date",
            "end_date": "also-bad",
        }))
        assert "error" in result

    def test_daily_trend_returns_per_day_entries(self, db):
        user = _setup_user_with_items(db)
        tools = make_tools(user.id, "employee", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        result = json.loads(sql_tool.invoke({
            "metric": "daily_trend",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))

        assert isinstance(result, list)
        # Items all have work_date=TODAY so there should be 1 day entry
        assert len(result) == 1
        entry = result[0]
        assert entry["date"] == TODAY.isoformat()
        assert entry["hours"] == pytest.approx(5.5, abs=0.01)
        assert entry["item_count"] == 3
        # date field must be a string (ISO), not a date object
        assert isinstance(entry["date"], str)

    def test_team_summary_is_json_serializable(self, db):
        """team_summary contains date fields — must serialize cleanly (regression: date not JSON serializable)."""
        mgr = User(
            employee_id="MGR-TST", full_name="Manager", email="mgr.tst@x.com",
            hashed_password="h", role="manager",
        )
        db.add(mgr)
        db.flush()

        emp = User(
            employee_id="EMP-TST", full_name="Employee", email="emp.tst@x.com",
            hashed_password="h", role="employee",
        )
        db.add(emp)
        db.flush()

        log = WorkLog(
            id=str(uuid.uuid4()), user_id=emp.id, work_date=TODAY,
            raw_message="test", extraction_status="success",
        )
        db.add(log)
        db.flush()
        db.add(WorkItem(
            id=str(uuid.uuid4()), work_log_id=log.id, employee_id=emp.employee_id,
            work_date=TODAY, task_description="Task", work_category="ticket",
            hours_spent=2.0, status="done",
        ))
        db.commit()

        tools = make_tools(mgr.id, "manager", db)
        sql_tool = next(t for t in tools if t.name == "sql_query")

        # This must not raise "Object of type date is not JSON serializable"
        raw = sql_tool.invoke({
            "metric": "team_summary",
            "start_date": (TODAY - timedelta(days=7)).isoformat(),
            "end_date": TODAY.isoformat(),
        })
        result = json.loads(raw)
        assert isinstance(result, list)
        assert len(result) >= 1
        # last_activity should be a string (ISO date), not a date object
        emp_row = next((r for r in result if r["employee_id"] == emp.employee_id), None)
        assert emp_row is not None
        assert emp_row["total_hours"] == 2.0
        assert isinstance(emp_row.get("last_activity"), str)


# ── vector_search tool tests ──────────────────────────────────────────────────

class TestVectorSearchTool:
    def test_returns_list_when_chroma_empty(self, db):
        user = User(
            employee_id="EMP-VST", full_name="VS Test", email="vst@x.com",
            hashed_password="h", role="employee",
        )
        db.add(user)
        db.commit()

        tools = make_tools(user.id, "employee", db)
        vs_tool = next(t for t in tools if t.name == "vector_search")

        # ChromaDB is empty in tests — should return empty list, not error
        result = json.loads(vs_tool.invoke({"query": "API work last week"}))
        assert isinstance(result, list)

    def test_date_range_filter_does_not_raise(self, db):
        """Regression: passing both start_date and end_date must not crash ChromaDB
        with 'Expected operator expression to have exactly one operator'."""
        user = User(
            employee_id="EMP-VDR", full_name="VS Date", email="vsdr@x.com",
            hashed_password="h", role="employee",
        )
        db.add(user)
        db.commit()

        tools = make_tools(user.id, "employee", db)
        vs_tool = next(t for t in tools if t.name == "vector_search")

        # Both dates provided — previously crashed with ChromaDB operator error
        result = json.loads(vs_tool.invoke({
            "query": "deployment work",
            "start_date": (TODAY - timedelta(days=30)).isoformat(),
            "end_date": TODAY.isoformat(),
        }))
        assert isinstance(result, list)  # empty is fine; must not raise

    def test_manager_search_not_restricted_by_user_id(self, db):
        """Manager role should call vector_search without user_id restriction."""
        mgr = User(
            employee_id="MGR-001", full_name="Manager", email="mgr@x.com",
            hashed_password="h", role="manager",
        )
        db.add(mgr)
        db.commit()

        tools = make_tools(mgr.id, "manager", db)
        vs_tool = next(t for t in tools if t.name == "vector_search")
        # Should not raise — returns empty list from empty ChromaDB
        result = json.loads(vs_tool.invoke({"query": "team progress"}))
        assert isinstance(result, list)
