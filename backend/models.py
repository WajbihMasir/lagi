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


# ---------- Approvals (B3) ----------
class ApprovalCreateRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    trace_id: str
    order_id: str


class ApprovalDecisionRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reason: str | None = None
    items: list[dict[str, Any]] | None = None  # for modify: [{product_id, qty}]


class Approval(BaseModel):
    model_config = ConfigDict(extra="ignore")
    approval_id: str = Field(default_factory=lambda: f"APV-{uuid.uuid4().hex[:8].upper()}")
    trace_id: str
    order_id: str
    status: Literal["pending", "approved", "rejected", "modified", "auto_hold"] = "pending"
    requested_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    responded_at: str | None = None
    decision: str | None = None
    modified_by: str | None = None
    reason: str | None = None
    reminder_sent: bool = False
    auto_response_sent: bool = False


# ---------- Analytics (B4) ----------
class AnalyticsEvent(BaseModel):
    model_config = ConfigDict(extra="ignore")
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trace_id: str = ""
    customer_id: str = ""
    intent: list[str] = Field(default_factory=list)
    tools_called: list[str] = Field(default_factory=list)
    approval_status: str = "n/a"
    response_time_ms: int = 0
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ---------- Knowledge Base (FE P6: kb_docs, additive, no breaking change) ----------
class KbDocCreate(BaseModel):
    model_config = ConfigDict(extra="ignore")
    doc_id: str | None = None
    name: str
    kind: str = "MD"
    size: str = "0 KB"
    chunks: int = 0
    tag: str = "umum"
    status: Literal["synced", "syncing", "stale"] = "synced"


class KbDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    doc_id: str = Field(default_factory=lambda: f"KB-{uuid.uuid4().hex[:6].upper()}")
    name: str
    kind: str = "MD"
    size: str = "0 KB"
    chunks: int = 0
    lastSync: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: Literal["synced", "syncing", "stale"] = "synced"
    tag: str = "umum"


# ---------- Conversations (FE P4: manual owner reply) ----------
class ConversationReplyRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    text: str
    channel: str = "WhatsApp"
