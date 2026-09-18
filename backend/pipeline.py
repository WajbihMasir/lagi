"""B2 pipeline: Understanding (LLM), Grounding (hybrid mock), Tool stubs.

- Bynara Router `agnes-2.5-flash` via OpenAI-compatible SDK.
- Graceful fallback template when Bynara unavailable (401/timeout/429/no-key).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from typing import Any

from openai import AsyncOpenAI, APIError, APITimeoutError, AuthenticationError, RateLimitError

logger = logging.getLogger(__name__)

_INTENT_LABELS = ["tanya_produk", "tanya_stok", "mau_pesan", "keluhan", "lainnya"]

_SYSTEM_PROMPT = (
    "Kamu adalah NLU TuntasUMKM. Klasifikasi intent dari pesan pelanggan (multi-label) "
    "dari daftar: tanya_produk, tanya_stok, mau_pesan, keluhan, lainnya. "
    "Ekstrak entity: nama_produk, jumlah, varian, alamat. "
    "Balas HANYA JSON valid dengan schema: "
    '{"intent":["..."],"entities":{"nama_produk":"","jumlah":0,"varian":"","alamat":""},"confidence":0.0}. '
    "Confidence rendah (<0.6) jika ragu. Bahasa Indonesia santai (gue/gw ok)."
)


def _bynara_client() -> AsyncOpenAI | None:
    key = os.environ.get("BYNARA_API_KEY", "").strip()
    base = os.environ.get("BYNARA_BASE", "https://router.bynara.id/v1").strip()
    if not key:
        return None
    return AsyncOpenAI(api_key=key, base_url=base, timeout=15.0)


def _heuristic_understanding(text: str) -> dict[str, Any]:
    """Lightweight fallback when LLM unavailable."""
    t = text.lower()
    intents: list[str] = []
    if any(k in t for k in ["stok", "ready", "ada gak", "ada ga", "masih ada"]):
        intents.append("tanya_stok")
    if any(k in t for k in ["mau pesan", "pesan", "order", "beli", "ambil", "checkout"]):
        intents.append("mau_pesan")
    if any(k in t for k in ["harga", "berapa", "varian", "info", "spec"]):
        intents.append("tanya_produk")
    if any(k in t for k in ["retur", "rusak", "kecewa", "komplain", "keluhan"]):
        intents.append("keluhan")
    if not intents:
        intents = ["lainnya"]

    qty_match = re.search(r"(\d+)\s*(pcs|box|paket|kg|pack)?", t)
    jumlah = int(qty_match.group(1)) if qty_match else 0

    varian = ""
    for v in ["balado", "pedas manis", "pedas", "original", "manis", "keju", "terasi", "cokelat"]:
        if v in t:
            varian = v
            break

    return {
        "intent": intents,
        "entities": {"nama_produk": "", "jumlah": jumlah, "varian": varian, "alamat": ""},
        "confidence": 0.55,
        "fallback": True,
    }


async def run_understanding(message_text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """Stage 2. Returns (parsed_result, metadata)."""
    started = time.perf_counter()
    meta: dict[str, Any] = {"model": os.environ.get("LLM_MODEL", "agnes-2.5-flash"), "provider": "bynara"}

    cli = _bynara_client()
    if cli is None:
        meta["fallback_reason"] = "no_api_key"
        parsed = _heuristic_understanding(message_text)
        meta["duration_ms"] = int((time.perf_counter() - started) * 1000)
        return parsed, meta

    try:
        resp = await cli.chat.completions.create(
            model=meta["model"],
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": message_text},
            ],
            temperature=0.1,
            max_tokens=256,
        )
        content = (resp.choices[0].message.content or "").strip()
        # Try direct JSON parse; if wrapped in ```json fence, strip fences.
        if content.startswith("```"):
            content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.MULTILINE).strip()
        parsed = json.loads(content)
        # Ensure schema shape
        parsed.setdefault("intent", ["lainnya"])
        parsed.setdefault("entities", {"nama_produk": "", "jumlah": 0, "varian": "", "alamat": ""})
        parsed.setdefault("confidence", 0.5)
        parsed["fallback"] = False
        meta["tokens"] = getattr(resp, "usage", None).total_tokens if getattr(resp, "usage", None) else None
    except (AuthenticationError, RateLimitError, APITimeoutError, APIError) as e:
        logger.warning("Bynara error, using fallback: %s", type(e).__name__)
        meta["fallback_reason"] = type(e).__name__
        parsed = _heuristic_understanding(message_text)
    except (json.JSONDecodeError, ValueError, KeyError, AttributeError) as e:
        logger.warning("Bynara parse error, using fallback: %s", e)
        meta["fallback_reason"] = f"parse_error:{type(e).__name__}"
        parsed = _heuristic_understanding(message_text)

    meta["duration_ms"] = int((time.perf_counter() - started) * 1000)
    return parsed, meta


# ---------- Stage 3: Grounding (hybrid mock: text + BM25-lite + RRF) ----------
_STOPWORDS = {"yang", "dan", "atau", "aku", "gue", "gw", "kak", "bu", "pak", "dong", "ya", "ini", "itu", "ada", "kah"}


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return [t for t in tokens if t not in _STOPWORDS and len(t) > 1]


def _bm25_lite_score(query_tokens: list[str], doc_text: str) -> float:
    doc_tokens = _tokenize(doc_text)
    if not doc_tokens or not query_tokens:
        return 0.0
    matches = sum(1 for q in query_tokens if q in doc_tokens)
    return matches / (len(query_tokens) ** 0.5)


def _rrf_merge(rank_lists: list[list[str]], k: int = 60) -> list[tuple[str, float]]:
    scores: dict[str, float] = {}
    for lst in rank_lists:
        for rank, sku in enumerate(lst, start=1):
            scores[sku] = scores.get(sku, 0.0) + 1.0 / (k + rank)
    return sorted(scores.items(), key=lambda x: x[1], reverse=True)


async def run_grounding(db, message_text: str, entities: dict[str, Any]) -> tuple[list[dict], dict[str, Any]]:
    """Stage 3 hybrid retrieval (no Atlas vector). Returns (top_docs, metadata)."""
    started = time.perf_counter()
    tokens = _tokenize(message_text)
    if entities.get("nama_produk"):
        tokens += _tokenize(entities["nama_produk"])

    # 1) Text search on name/description via regex OR
    text_hits: list[dict] = []
    if tokens:
        or_clauses = [{"name": {"$regex": t, "$options": "i"}} for t in tokens]
        or_clauses += [{"description": {"$regex": t, "$options": "i"}} for t in tokens]
        cursor = db.products.find({"$or": or_clauses}, {"_id": 0}).limit(20)
        text_hits = await cursor.to_list(length=20)

    # 2) Exact SKU boost
    sku_hits: list[dict] = []
    sku_match = re.findall(r"[A-Z]{2,4}-\d{1,3}", message_text.upper())
    if sku_match:
        cursor = db.products.find({"sku": {"$in": sku_match}}, {"_id": 0})
        sku_hits = await cursor.to_list(length=10)

    # 3) BM25-lite over text_hits pool for local ranking
    pool = {p["sku"]: p for p in text_hits + sku_hits}
    bm25_ranked = sorted(
        pool.values(),
        key=lambda p: _bm25_lite_score(tokens, f"{p['name']} {p['description']} {p['category']}"),
        reverse=True,
    )

    # 4) RRF merge: [text_order, sku_order, bm25_order]
    rank_lists = [
        [p["sku"] for p in text_hits],
        [p["sku"] for p in sku_hits],
        [p["sku"] for p in bm25_ranked],
    ]
    merged = _rrf_merge(rank_lists)
    top3_skus = [sku for sku, _ in merged[:3]]
    top3 = [pool[s] for s in top3_skus if s in pool]

    meta = {
        "duration_ms": int((time.perf_counter() - started) * 1000),
        "text_hits": len(text_hits),
        "sku_hits": len(sku_hits),
        "rrf_top": top3_skus,
        "policy": "db_wins_on_stock_price",
    }
    return top3, meta


# ---------- Stage 4: Tool stubs (idempotent via idempotency_key) ----------
def make_idempotency_key(customer_id: str, message_text: str) -> str:
    return hashlib.sha256(f"{customer_id}|{message_text.strip().lower()}".encode()).hexdigest()[:24]


async def tool_cek_stok(db, product_id: str) -> dict[str, Any]:
    doc = await db.products.find_one({"sku": product_id}, {"_id": 0})
    if not doc:
        return {"ok": False, "error": "not_found", "sku": product_id}
    return {"ok": True, "sku": product_id, "stock": doc["stock"], "price": doc["price"], "name": doc["name"]}


async def tool_hitung_ongkir(items: list[dict]) -> dict[str, Any]:
    # Mock formula: base 15k + 500/pcs, capped 50k
    total_qty = sum(int(it.get("qty", 0)) for it in items)
    ongkir = min(50000, 15000 + 500 * total_qty)
    return {"ok": True, "total_qty": total_qty, "ongkir": ongkir}


async def tool_buat_draft_pesanan(
    db, customer_id: str, items: list[dict], idempotency_key: str
) -> dict[str, Any]:
    # Idempotent lookup by (customer_id, idempotency_key)
    existing = await db.orders.find_one(
        {"customer_id": customer_id, "idempotency_key": idempotency_key}, {"_id": 0}
    )
    if existing:
        return {"ok": True, "order": existing, "idempotent_hit": True}

    # Enrich items with unit_price from DB, validate stock
    enriched: list[dict] = []
    subtotal = 0
    for it in items:
        sku = it.get("product_id") or it.get("sku")
        qty = int(it.get("qty", 0))
        prod = await db.products.find_one({"sku": sku}, {"_id": 0}) if sku else None
        if not prod or qty <= 0:
            continue
        unit_price = prod["price"]
        enriched.append({"product_id": sku, "qty": qty, "unit_price": unit_price, "name": prod["name"]})
        subtotal += unit_price * qty

    ongkir_r = await tool_hitung_ongkir(enriched)
    total = subtotal + ongkir_r["ongkir"]

    # Generate TU-xxx order id (numeric suffix from count + 2500)
    count = await db.orders.count_documents({})
    order_id = f"TU-{2500 + count:04d}"

    doc = {
        "order_id": order_id,
        "customer_id": customer_id,
        "items": enriched,
        "subtotal": subtotal,
        "ongkir": ongkir_r["ongkir"],
        "total": total,
        "status": "pending_approval",
        "approval_trace": [],
        "trace_id": "",  # set by caller
        "idempotency_key": idempotency_key,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    await db.orders.insert_one({**doc})
    return {"ok": True, "order": doc, "idempotent_hit": False}
