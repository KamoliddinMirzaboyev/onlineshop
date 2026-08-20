import json
from typing import Any

from app.core.redis import redis_client

# Redis Pub/Sub channel name for courier events
_COURIER_CHANNEL = "courier:events"


def publish(event: dict[str, Any]) -> None:
    """Publish event to Redis channel (works across all gunicorn workers)."""
    try:
        redis_client.publish(_COURIER_CHANNEL, json.dumps(event))
    except Exception:
        pass  # fail-open


def subscribe() -> Any:
    """Return a Redis PubSub object for listening."""
    ps = redis_client.pubsub()
    ps.subscribe(_COURIER_CHANNEL)
    return ps


def unsubscribe(ps) -> None:
    """Unsubscribe and close the PubSub connection."""
    try:
        ps.unsubscribe(_COURIER_CHANNEL)
        ps.close()
    except Exception:
        pass


# Backward-compatible wrapper so existing `courier_events.publish(...)` calls keep working
class _CourierEvents:
    def publish(self, event: dict[str, Any]) -> None:
        publish(event)

    def subscribe(self) -> Any:
        return subscribe()

    def unsubscribe(self, ps) -> None:
        unsubscribe(ps)


courier_events = _CourierEvents()
