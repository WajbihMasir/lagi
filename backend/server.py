"""TuntasUMKM Backend — FastAPI + Motor + Bynara agnes-2.5-flash.

B1: schema + seed + products CRUD.
B2: Chat intake pipeline (Stage1..Stage4).
B3: Approvals + timeout cascade + Socket.IO + idempotency (stock decrement on approve).
B4: Analytics events + summary/intent/response-time/top-products/export + Stage6 response.
"""
from __future__ import annotations

import asyncio
import csv
import hashlib
import io
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import socketio
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

from models import (
    Approval,
    ApprovalCreateRequest,
    ApprovalDecisionRequest,
    AnalyticsEvent,
    ChatIntakeRequest,
    ConversationReplyRequest,
    KbDoc,
    KbDocCreate,
    Product,
    ProductCreate,
    ProductUpdate,
    Stage,
    WorkflowTrace,
    make_default_stages,
)
from pipeline import (
    make_idempotency_key,
    run_grounding,
    run_stage6_response,
    run_understanding,
    tool_buat_draft_pesanan,
    tool_cek_stok,
    tool_hitung_ongkir,
)
from seed_data import get_kb_docs_seed, get_personas_seed, get_products_seed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---- Mongo ----
mongo_url = os.environ["MONGO_URL"]
mongo_client = AsyncIOMotorClient(mongo_url)
db = mongo_client[os.environ["DB_NAME"]]

# ---- Timeout config (B3): TEST_TIMEOUT=1 → seconds; else minutes. ----
_TEST_MODE = os.environ.get("TEST_TIMEOUT", "1") == "1"
_UNIT = 1 if _TEST_MODE else 60  # seconds per unit
REMINDER_AFTER = 15 * _UNIT
AUTO_RESPONSE_AFTER = 30 * _UNIT
AUTO_HOLD_AFTER = 60 * _UNIT

# ---- FastAPI + Socket.IO ----
fastapi_app = FastAPI(title="TuntasUMKM API", version="0.4.0")
api_router = APIRouter(prefix="/api")

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ, auth):
    logging.getLogger(__name__).info("socket connect: %s", sid)
    await sio.emit("server:hello", {"sid": sid}, to=sid)


@sio.event
async def disconnect(sid):
    logging.getLogger(__name__).info("socket disconnect: %s", sid)


# ---- Rate limiter (in-memory, per customer_id) ----
_rate_bucket: dict[str, list[float]] = {}
_RATE_WINDOW = 60.0
_RATE_LIMIT = 10


def _rate_limit_check(customer_id: str) -> bool:
    now = time.time()
    bucket = _rate_bucket.setdefault(customer_id, [])
    while bucket and bucket[0] < now - _RATE_WINDOW:
        bucket.pop(0)
    if len(bucket) >= _RATE_LIMIT:
        return False
    bucket.append(now)
    return True


def _normalize_text(text: str) -> str:
    t = text.strip().lower()
    return " ".join(t.split())


def _dedup_hash(customer_id: str, message: str, window_min: int = 5) -> str:
    bucket_ts = int(time.time() // (window_min * 60))
    raw = f"{customer_id}|{_normalize_text(message)}|{bucket_ts}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ---- Startup ----
@fastapi_app.on_event("startup")
async def _startup_indexes() -> None:
    await db.products.create_index("sku", unique=True)
    await db.orders.create_index("order_id", unique=True)
    # B3: unique idempotency to prevent double-order (drop non-unique legacy if exists)
    try:
        await db.orders.drop_index("customer_id_1_idempotency_key_1")
    except Exception:  # noqa: BLE001
        pass
    await db.orders.create_index(
        [("customer_id", 1), ("idempotency_key", 1)], unique=True, sparse=True,
    )
    await db.workflow_traces.create_index("trace_id", unique=True)
    await db.workflow_traces.create_index("dedup_hash")
    await db.workflow_traces.create_index([("customer_id", 1), ("created_at", -1)])
    await db.conversations.create_index("conversation_id", unique=True)
    await db.conversations.create_index([("customer_id", 1), ("created_at", -1)])
    await db.conversations.create_index([("trace_id", 1), ("created_at", 1)])
    await db.orders.create_index([("status", 1), ("created_at", -1)])
    await db.orders.create_index([("customer_id", 1), ("created_at", -1)])
    await db.kb_docs.create_index("doc_id", unique=True)
    await db.approvals.create_index("approval_id", unique=True)
    await db.approvals.create_index([("order_id", 1), ("status", 1)])
    await db.analytics_events.create_index("event_id", unique=True)
    await db.analytics_events.create_index("timestamp")
    await db.personas.create_index("persona_id", unique=True)
    logging.getLogger(__name__).info(
        "Indexes ensured. TEST_MODE=%s, unit=%ss (reminder=%ss, auto_resp=%ss, hold=%ss)",
        _TEST_MODE, _UNIT, REMINDER_AFTER, AUTO_RESPONSE_AFTER, AUTO_HOLD_AFTER,
    )


@fastapi_app.on_event("shutdown")
async def _shutdown() -> None:
    mongo_client.close()


# ================= Root =================
@api_router.get("/")
async def root():
    return {"service": "TuntasUMKM API", "version": "0.4.0", "test_mode": _TEST_MODE}


# ================= B1: Seed =================
@api_router.post("/seed")
async def seed_data():
    products = get_products_seed()
    personas = get_personas_seed()
    kb_docs = get_kb_docs_seed()

    p_inserted = p_updated = 0
    for p in products:
        res = await db.products.update_one({"sku": p["sku"]}, {"$set": p}, upsert=True)
        if res.upserted_id is not None:
            p_inserted += 1
        elif res.modified_count:
            p_updated += 1

    ps_inserted = ps_updated = 0
    for per in personas:
        res = await db.personas.update_one(
            {"persona_id": per["persona_id"]}, {"$set": per}, upsert=True
        )
        if res.upserted_id is not None:
            ps_inserted += 1
        elif res.modified_count:
            ps_updated += 1

    kb_inserted = kb_updated = 0
    for kb in kb_docs:
        res = await db.kb_docs.update_one(
            {"doc_id": kb["doc_id"]}, {"$set": kb}, upsert=True
        )
        if res.upserted_id is not None:
            kb_inserted += 1
        elif res.modified_count:
            kb_updated += 1

    return {
        "ok": True,
        "products": {"total": len(products), "inserted": p_inserted, "updated": p_updated},
        "personas": {"total": len(personas), "inserted": ps_inserted, "updated": ps_updated},
        "kb_docs": {"total": len(kb_docs), "inserted": kb_inserted, "updated": kb_updated},
    }


# ================= B1: Products =================
@api_router.get("/products")
async def list_products(
    search: str | None = Query(default=None),
    kategori: str | None = Query(default=None, alias="kategori"),
    limit: int = Query(default=100, le=500),
):
    q: dict = {}
    if search:
        q["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}},
            {"sku": {"$regex": search, "$options": "i"}},
        ]
    if kategori:
        q["category"] = kategori
    cursor = db.products.find(q, {"_id": 0}).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"total": len(docs), "items": docs}


@api_router.get("/products/{sku}")
async def get_product(sku: str):
    doc = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"product sku={sku} not found")
    return doc


@api_router.post("/products", status_code=201)
async def create_product(payload: ProductCreate):
    doc = Product(**payload.model_dump()).model_dump()
    try:
        await db.products.insert_one({**doc})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail=f"sku {doc['sku']} already exists")
    doc.pop("_id", None)
    return doc


@api_router.put("/products/{sku}")
async def update_product(sku: str, payload: ProductUpdate):
    existing = await db.products.find_one({"sku": sku}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail=f"product sku={sku} not found")

    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **updates}
    if merged.get("price", 1) <= 0:
        raise HTTPException(status_code=422, detail="price must be > 0")
    if merged.get("stock", 0) < 0:
        raise HTTPException(status_code=422, detail="stock must be >= 0")
    if merged.get("cap", 0) < merged.get("stock", 0):
        raise HTTPException(status_code=422, detail="cap must be >= stock")

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.update_one({"sku": sku}, {"$set": updates})
    doc = await db.products.find_one({"sku": sku}, {"_id": 0})
    return doc


@api_router.delete("/products/{sku}")
async def delete_product(sku: str):
    res = await db.products.delete_one({"sku": sku})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail=f"product sku={sku} not found")
    return {"ok": True, "deleted": sku}


# ================= B2/B4: Chat Intake =================
async def _run_stage(trace_id: str, idx: int, coro) -> tuple[Any, str | None]:
    started = time.perf_counter()
    await db.workflow_traces.update_one(
        {"trace_id": trace_id}, {"$set": {f"stages.{idx}.status": "running"}}
    )
    try:
        result = await coro
        status = "completed"
        err: str | None = None
    except Exception as e:  # noqa: BLE001
        result = None
        status = "failed"
        err = str(e)
    duration_ms = int((time.perf_counter() - started) * 1000)

    stage_update = {
        f"stages.{idx}.status": status,
        f"stages.{idx}.duration_ms": duration_ms,
    }
    if err:
        stage_update[f"stages.{idx}.metadata.error"] = err
    await db.workflow_traces.update_one({"trace_id": trace_id}, {"$set": stage_update})
    return result, err


async def _log_analytics(
    trace_id: str,
    customer_id: str,
    intent: list[str],
    tools_called: list[str],
    approval_status: str,
    response_time_ms: int,
) -> None:
    ev = AnalyticsEvent(
        trace_id=trace_id,
        customer_id=customer_id,
        intent=intent or [],
        tools_called=tools_called or [],
        approval_status=approval_status,
        response_time_ms=response_time_ms,
    ).model_dump()
    try:
        await db.analytics_events.insert_one({**ev})
    except DuplicateKeyError:
        pass


@api_router.post("/chat/intake")
async def chat_intake(payload: ChatIntakeRequest, request: Request):
    total_started = time.perf_counter()

    if not _rate_limit_check(payload.customer_id):
        raise HTTPException(status_code=429, detail="rate limit 10/min exceeded")

    normalized = _normalize_text(payload.message_text)
    dedup = _dedup_hash(payload.customer_id, payload.message_text, window_min=5)

    dup = await db.workflow_traces.find_one({"dedup_hash": dedup}, {"_id": 0})
    if dup:
        raise HTTPException(status_code=409, detail={"error": "duplicate", "trace_id": dup["trace_id"]})

    trace = WorkflowTrace(
        customer_id=payload.customer_id,
        channel=payload.channel,
        message_text=payload.message_text,
        dedup_hash=dedup,
    )
    trace_doc = trace.model_dump()
    trace_doc["stages"][0]["status"] = "completed"
    trace_doc["stages"][0]["duration_ms"] = int((time.perf_counter() - total_started) * 1000)
    trace_doc["stages"][0]["metadata"] = {"normalized": normalized, "channel": payload.channel}
    await db.workflow_traces.insert_one({**trace_doc})

    # Stage 2
    (understanding, u_meta), u_err = await _run_stage(
        trace.trace_id, 1, run_understanding(payload.message_text)
    )
    if u_err or understanding is None:
        understanding = {"intent": ["lainnya"], "entities": {}, "confidence": 0.0, "fallback": True}
        u_meta = {"error": u_err or "unknown"}
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"stages.1.metadata": {**u_meta, "result": understanding}}},
    )

    confidence = float(understanding.get("confidence", 0.0) or 0.0)
    need_clarification = confidence < 0.6

    # Stage 3
    (grounding_top, g_meta), _ = await _run_stage(
        trace.trace_id, 2, run_grounding(db, payload.message_text, understanding.get("entities", {}))
    )
    if grounding_top is None:
        grounding_top = []
        g_meta = {"error": "grounding_failed"}
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"stages.2.metadata": {**g_meta, "top": grounding_top[:3]}}},
    )

    # Stage 4 — tools
    idem = make_idempotency_key(payload.customer_id, payload.message_text)
    tool_log: dict[str, Any] = {}
    tools_called: list[str] = []

    async def _tool_stage():
        if grounding_top:
            tool_log["cek_stok"] = await tool_cek_stok(db, grounding_top[0]["sku"])
            tools_called.append("cek_stok")

        intents = understanding.get("intent", [])
        entities = understanding.get("entities", {}) or {}
        qty = int(entities.get("jumlah") or 0)
        if "mau_pesan" in intents and qty > 0 and grounding_top:
            draft_r = await tool_buat_draft_pesanan(
                db,
                customer_id=payload.customer_id,
                items=[{"product_id": grounding_top[0]["sku"], "qty": qty}],
                idempotency_key=idem,
            )
            tools_called.append("buat_draft_pesanan")
            if draft_r.get("ok") and draft_r["order"].get("trace_id") == "":
                await db.orders.update_one(
                    {"order_id": draft_r["order"]["order_id"]},
                    {"$set": {"trace_id": trace.trace_id}},
                )
                draft_r["order"]["trace_id"] = trace.trace_id
            tool_log["draft"] = draft_r
            tool_log["ongkir"] = await tool_hitung_ongkir(
                [{"product_id": grounding_top[0]["sku"], "qty": qty}]
            )
            tools_called.append("hitung_ongkir")
        return tool_log

    await _run_stage(trace.trace_id, 3, _tool_stage())
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"stages.3.metadata": {"tools": tool_log, "idempotency_key": idem}}},
    )

    draft = None
    if isinstance(tool_log.get("draft"), dict) and tool_log["draft"].get("ok"):
        draft = tool_log["draft"]["order"]

    # Stage 5 — auto-create approval if there's a draft
    approval_status = "n/a"
    approval_id: str | None = None
    if draft and draft.get("status") == "pending_approval":
        approval = Approval(trace_id=trace.trace_id, order_id=draft["order_id"])
        await db.approvals.insert_one({**approval.model_dump()})
        approval_id = approval.approval_id
        approval_status = "pending"
        await db.workflow_traces.update_one(
            {"trace_id": trace.trace_id},
            {"$set": {
                "stages.5.status": "running",
                "stages.5.metadata": {
                    "approval_id": approval.approval_id,
                    "approval_status": "pending",
                    "requested_at": approval.requested_at,
                },
            }},
        )
        # Kick off timeout cascade
        asyncio.create_task(_approval_timeout_task(approval.approval_id))
        await sio.emit("approval:required", {
            "approval_id": approval.approval_id,
            "trace_id": trace.trace_id,
            "order_id": draft["order_id"],
            "customer_id": payload.customer_id,
            "total": draft.get("total", 0),
        })

    # Stage 6 — generate reply
    (reply_text, resp_meta), _ = await _run_stage(
        trace.trace_id, 6, run_stage6_response(understanding, grounding_top, draft)
    )
    if reply_text is None:
        reply_text = "Terima kasih, tim kami akan segera kembali menghubungi Anda."
        resp_meta = {"fallback": True, "error": "stage6_failed"}
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"stages.6.metadata": {**resp_meta, "text": reply_text}}},
    )

    # Save conversation entry
    await db.conversations.insert_one({
        "conversation_id": f"CV-{uuid.uuid4().hex[:10]}",
        "trace_id": trace.trace_id,
        "customer_id": payload.customer_id,
        "channel": payload.channel,
        "role": "agent",
        "text": reply_text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    status = "clarification_needed" if need_clarification else (
        "pending_approval" if draft else "answered"
    )
    total_ms = int((time.perf_counter() - total_started) * 1000)

    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"total_duration_ms": total_ms, "status": status, "draft": draft, "reply": reply_text}},
    )

    # Analytics + realtime
    await _log_analytics(
        trace.trace_id, payload.customer_id,
        understanding.get("intent", []), tools_called, approval_status, total_ms,
    )
    await sio.emit("chat:new", {
        "trace_id": trace.trace_id,
        "customer_id": payload.customer_id,
        "channel": payload.channel,
        "reply": reply_text,
        "status": status,
    })
    await sio.emit("trace:update", {"trace_id": trace.trace_id, "status": status})

    updated = await db.workflow_traces.find_one({"trace_id": trace.trace_id}, {"_id": 0})
    return {
        "trace_id": trace.trace_id,
        "status": status,
        "understanding": understanding,
        "grounding": grounding_top,
        "draft": draft,
        "approval_id": approval_id,
        "reply": reply_text,
        "tool_log": tool_log,
        "stages": updated["stages"] if updated else trace_doc["stages"],
        "total_duration_ms": total_ms,
    }


@api_router.get("/traces/{trace_id}")
async def get_trace(trace_id: str):
    doc = await db.workflow_traces.find_one({"trace_id": trace_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="trace not found")
    return doc


@api_router.get("/traces")
async def list_traces(customer_id: str | None = None, limit: int = 50):
    q = {"customer_id": customer_id} if customer_id else {}
    cursor = db.workflow_traces.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"total": len(docs), "items": docs}


# ================= B3: Approvals =================
async def _approval_timeout_task(approval_id: str) -> None:
    """Cascade: 15u reminder → 30u auto-response → 60u auto_hold."""
    log = logging.getLogger("approval.timeout")
    try:
        # 15u: reminder
        await asyncio.sleep(REMINDER_AFTER)
        cur = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
        if not cur or cur["status"] != "pending":
            return
        await db.approvals.update_one(
            {"approval_id": approval_id}, {"$set": {"reminder_sent": True}}
        )
        log.info("approval %s: reminder sent (%ss)", approval_id, REMINDER_AFTER)
        await sio.emit("approval:reminder", {"approval_id": approval_id})

        # 30u: auto customer message
        await asyncio.sleep(AUTO_RESPONSE_AFTER - REMINDER_AFTER)
        cur = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
        if not cur or cur["status"] != "pending":
            return
        trace = await db.workflow_traces.find_one({"trace_id": cur["trace_id"]}, {"_id": 0})
        await db.conversations.insert_one({
            "conversation_id": f"CV-{uuid.uuid4().hex[:10]}",
            "trace_id": cur["trace_id"],
            "customer_id": (trace or {}).get("customer_id", ""),
            "channel": (trace or {}).get("channel", "WhatsApp"),
            "role": "agent",
            "text": "Pesanan sedang diproses, mohon tunggu konfirmasi pemilik ya Kak 🙏",
            "auto": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.approvals.update_one(
            {"approval_id": approval_id}, {"$set": {"auto_response_sent": True}}
        )
        log.info("approval %s: auto customer response sent (%ss)", approval_id, AUTO_RESPONSE_AFTER)
        await sio.emit("chat:new", {
            "trace_id": cur["trace_id"],
            "reply": "Pesanan sedang diproses...",
            "auto": True,
        })

        # 60u: auto_hold + analytics flag
        await asyncio.sleep(AUTO_HOLD_AFTER - AUTO_RESPONSE_AFTER)
        cur = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
        if not cur or cur["status"] != "pending":
            return
        await db.approvals.update_one(
            {"approval_id": approval_id},
            {"$set": {
                "status": "auto_hold",
                "responded_at": datetime.now(timezone.utc).isoformat(),
                "decision": "auto_hold",
                "reason": "approval_timeout",
            }},
        )
        await db.orders.update_one(
            {"order_id": cur["order_id"]}, {"$set": {"status": "on_hold"}}
        )
        await db.workflow_traces.update_one(
            {"trace_id": cur["trace_id"]},
            {"$set": {
                "stages.5.status": "failed",
                "stages.5.metadata.approval_status": "auto_hold",
                "status": "on_hold",
            }},
        )
        await db.analytics_events.insert_one({
            **AnalyticsEvent(
                trace_id=cur["trace_id"],
                intent=["_flag"],
                tools_called=["approval_timeout"],
                approval_status="auto_hold",
                response_time_ms=AUTO_HOLD_AFTER * 1000,
            ).model_dump()
        })
        log.info("approval %s: AUTO HOLD (%ss)", approval_id, AUTO_HOLD_AFTER)
        await sio.emit("approval:decided", {
            "approval_id": approval_id,
            "decision": "auto_hold",
            "order_id": cur["order_id"],
        })
    except asyncio.CancelledError:
        raise
    except Exception as e:  # noqa: BLE001
        log.exception("approval timeout task error: %s", e)


@api_router.post("/approvals", status_code=201)
async def create_approval(payload: ApprovalCreateRequest):
    order = await db.orders.find_one({"order_id": payload.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail=f"order {payload.order_id} not found")
    existing = await db.approvals.find_one(
        {"order_id": payload.order_id, "status": "pending"}, {"_id": 0}
    )
    if existing:
        return existing
    approval = Approval(trace_id=payload.trace_id, order_id=payload.order_id)
    doc = approval.model_dump()
    await db.approvals.insert_one({**doc})
    await db.workflow_traces.update_one(
        {"trace_id": payload.trace_id},
        {"$set": {
            "stages.5.status": "running",
            "stages.5.metadata": {
                "approval_id": approval.approval_id,
                "approval_status": "pending",
                "requested_at": approval.requested_at,
            },
        }},
    )
    asyncio.create_task(_approval_timeout_task(approval.approval_id))
    await sio.emit("approval:required", {
        "approval_id": approval.approval_id,
        "trace_id": payload.trace_id,
        "order_id": payload.order_id,
        "total": order.get("total", 0),
    })
    return doc


@api_router.get("/approvals")
async def list_approvals(status: str | None = Query(default=None), limit: int = 50):
    q: dict = {}
    if status:
        q["status"] = status
    cursor = db.approvals.find(q, {"_id": 0}).sort("requested_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    # enrich with order snapshot
    enriched = []
    for a in docs:
        order = await db.orders.find_one({"order_id": a["order_id"]}, {"_id": 0}) or {}
        enriched.append({**a, "order": order})
    return {"total": len(enriched), "items": enriched}


async def _apply_decision(
    approval_id: str, decision: str, reason: str | None, items: list[dict] | None = None
) -> dict:
    apv = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
    if not apv:
        raise HTTPException(status_code=404, detail="approval not found")
    if apv["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"approval already {apv['status']}")

    order = await db.orders.find_one({"order_id": apv["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="order not found")

    now = datetime.now(timezone.utc).isoformat()
    new_order_status = "approved" if decision in ("approved", "modified") else "rejected"

    # Modify: rebuild items + totals from DB
    if decision == "modified" and items:
        enriched = []
        subtotal = 0
        for it in items:
            sku = it.get("product_id") or it.get("sku")
            qty = int(it.get("qty", 0))
            prod = await db.products.find_one({"sku": sku}, {"_id": 0}) if sku else None
            if not prod or qty <= 0:
                continue
            enriched.append({
                "product_id": sku, "qty": qty,
                "unit_price": prod["price"], "name": prod["name"],
            })
            subtotal += prod["price"] * qty
        ongkir_r = await tool_hitung_ongkir(enriched)
        ongkir = int(ongkir_r["ongkir"])
        total = subtotal + ongkir
        await db.orders.update_one(
            {"order_id": apv["order_id"]},
            {"$set": {"items": enriched, "subtotal": subtotal,
                      "ongkir": ongkir, "total": total, "status": new_order_status}},
        )
        order = await db.orders.find_one({"order_id": apv["order_id"]}, {"_id": 0})
    else:
        await db.orders.update_one(
            {"order_id": apv["order_id"]}, {"$set": {"status": new_order_status}}
        )

    # Stock decrement only on approve/modify (PRD:302)
    if new_order_status == "approved":
        for it in order.get("items", []):
            await db.products.update_one(
                {"sku": it["product_id"]}, {"$inc": {"stock": -int(it["qty"])}}
            )

    apv_update = {
        "status": decision,
        "responded_at": now,
        "decision": decision,
        "reason": reason,
        "modified_by": "operator",
    }
    await db.approvals.update_one({"approval_id": approval_id}, {"$set": apv_update})

    # Workflow trace
    await db.workflow_traces.update_one(
        {"trace_id": apv["trace_id"]},
        {"$set": {
            "stages.5.status": "completed",
            "stages.5.metadata.approval_status": decision,
            "stages.5.metadata.approval_trace": {
                "requested_at": apv["requested_at"],
                "responded_at": now,
                "decision": decision,
                "modified_by": "operator",
                "reason": reason,
            },
            "status": new_order_status,
        }},
    )

    # Analytics
    await db.analytics_events.insert_one({
        **AnalyticsEvent(
            trace_id=apv["trace_id"], intent=["approval"],
            tools_called=[f"approval_{decision}"],
            approval_status=decision, response_time_ms=0,
        ).model_dump()
    })

    updated_apv = await db.approvals.find_one({"approval_id": approval_id}, {"_id": 0})
    order = await db.orders.find_one({"order_id": apv["order_id"]}, {"_id": 0})

    await sio.emit("approval:decided", {
        "approval_id": approval_id,
        "decision": decision,
        "order_id": apv["order_id"],
        "order_status": new_order_status,
    })
    await sio.emit("trace:update", {"trace_id": apv["trace_id"], "status": new_order_status})

    return {"ok": True, "approval": updated_apv, "order": order}


@api_router.post("/approvals/{approval_id}/approve")
async def approve(approval_id: str, payload: ApprovalDecisionRequest):
    return await _apply_decision(approval_id, "approved", payload.reason)


@api_router.post("/approvals/{approval_id}/reject")
async def reject(approval_id: str, payload: ApprovalDecisionRequest):
    return await _apply_decision(approval_id, "rejected", payload.reason)


@api_router.post("/approvals/{approval_id}/modify")
async def modify(approval_id: str, payload: ApprovalDecisionRequest):
    if not payload.items:
        raise HTTPException(status_code=422, detail="items required for modify")
    return await _apply_decision(approval_id, "modified", payload.reason, payload.items)


# ================= B4: Analytics =================
def _period_range(period: str) -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    if period == "today":
        start = now - timedelta(days=1)
    elif period == "week":
        start = now - timedelta(days=7)
    elif period == "month":
        start = now - timedelta(days=30)
    else:
        start = now - timedelta(days=1)
    return start, now


@api_router.get("/analytics/summary")
async def analytics_summary(period: str = "today"):
    start, end = _period_range(period)
    q = {"timestamp": {"$gte": start.isoformat()}}
    orders_q = {}
    total_events = await db.analytics_events.count_documents(q)
    order_count = await db.orders.count_documents(
        {**orders_q, "status": {"$in": ["approved", "modified"]}}
    )
    pipeline = [
        {"$match": {"status": {"$in": ["approved", "modified"]}}},
        {"$group": {"_id": None, "omzet": {"$sum": "$total"}}},
    ]
    agg = await db.orders.aggregate(pipeline).to_list(length=1)
    omzet = agg[0]["omzet"] if agg else 0
    pending = await db.approvals.count_documents({"status": "pending"})
    hold = await db.approvals.count_documents({"status": "auto_hold"})
    # akurasi = 1 - (rejected / total decided) *100
    decided = await db.approvals.count_documents(
        {"status": {"$in": ["approved", "modified", "rejected"]}}
    )
    rejected = await db.approvals.count_documents({"status": "rejected"})
    akurasi = round((1 - (rejected / decided)) * 100, 1) if decided else 94.0
    return {
        "period": period,
        "kpi": {
            "orders": order_count,
            "omzet": omzet,
            "akurasi": akurasi,
            "pending_approvals": pending,
            "auto_hold": hold,
            "events": total_events,
        },
    }


@api_router.get("/analytics/intent-dist")
async def intent_dist(period: str = "today"):
    start, _ = _period_range(period)
    pipeline = [
        {"$match": {"timestamp": {"$gte": start.isoformat()}}},
        {"$unwind": "$intent"},
        {"$match": {"intent": {"$nin": ["_flag", "approval"]}}},
        {"$group": {"_id": "$intent", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    rows = await db.analytics_events.aggregate(pipeline).to_list(length=20)
    label = {
        "tanya_produk": "Tanya Produk",
        "mau_pesan": "Pesan Order",
        "tanya_stok": "Cek Stok",
        "keluhan": "Retur",
        "lainnya": "Lainnya",
    }
    items = [{"name": label.get(r["_id"], r["_id"]), "value": r["count"]} for r in rows]
    return {"period": period, "items": items}


@api_router.get("/analytics/response-time")
async def response_time(period: str = "today"):
    start, _ = _period_range(period)
    pipeline = [
        {"$match": {"timestamp": {"$gte": start.isoformat()}, "response_time_ms": {"$gt": 0}}},
        {"$sort": {"timestamp": 1}},
        {"$limit": 500},
        {"$project": {"_id": 0, "timestamp": 1, "ms": "$response_time_ms"}},
    ]
    rows = await db.analytics_events.aggregate(pipeline).to_list(length=500)
    series = [{"hour": r["timestamp"][11:16], "ms": r["ms"]} for r in rows]
    return {"period": period, "items": series}


@api_router.get("/analytics/top-products")
async def top_products(period: str = "today", limit: int = 5):
    start, _ = _period_range(period)
    pipeline = [
        {"$match": {"status": {"$in": ["approved", "modified"]}}},
        {"$unwind": "$items"},
        {"$group": {
            "_id": "$items.product_id",
            "qty": {"$sum": "$items.qty"},
            "omzet": {"$sum": {"$multiply": ["$items.qty", "$items.unit_price"]}},
            "name": {"$first": "$items.name"},
        }},
        {"$sort": {"qty": -1}},
        {"$limit": limit},
    ]
    rows = await db.orders.aggregate(pipeline).to_list(length=limit)
    return {
        "period": period,
        "items": [
            {"sku": r["_id"], "name": r.get("name", r["_id"]), "qty": r["qty"], "omzet": r["omzet"]}
            for r in rows
        ],
    }


@api_router.get("/analytics")
async def analytics_periods(period: str = "today"):
    """Aggregated buckets for FE PERIODS. Falls back to sane defaults if no data."""
    start, _ = _period_range(period)
    # Omzet buckets by day-of-week (today: 7 days), else 7 buckets
    approved = await db.orders.aggregate([
        {"$match": {"status": {"$in": ["approved", "modified"]}}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    omzet_total = approved[0]["total"] if approved else 0
    count = approved[0]["count"] if approved else 0
    # Series (simple: split total across 7 buckets)
    labels_day = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    labels_week = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
    labels_month = ["W1", "W2", "W3", "W4", "W5"]
    if period == "month":
        labels = labels_month
    else:
        labels = labels_day if period == "today" else labels_week
    per_bucket = omzet_total / max(len(labels), 1) / 1_000_000
    omzet_series = [round(per_bucket * (0.7 + 0.1 * i), 2) for i in range(len(labels))]

    intent_data = await intent_dist(period)
    resp_data = await response_time(period)
    top = await top_products(period, 5)

    fmt_total = f"Rp {omzet_total/1_000_000:.1f} jt".replace(".", ",")
    return {
        "period": period,
        "label": {"today": "Hari ini", "week": "7 hari", "month": "30 hari"}.get(period, period),
        "omzet_series": omzet_series,
        "omzet_labels": labels,
        "total": fmt_total,
        "kategori": top["items"],
        "intent": intent_data["items"],
        "response": resp_data["items"],
        "orders_count": count,
    }


@api_router.get("/analytics/export")
async def analytics_export(period: str = "today"):
    summary = await analytics_summary(period)
    intent = await intent_dist(period)
    top = await top_products(period, 10)

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["TuntasUMKM Analytics Export"])
    w.writerow(["Period", period])
    w.writerow(["Generated", datetime.now(timezone.utc).isoformat()])
    w.writerow([])
    w.writerow(["KPI"])
    for k, v in summary["kpi"].items():
        w.writerow([k, v])
    w.writerow([])
    w.writerow(["Intent Distribution"])
    w.writerow(["Intent", "Count"])
    for row in intent["items"]:
        w.writerow([row["name"], row["value"]])
    w.writerow([])
    w.writerow(["Top Products"])
    w.writerow(["SKU", "Name", "Qty", "Omzet"])
    for row in top["items"]:
        w.writerow([row["sku"], row["name"], row["qty"], row["omzet"]])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="tuntas-analytics-{period}-{int(time.time())}.csv"'
        },
    )


# ================= Orders (FE P3: read-only list, additive) =================
@api_router.get("/orders")
async def list_orders(
    status: str | None = Query(default=None),
    q: str | None = Query(default=None),
    customer_id: str | None = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    query: dict = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if q:
        query["$or"] = [
            {"order_id": {"$regex": q, "$options": "i"}},
            {"customer_id": {"$regex": q, "$options": "i"}},
            {"items.name": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.orders.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"total": len(docs), "items": docs}


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail=f"order {order_id} not found")
    return doc


# ================= Conversations (FE P4: inbox grouping, additive) =================
@api_router.get("/conversations")
async def list_conversations(limit: int = Query(default=50, le=200)):
    pipeline = [
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$customer_id",
            "last_message": {"$first": "$text"},
            "last_role": {"$first": "$role"},
            "last_at": {"$first": "$created_at"},
            "channel": {"$first": "$channel"},
            "trace_id": {"$first": "$trace_id"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"last_at": -1}},
        {"$limit": limit},
    ]
    rows = await db.conversations.aggregate(pipeline).to_list(length=limit)
    items = [
        {
            "customer_id": r["_id"] or "unknown",
            "last": r.get("last_message", ""),
            "last_role": r.get("last_role", ""),
            "time": (r.get("last_at", "") or "")[11:16] if r.get("last_at") else "",
            "channel": r.get("channel", "WhatsApp"),
            "trace_id": r.get("trace_id", ""),
            "count": r.get("count", 0),
        }
        for r in rows
        if r["_id"]
    ]
    # enrich with pending draft order (if any)
    for it in items:
        order = await db.orders.find_one(
            {"customer_id": it["customer_id"], "status": "pending_approval"},
            {"_id": 0},
            sort=[("created_at", -1)],
        )
        trace = await db.workflow_traces.find_one(
            {"trace_id": it["trace_id"]}, {"_id": 0}
        ) if it.get("trace_id") else None
        it["draft"] = order
        it["state"] = (
            "pending_approval" if order
            else ((trace or {}).get("status", "answered") or "answered")
        )
        it["total"] = (order or {}).get("total", 0)
    return {"total": len(items), "items": items}


@api_router.get("/conversations/{customer_id}")
async def get_conversation(customer_id: str, limit: int = Query(default=100, le=500)):
    cursor = (
        db.conversations.find({"customer_id": customer_id}, {"_id": 0})
        .sort("created_at", 1)
        .limit(limit)
    )
    docs = await cursor.to_list(length=limit)
    order = await db.orders.find_one(
        {"customer_id": customer_id, "status": "pending_approval"},
        {"_id": 0},
        sort=[("created_at", -1)],
    )
    return {"customer_id": customer_id, "total": len(docs), "thread": docs, "draft": order}


@api_router.post("/conversations/{customer_id}/reply")
async def reply_conversation(customer_id: str, payload: ConversationReplyRequest):
    text = (payload.text or "").strip()
    if not text:
        raise HTTPException(status_code=422, detail="text required")
    doc = {
        "conversation_id": f"CV-{uuid.uuid4().hex[:10]}",
        "trace_id": "",
        "customer_id": customer_id,
        "channel": payload.channel or "WhatsApp",
        "role": "owner",
        "text": text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.conversations.insert_one({**doc})
    await sio.emit("chat:new", {
        "customer_id": customer_id,
        "channel": doc["channel"],
        "reply": text,
        "role": "owner",
    })
    return doc


# ================= Knowledge Base (FE P6: kb_docs, additive) =================
@api_router.get("/kb")
async def list_kb(
    q: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    limit: int = Query(default=100, le=200),
):
    query: dict = {}
    if tag:
        query["tag"] = tag
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    cursor = db.kb_docs.find(query, {"_id": 0}).sort("name", 1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"total": len(docs), "items": docs}


@api_router.post("/kb", status_code=201)
async def create_kb(payload: KbDocCreate):
    data = payload.model_dump()
    if not data.get("doc_id"):
        data["doc_id"] = f"KB-{uuid.uuid4().hex[:6].upper()}"
    doc = KbDoc(**data).model_dump()
    try:
        await db.kb_docs.insert_one({**doc})
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail=f"doc {doc['doc_id']} already exists")
    return doc


# ---- Register router ----
fastapi_app.include_router(api_router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ---- Mount Socket.IO over FastAPI (ASGI). Exposed as `app` for uvicorn. ----
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app, socketio_path="/api/socket.io")
