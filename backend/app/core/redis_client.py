"""
Async Redis client singleton for Trakvora.

Usage:
    from app.core.redis_client import get_redis, close_redis

    redis = await get_redis()
    await redis.set("key", "value", ex=60)
"""
from __future__ import annotations

import logging

import redis.asyncio as aioredis

from app.config import settings

logger = logging.getLogger(__name__)

_client: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    """Return the shared Redis client, creating it on first call."""
    global _client
    if _client is None:
        _client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
    return _client


async def close_redis() -> None:
    """Close the Redis connection (call on app shutdown)."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
        logger.info("Redis connection closed")
