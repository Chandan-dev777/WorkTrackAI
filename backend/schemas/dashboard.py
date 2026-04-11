"""Pydantic schemas for dashboard API responses."""

from datetime import date
from typing import Optional

from pydantic import BaseModel


class HoursSummary(BaseModel):
    total_hours: float
    done_count: int
    in_progress_count: int
    blocked_count: int
    planned_count: int
    total_items: int
    start_date: date
    end_date: date


class CategoryHours(BaseModel):
    category: str
    hours: float
    item_count: int


class StatusCount(BaseModel):
    status: str
    count: int


class DailyHours(BaseModel):
    date: date
    hours: float
    item_count: int


class TeamMemberSummary(BaseModel):
    employee_id: str
    full_name: str
    total_hours: float
    done_count: int
    blocked_count: int
    last_activity: Optional[date] = None
