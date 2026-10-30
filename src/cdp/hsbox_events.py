"""Pure data handling for the HSBox CEF callback events.

The browser page receives JSON strings through window callbacks.  This module
does not connect to CDP and does not perform game actions; it only validates,
normalizes and journals the data so that the rest of the project can consume a
stable event shape.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import threading
import time
from typing import Any, Iterable, Mapping, Optional


ALLOWED_CALLBACKS = frozenset({
    "onUpdateArenaRecommend",
    "onUpdateLadderActionRecommend",
    "onUpdateWinrateData",
})

FRONTEND_ACTION_NAMES = frozenset({
    "end_turn",
    "replace",
    "play_minion",
    "play_special",
    "play_weapon",
    "play_hero",
    "play_location",
    "forge",
    "trade",
    "prepare",
    "hero_attack",
    "minion_attack",
    "hero_skill",
    "titan_power",
    "location_power",
    "launch_starship",
    "common_action",
    "choice",
    "choose",
    "discard",
    "assemble",
})

_KEY_ALIASES = {
    "opp-target-hero": "oppTargetHero",
    "opp-target": "oppTarget",
    "target-hero": "targetHero",
}


class CdpEventError(ValueError):
    """Raised when a CDP event is malformed or unsafe to consume."""


@dataclass(frozen=True)
class HsboxTarget:
    id: str
    url: str
    title: str = ""


@dataclass(frozen=True)
class HsboxRecommendationEvent:
    schema: int
    kind: str
    callback: str
    captured_at: str
    target: HsboxTarget
    payload: Any
    raw_args: tuple[Any, ...] = ()
    raw: Optional[dict[str, Any]] = None

    @property
    def turn_number(self) -> Optional[int]:
        if not isinstance(self.payload, Mapping):
            return None
        value = self.payload.get("turnNum")
        try:
            return int(value) if value is not None else None
        except (TypeError, ValueError):
            return None

    @property
    def status(self) -> Any:
        return self.payload.get("status") if isinstance(
            self.payload, Mapping) else None

    @property
    def error(self) -> str:
        value = self.payload.get("error", "") if isinstance(
            self.payload, Mapping) else ""
        return str(value or "")

    @property
    def is_recommendation(self) -> bool:
        return self.kind == "recommendation"

    @property
    def is_ready(self) -> bool:
        """Whether the payload is a usable recommendation update.

        The sample events use status=2 and an empty error.  Other statuses are
        kept in the journal but never become executable actions.
        """
        return (self.is_recommendation and self.status == 2
                and not self.error)

    def action_items(self) -> tuple[dict[str, Any], ...]:
        if not self.is_ready:
            return ()
        data = self.payload.get("data")
        if data is None:
            return ()
        if not isinstance(data, list):
            raise CdpEventError("recommendation_data_not_array")
        actions = []
        for item in data:
            if not isinstance(item, Mapping):
                raise CdpEventError("recommendation_action_not_object")
            action = dict(item)
            name = action.get("actionName")
            if not isinstance(name, str) or not name:
                raise CdpEventError("recommendation_action_name_missing")
            actions.append(action)
        return tuple(actions)


def _normalize_keys(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            _KEY_ALIASES.get(str(key), str(key)): _normalize_keys(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_normalize_keys(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_normalize_keys(item) for item in value)
    return value


def parse_callback_payload(value: Any) -> Any:
    """Parse the callback's first argument when it is a JSON string."""
    if not isinstance(value, str):
        return value
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def _as_target(value: Any) -> HsboxTarget:
    if not isinstance(value, Mapping):
        raise CdpEventError("target_missing")
    target_id = str(value.get("id") or "")
    url = str(value.get("url") or "")
    if not target_id or not url:
        raise CdpEventError("target_identity_missing")
    return HsboxTarget(target_id, url, str(value.get("title") or ""))


def _captured_at(value: Any) -> str:
    if isinstance(value, str) and value.strip():
        return value
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_event(value: str | Mapping[str, Any]) -> HsboxRecommendationEvent:
    """Parse one JSONL event emitted by the reference collector."""
    if isinstance(value, str):
        try:
            raw = json.loads(value)
        except json.JSONDecodeError as exc:
            raise CdpEventError("event_json_invalid") from exc
    else:
        raw = dict(value)
    if not isinstance(raw, Mapping):
        raise CdpEventError("event_not_object")
    schema = raw.get("schema")
    if schema != 1:
        raise CdpEventError("event_schema_unsupported")
    callback = str(raw.get("callback") or "")
    if callback not in ALLOWED_CALLBACKS:
        raise CdpEventError("callback_unsupported")
    kind = str(raw.get("kind") or "")
    if kind not in {"status", "recommendation", "winrate", "error"}:
        raise CdpEventError("event_kind_invalid")
    payload = _normalize_keys(raw.get("payload"))
    raw_args = raw.get("raw_args")
    if raw_args is None:
        raw_args_tuple = ()
    elif isinstance(raw_args, list):
        raw_args_tuple = tuple(raw_args)
    else:
        raise CdpEventError("raw_args_not_array")
    return HsboxRecommendationEvent(
        schema=1,
        kind=kind,
        callback=callback,
        captured_at=_captured_at(raw.get("captured_at")),
        target=_as_target(raw.get("target")),
        payload=payload,
        raw_args=raw_args_tuple,
        raw=dict(raw),
    )


def event_key(event: HsboxRecommendationEvent, action_index: int = 0) -> str:
    """Return a stable key for deduplicating one event/action pair."""
    payload = json.dumps(
        event.payload, ensure_ascii=False, sort_keys=True,
        separators=(",", ":"), default=str,
    )
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]
    option = event.payload.get("optionId") if isinstance(
        event.payload, Mapping) else None
    choice = event.payload.get("choiceId") if isinstance(
        event.payload, Mapping) else None
    turn = event.turn_number
    return ":".join([
        event.target.id, event.callback, str(turn), str(option),
        str(choice), str(action_index), digest,
    ])


class HsboxEventJournal:
    """Bounded JSONL journal used for diagnostics and later adaptation."""

    def __init__(
        self,
        path: str | Path | None = None,
        *,
        max_bytes: int = 2 * 1024 * 1024,
        keep_bytes: int = 512 * 1024,
        trim_interval: float = 60.0,
    ):
        self.path = Path(path) if path else None
        self.max_bytes = max(0, int(max_bytes))
        self.keep_bytes = max(0, int(keep_bytes))
        self.trim_interval = max(0.0, float(trim_interval))
        self._last_trim_at = 0.0
        self._lock = threading.Lock()

    def _trim_if_needed(self) -> None:
        if self.path is None or self.max_bytes <= 0 or self.keep_bytes <= 0:
            return
        now = time.monotonic()
        if now - self._last_trim_at < self.trim_interval:
            return
        try:
            size = self.path.stat().st_size
            if size <= self.max_bytes:
                return
            with self.path.open("rb") as handle:
                handle.seek(max(0, size - self.keep_bytes))
                tail = handle.read()
            # 丢弃尾部截取产生的半行，保证 journal 仍是合法 JSONL。
            if b"\n" in tail:
                tail = tail[tail.find(b"\n") + 1:]
            if not tail:
                # 单条 raw 事件可能比 keep_bytes 还长；这种情况下保留最后
                # 一条完整事件，而不是把 journal 裁成空文件。
                tail = self.path.read_bytes().splitlines(keepends=True)[-1:]
            tmp = self.path.with_suffix(self.path.suffix + ".tmp")
            tmp.write_bytes(b"".join(tail) if isinstance(tail, list) else tail)
            tmp.replace(self.path)
            self._last_trim_at = now
        except OSError:
            # 诊断日志不能影响推荐主链路；下一次 append 再尝试裁剪。
            return

    def append(self, value: HsboxRecommendationEvent | Mapping[str, Any]) -> None:
        if self.path is None:
            return
        if isinstance(value, HsboxRecommendationEvent):
            raw = value.raw or {
                "schema": value.schema,
                "kind": value.kind,
                "callback": value.callback,
                "captured_at": value.captured_at,
                "target": {
                    "id": value.target.id,
                    "url": value.target.url,
                    "title": value.target.title,
                },
                "payload": value.payload,
                "raw_args": list(value.raw_args),
            }
        else:
            raw = dict(value)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        line = json.dumps(raw, ensure_ascii=False, separators=(",", ":"))
        with self._lock:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")
            self._trim_if_needed()


class HsboxEventStore:
    """Thread-safe latest-event store for a CDP listener and flow reader."""

    def __init__(self, journal: HsboxEventJournal | None = None):
        self.journal = journal or HsboxEventJournal()
        self._condition = threading.Condition()
        self._latest: HsboxRecommendationEvent | None = None
        self._sequence = 0

    def publish(self, event: HsboxRecommendationEvent) -> int:
        self.journal.append(event)
        with self._condition:
            self._latest = event
            self._sequence += 1
            sequence = self._sequence
            self._condition.notify_all()
            return sequence

    def snapshot(self) -> tuple[int, HsboxRecommendationEvent | None]:
        with self._condition:
            return self._sequence, self._latest
    def wait_for_change(
        self, sequence: int, timeout: float | None = None,
    ) -> tuple[int, HsboxRecommendationEvent | None]:
        with self._condition:
            if self._sequence <= sequence:
                self._condition.wait(timeout)
            return self._sequence, self._latest
