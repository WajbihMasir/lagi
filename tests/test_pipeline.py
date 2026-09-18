"""Pytest suite — TuntasUMKM B3/B4.

Covers:
- intake dedup (409 on 2nd same-message)
- Bynara mock understanding fallback (no key → heuristic)
- approval flow (approve/reject/modify + stock decrement)
- approval timeout cascade (fast unit-test path, patched sleeps)
- analytics endpoints
- idempotency (2nd draft returns same order)
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime, timezone

import httpx
import pytest
import pytest_asyncio
from motor.motor_asyncio import AsyncIOMotorClient

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_database")
os.environ.setdefault("TEST_TIMEOUT", "1")

# Import after env vars set
from server import app as asgi_app, db as global_db  # noqa: E402
from pipeline import (  # noqa: E402
    make_idempotency_key,
    tool_buat_draft_pesanan,
    run_understanding,
)


@pytest_asyncio.fixture(scope="module")
async def client():
    transport = httpx.ASGITransport(app=asgi_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        # ensure seed
        await c.post("/api/seed")
        yield c


@pytest.mark.asyncio
async def test_intake_dedup(client):
    payload = {
        "customer_id": f"pytest-{uuid.uuid4().hex[:6]}",
        "message_text": "halo mau pesan 2 sambal roa",
        "channel": "WhatsApp",
    }
    r1 = await client.post("/api/chat/intake", json=payload)
    assert r1.status_code == 200, r1.text
    r2 = await client.post("/api/chat/intake", json=payload)
    assert r2.status_code == 409
    body = r2.json()
    assert "duplicate" in body.get("detail", {}).get("error", "")


@pytest.mark.asyncio
async def test_understanding_fallback_no_key():
    """When BYNARA_API_KEY missing, heuristic fallback returns valid schema."""
    saved = os.environ.pop("BYNARA_API_KEY", None)
    try:
        parsed, meta = await run_understanding("mau pesan 12 keripik pisang balado")
        assert parsed["fallback"] is True
        assert "mau_pesan" in parsed["intent"]
        assert parsed["entities"]["jumlah"] == 12
        assert meta["fallback_reason"] in ("no_api_key",) or meta.get("fallback_reason", "").startswith("parse_")
    finally:
        if saved:
            os.environ["BYNARA_API_KEY"] = saved


@pytest.mark.asyncio
async def test_idempotency_no_double_order():
    key = make_idempotency_key("pytest-idem", "order test idempotent")
    r1 = await tool_buat_draft_pesanan(
        global_db, "pytest-idem", [{"product_id": "KCT-03", "qty": 2}], key,
    )
    r2 = await tool_buat_draft_pesanan(
        global_db, "pytest-idem", [{"product_id": "KCT-03", "qty": 2}], key,
    )
    assert r1["order"]["order_id"] == r2["order"]["order_id"]
    assert r2["idempotent_hit"] is True


@pytest.mark.asyncio
async def test_approval_flow_approve_reduces_stock(client):
    # create order via chat/intake
    cust = f"pytest-apv-{uuid.uuid4().hex[:6]}"
    r = await client.post("/api/chat/intake", json={
        "customer_id": cust,
        "message_text": "pesan 3 keripik tempe original",
        "channel": "WhatsApp",
    })
    assert r.status_code == 200
    body = r.json()
    apv_id = body.get("approval_id")
    assert apv_id, "approval_id must be present on draft creation"

    # Stock before
    pr = await client.get("/api/products/KTP-05")
    stock_before = pr.json()["stock"]

    # Approve
    ap = await client.post(f"/api/approvals/{apv_id}/approve", json={"reason": "ok"})
    assert ap.status_code == 200
    body = ap.json()
    assert body["approval"]["status"] == "approved"
    assert body["order"]["status"] == "approved"

    pr2 = await client.get("/api/products/KTP-05")
    assert pr2.json()["stock"] == stock_before - 3


@pytest.mark.asyncio
async def test_approval_reject(client):
    cust = f"pytest-rej-{uuid.uuid4().hex[:6]}"
    r = await client.post("/api/chat/intake", json={
        "customer_id": cust,
        "message_text": "beli 4 kacang telur gurih",
        "channel": "WhatsApp",
    })
    apv_id = r.json()["approval_id"]
    rj = await client.post(f"/api/approvals/{apv_id}/reject", json={"reason": "stok kritis"})
    assert rj.status_code == 200
    assert rj.json()["approval"]["status"] == "rejected"
    assert rj.json()["order"]["status"] == "rejected"


@pytest.mark.asyncio
async def test_approval_modify(client):
    cust = f"pytest-mod-{uuid.uuid4().hex[:6]}"
    r = await client.post("/api/chat/intake", json={
        "customer_id": cust,
        "message_text": "order 2 rengginang original",
        "channel": "WhatsApp",
    })
    apv_id = r.json()["approval_id"]
    md = await client.post(f"/api/approvals/{apv_id}/modify", json={
        "reason": "adjust qty",
        "items": [{"product_id": "RNG-04", "qty": 5}],
    })
    assert md.status_code == 200
    body = md.json()
    assert body["approval"]["status"] == "modified"
    assert body["order"]["items"][0]["qty"] == 5


@pytest.mark.asyncio
async def test_approval_timeout_cascade(monkeypatch, client):
    """Patch _approval_timeout_task delay constants to trigger auto_hold quickly."""
    import server
    monkeypatch.setattr(server, "REMINDER_AFTER", 0.05)
    monkeypatch.setattr(server, "AUTO_RESPONSE_AFTER", 0.1)
    monkeypatch.setattr(server, "AUTO_HOLD_AFTER", 0.2)

    cust = f"pytest-tmo-{uuid.uuid4().hex[:6]}"
    r = await client.post("/api/chat/intake", json={
        "customer_id": cust,
        "message_text": "pesan 1 paket oleh oleh mix",
        "channel": "WhatsApp",
    })
    apv_id = r.json()["approval_id"]

    # Fire timeout task with patched constants
    asyncio.create_task(server._approval_timeout_task(apv_id))
    await asyncio.sleep(0.5)

    a = await client.get("/api/approvals", params={"status": "auto_hold"})
    ids = [i["approval_id"] for i in a.json()["items"]]
    assert apv_id in ids, f"expected auto_hold, got {a.json()}"


@pytest.mark.asyncio
async def test_analytics_endpoints(client):
    for path in [
        "/api/analytics/summary",
        "/api/analytics/intent-dist",
        "/api/analytics/response-time",
        "/api/analytics/top-products",
        "/api/analytics?period=today",
        "/api/analytics?period=week",
    ]:
        r = await client.get(path)
        assert r.status_code == 200, path
        data = r.json()
        assert "period" in data or "items" in data or "kpi" in data


@pytest.mark.asyncio
async def test_analytics_export_csv(client):
    r = await client.get("/api/analytics/export?period=today")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    text = r.text
    assert "TuntasUMKM Analytics Export" in text
    assert "KPI" in text
