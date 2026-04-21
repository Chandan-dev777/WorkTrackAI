"""Pydantic schemas for UserTemplate API I/O."""

from datetime import datetime

from pydantic import BaseModel, field_validator


class UserTemplateCreate(BaseModel):
    label: str
    text: str

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("label must not be empty")
        return v

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        return v


class UserTemplateUpdate(BaseModel):
    label: str | None = None
    text: str | None = None


class UserTemplateResponse(BaseModel):
    id: str
    user_id: str
    label: str
    text: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
