"""Convert real HSBox callback payloads into the existing action protocol."""

from __future__ import annotations

import json
import time
from typing import Any, Mapping

from src.recommendation_models import ActionKind, ProposedAction, SlotRef

from .hsbox_events import HsboxRecommendationEvent, event_key


class CdpRecommendationError(ValueError):
    """A recommendation cannot be safely converted to an existing action."""


_HAND_CARD_ACTIONS = {
    "play_minion": "MINION",
    "play_special": "SPECIAL",
}


def _as_positive_int(value: Any, code: str) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError) as exc:
        raise CdpRecommendationError(code) from exc
    if result <= 0:
        raise CdpRecommendationError(code)
    return result


def _card_slot(card: Any) -> int:
    if not isinstance(card, Mapping):
        raise CdpRecommendationError("card_missing")
    return _as_positive_int(card.get("ZONE_POSITION"), "card_zone_position_missing")


def _json_instruction(action: Mapping[str, Any]) -> str:
    return json.dumps(action, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"))


def _created_at(event: HsboxRecommendationEvent) -> float:
    try:
        return datetime_from_iso(event.captured_at)
    except (TypeError, ValueError, OverflowError):
        return time.time()


def datetime_from_iso(value: str) -> float:
    from datetime import datetime

    text = str(value).replace("Z", "+00:00")
    parsed = datetime.fromisoformat(text)
    return parsed.timestamp()


def _base_action(
    event: HsboxRecommendationEvent,
    action: Mapping[str, Any],
    action_kind: ActionKind,
    *,
    action_index: int,
    source: SlotRef | None = None,
    mulligan_slots: tuple[int, ...] = (),
    card_type: str | None = None,
    log_revision: int = 0,
) -> ProposedAction:
    turn = event.turn_number
    if turn is None or turn < 0:
        raise CdpRecommendationError("turn_number_missing")
    raw = _json_instruction(action)
    key = event_key(event, action_index)
    return ProposedAction(
        action_id=f"cdp-{key}",
        frame_id=f"cdp:{key}",
        created_at=_created_at(event),
        turn_number=turn,
        log_revision=int(log_revision),
        raw_instruction=raw,
        normalized_instruction=raw,
        action=action_kind,
        source=source,
        mulligan_slots=mulligan_slots,
        card_type=card_type,
        ocr_confidence=1.0,
        semantic_confidence=1.0,
    )


def adapt_action(
    event: HsboxRecommendationEvent,
    action: Mapping[str, Any],
    *,
    action_index: int = 0,
    log_revision: int = 0,
) -> ProposedAction:
    """Adapt the known real payloads without guessing target semantics.

    The first implementation deliberately handles the four actions present in
    the supplied live JSON.  Other frontend action names are rejected here so
    the flow can journal and pause instead of clicking an unverified target.
    """
    if not event.is_ready:
        raise CdpRecommendationError("recommendation_not_ready")
    name = str(action.get("actionName") or "")
    if name == "replace":
        cards = action.get("card")
        if not isinstance(cards, list):
            raise CdpRecommendationError("replace_cards_missing")
        slots = tuple(_card_slot(card) for card in cards)
        return _base_action(
            event, action, ActionKind.MULLIGAN, action_index=action_index,
            mulligan_slots=slots, log_revision=log_revision,
        )
    if name in _HAND_CARD_ACTIONS:
        card = action.get("card")
        slot = _card_slot(card)
        return _base_action(
            event, action, ActionKind.PLAY_CARD, action_index=action_index,
            source=SlotRef("hand_slot", "friendly", slot),
            card_type=_HAND_CARD_ACTIONS[name], log_revision=log_revision,
        )
    if name == "end_turn":
        return _base_action(
            event, action, ActionKind.END_TURN, action_index=action_index,
            log_revision=log_revision,
        )
    raise CdpRecommendationError(f"unsupported_hsbox_action:{name or 'missing'}")


def adapt_event(
    event: HsboxRecommendationEvent,
    *,
    action_index: int = 0,
    log_revision: int = 0,
) -> ProposedAction:
    actions = event.action_items()
    if not actions:
        raise CdpRecommendationError("recommendation_actions_empty")
    if not 0 <= int(action_index) < len(actions):
        raise CdpRecommendationError("recommendation_action_index")
    return adapt_action(
        event, actions[int(action_index)], action_index=int(action_index),
        log_revision=log_revision,
    )


def supported_live_action_names() -> frozenset[str]:
    return frozenset({"replace", "play_minion", "play_special", "end_turn"})
