"""Pydantic models for TuntasUMKM backend (PRD §6)."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ---------- Products ----------
SKU_RE = re.compile(r"^[A-Z]+-[0-9]+$")


class ProductBase(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sku: str
    name: str
    description: str = ""
    price: float
    stock: int
    cap: int
    variants: list[str] = Field(default_factory=list)
    category: str

    @field_validator("sku")
    @classmethod
    def _validate_sku(cls, v: str) -> str:
        if not SKU_RE.match(v):
            raise ValueError("sku must match [A-Z]+-[0-9]+")
        return v

    @field_validator("price")
    @classmethod
    def _price_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("price must be > 0")
        return v

    @field_validator("stock")
    @classmethod
    def _stock_nonneg(cls, v: int) -> int:
        if v < 0:
            raise ValueError("stock must be >= 0")
        return v


class ProductCreate(ProductBase):
    @field_validator("cap")
    @classmethod
    def _cap_gte_stock_create(cls, v: int, info) -> int:
        stock = info.data.get("stock")
        if stock is not None and v < stock:
            raise ValueError("cap must be >= stock")
        return v


class ProductUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str | None = None
    description: str | None = None
    price: float | None = None
    stock: int | None = None
    cap: int | None = None
    variants: list[str] | None = None
    category: str | None = None


class Product(ProductBase):
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Chat / Traces ----------
StageStatus = Literal["pending", "running", "completed", "failed", "skipped"]
STAGE_NAMES = [
    "intake",
    "understanding",
    "grounding",
    "tool_call",
    "action",
    "approval",
    "response",
]


class Stage(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    status: StageStatus = "pending"
    duration_ms: int = 0
    metadata: dict[str, Any] = Field(default_factory=dict)


def make_default_stages() -> list[Stage]:
    return [Stage(name=n, status="pending") for n in STAGE_NAMES]


class ChatIntakeRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    customer_id: str
    message_text: str
    channel: str = "WhatsApp"


class WorkflowTrace(BaseModel):
    model_config = ConfigDict(extra="ignore")

    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    channel: str = "WhatsApp"
    message_text: str = ""
    dedup_hash: str = ""
    stages: list[Stage] = Field(default_factory=make_default_stages)
    total_duration_ms: int = 0
    status: str = "pending_approval"
    draft: dict[str, Any] | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
