"""TuntasUMKM Backend — FastAPI + Motor + Bynara agnes-2.5-flash.

B1: Foundation schema + seed + product CRUD.
B2: Chat intake (Stage1 Intake → Stage2 Understanding → Stage3 Grounding → Stage4 Tool stubs).
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query, Request
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import DuplicateKeyError
from starlette.middleware.cors import CORSMiddleware

from models import (
    ChatIntakeRequest,
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
    run_understanding,
    tool_buat_draft_pesanan,
    tool_cek_stok,
    tool_hitung_ongkir,
)
from seed_data import get_personas_seed, get_products_seed

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---- Mongo ----
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ---- App ----
app = FastAPI(title="TuntasUMKM API", version="0.2.0")
api_router = APIRouter(prefix="/api")

# ---- Rate limiter (in-memory, per customer_id) ----
_rate_bucket: dict[str, list[float]] = {}
_RATE_WINDOW = 60.0
_RATE_LIMIT = 10


def _rate_limit_check(customer_id: str) -> bool:
    now = time.time()
    bucket = _rate_bucket.setdefault(customer_id, [])
    # prune
    while bucket and bucket[0] < now - _RATE_WINDOW:
        bucket.pop(0)
    if len(bucket) >= _RATE_LIMIT:
        return False
    bucket.append(now)
    return True


def _normalize_text(text: str) -> str:
    t = text.strip().lower()
    # Ringkas double spaces & simple typo squash
    t = " ".join(t.split())
    return t


def _dedup_hash(customer_id: str, message: str, window_min: int = 5) -> str:
    bucket_ts = int(time.time() // (window_min * 60))
    raw = f"{customer_id}|{_normalize_text(message)}|{bucket_ts}"
    return hashlib.sha256(raw.encode()).hexdigest()[:32]


# ---- Startup: ensure indexes ----
@app.on_event("startup")
async def _startup_indexes() -> None:
    await db.products.create_index("sku", unique=True)
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index([("customer_id", 1), ("idempotency_key", 1)])
    await db.workflow_traces.create_index("trace_id", unique=True)
    await db.workflow_traces.create_index("dedup_hash")
    await db.conversations.create_index("conversation_id", unique=True)
    await db.approvals.create_index("approval_id", unique=True)
    await db.analytics_events.create_index("event_id", unique=True)
    await db.personas.create_index("persona_id", unique=True)
    logging.getLogger(__name__).info("Indexes ensured on collections.")


@app.on_event("shutdown")
async def _shutdown() -> None:
    client.close()


# ================= Root =================
@api_router.get("/")
async def root():
    return {"service": "TuntasUMKM API", "version": "0.2.0"}


# ================= B1: Seed =================
@api_router.post("/seed")
async def seed_data():
    """Idempotent seed for products & personas."""
    products = get_products_seed()
    personas = get_personas_seed()

    p_inserted = p_updated = 0
    for p in products:
        res = await db.products.update_one({"sku": p["sku"]}, {"$set": p}, upsert=True)
        if res.upserted_id is not None:
            p_inserted += 1
        elif res.modified_count:
            p_updated += 1

    ps_inserted = ps_updated = 0
    for per in personas:
        res = await db.personas.update_one({"persona_id": per["persona_id"]}, {"$set": per}, upsert=True)
        if res.upserted_id is not None:
            ps_inserted += 1
        elif res.modified_count:
            ps_updated += 1

    return {
        "ok": True,
        "products": {"total": len(products), "inserted": p_inserted, "updated": p_updated},
        "personas": {"total": len(personas), "inserted": ps_inserted, "updated": ps_updated},
    }


# ================= B1: Products CRUD =================
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
    # Post-merge validation: cap >= stock
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


# ================= B2: Chat Intake =================
async def _run_stage(trace_id: str, idx: int, coro) -> tuple[Stage, object]:
    """Run coroutine, update stage by index in workflow_traces."""
    started = time.perf_counter()
    await db.workflow_traces.update_one(
        {"trace_id": trace_id}, {"$set": {f"stages.{idx}.status": "running"}}
    )
    try:
        result = await coro
        status = "completed"
        err = None
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


@api_router.post("/chat/intake")
async def chat_intake(payload: ChatIntakeRequest, request: Request):
    """B2: Stage1 Intake → Stage2 Understanding → Stage3 Grounding → Stage4 Tool stubs."""
    total_started = time.perf_counter()

    # ---------- Stage 1: Intake ----------
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
    # Mark Stage1 completed
    trace_doc["stages"][0]["status"] = "completed"
    trace_doc["stages"][0]["duration_ms"] = int((time.perf_counter() - total_started) * 1000)
    trace_doc["stages"][0]["metadata"] = {"normalized": normalized, "channel": payload.channel}
    await db.workflow_traces.insert_one({**trace_doc})

    # ---------- Stage 2: Understanding (Bynara) ----------
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

    # ---------- Stage 3: Grounding ----------
    (grounding_top, g_meta), _g_err = await _run_stage(
        trace.trace_id, 2, run_grounding(db, payload.message_text, understanding.get("entities", {}))
    )
    if grounding_top is None:
        grounding_top = []
        g_meta = {"error": "grounding_failed"}
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"stages.2.metadata": {**g_meta, "top": grounding_top[:3]}}},
    )

    # ---------- Stage 4: Tool stubs (log only) ----------
    idem = make_idempotency_key(payload.customer_id, payload.message_text)
    tool_log: dict[str, object] = {}

    async def _tool_stage():
        # cek_stok for top1
        if grounding_top:
            tool_log["cek_stok"] = await tool_cek_stok(db, grounding_top[0]["sku"])

        # buat_draft_pesanan if intent mau_pesan and qty > 0
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
            # attach trace_id
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
        return tool_log

    _tools, _t_err = await _run_stage(trace.trace_id, 3, _tool_stage())
    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id}, {"$set": {"stages.3.metadata": {"tools": tool_log, "idempotency_key": idem}}}
    )

    # ---------- Finalize ----------
    total_ms = int((time.perf_counter() - total_started) * 1000)
    status = "clarification_needed" if need_clarification else ("pending_approval" if tool_log.get("draft") else "answered")
    draft = None
    if isinstance(tool_log.get("draft"), dict) and tool_log["draft"].get("ok"):
        draft = tool_log["draft"]["order"]

    await db.workflow_traces.update_one(
        {"trace_id": trace.trace_id},
        {"$set": {"total_duration_ms": total_ms, "status": status, "draft": draft}},
    )

    updated = await db.workflow_traces.find_one({"trace_id": trace.trace_id}, {"_id": 0})
    return {
        "trace_id": trace.trace_id,
        "status": status,
        "understanding": understanding,
        "grounding": grounding_top,
        "draft": draft,
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


# ---- Register router & middleware ----
app.include_router(api_router)

app.add_middleware(
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
