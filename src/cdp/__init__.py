"""CDP integration for the Hearthstone Box recommendation callbacks."""

from .hsbox_events import (
    ALLOWED_CALLBACKS,
    FRONTEND_ACTION_NAMES,
    CdpEventError,
    HsboxRecommendationEvent,
    HsboxTarget,
    event_key,
    parse_event,
)

__all__ = [
    "ALLOWED_CALLBACKS",
    "FRONTEND_ACTION_NAMES",
    "CdpEventError",
    "HsboxRecommendationEvent",
    "HsboxTarget",
    "event_key",
    "parse_event",
]
