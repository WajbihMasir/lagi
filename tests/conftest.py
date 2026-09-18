"""Pytest config — force asyncio_mode=auto and session-scoped loop
so Motor's AsyncIOMotorClient (created at server.py import) stays on one loop
across all tests.
"""
import asyncio
import os

import pytest

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ.setdefault("DB_NAME", "test_database")
os.environ.setdefault("TEST_TIMEOUT", "1")


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()
