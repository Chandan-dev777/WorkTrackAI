"""Pydantic schemas for auth endpoints."""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Literal, Optional


class RegisterRequest(BaseModel):
    employee_id: str
    full_name: str
    email: EmailStr
    password: str
    role: Literal["employee", "manager", "admin"] = "employee"
    team_name: Optional[str] = None
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("employee_id")
    @classmethod
    def employee_id_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("employee_id cannot be empty")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    has_password: bool = True


class UserProfile(BaseModel):
    id: str
    employee_id: str
    full_name: str
    email: str
    role: str
    team_name: Optional[str]
    department: Optional[str]
    is_active: bool
    has_password: bool = True
    onboarding_complete: bool = False
    manager_id: Optional[str] = None

    model_config = {"from_attributes": True}


class TokenData(BaseModel):
    """Decoded JWT payload."""
    user_id: str
    email: str
    role: str
    employee_id: str
