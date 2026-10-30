"""Reader/capture shims that let the existing RecommendationFlow consume CDP."""

from __future__ import annotations

from dataclasses import dataclass
import hashlib
import threading
import time
from typing import Any, Callable

from src.recommendation_models import FrameEvidence, ProposedAction

from .hsbox_events import HsboxEventStore, HsboxRecommendationEvent, event_key
from .recommendation_adapter import adapt_event


class CdpReaderError(RuntimeError):
    pass


@dataclass(frozen=True)
class CdpEvidence:
    frame_id: str
    created_at: float
    normalized_text: str
    confidence: float
    backend: str
    event: HsboxRecommendationEvent
    action_index: int


def _event_is_usable(event: HsboxRecommendationEvent | None) -> bool:
    return bool(event is not None and event.is_ready and event.action_items())


class CdpRecommendationReader:
    """Expose one live CDP action at a time through the OCR reader shape."""

    def __init__(self, store: HsboxEventStore, wait_timeout: float = 5.0):
        self.store = store
        self.wait_timeout = max(0.1, float(wait_timeout))
        self._lock = threading.Lock()
        self._sequence = 0
        self._event: HsboxRecommendationEvent | None = None
        self._action_index = 0
        self._active_key = ""
        self._completed_keys: set[str] = set()

    @property
    def current_event(self) -> HsboxRecommendationEvent | None:
        with self._lock:
            return self._event

    @property
    def current_action_index(self) -> int:
        with self._lock:
            return self._action_index

    def _evidence_locked(self) -> CdpEvidence:
        event = self._event
        if not _event_is_usable(event):
            raise CdpReaderError("recommendation_not_available")
        key = event_key(event, self._action_index)
        try:
            event.action_items()[self._action_index]
        except IndexError as exc:
            raise CdpReaderError("recommendation_actions_consumed") from exc
        return CdpEvidence(
            frame_id=f"cdp:{key}",
            created_at=time.time(),
            normalized_text=key,
            confidence=1.0,
            backend="cdp",
            event=event,
            action_index=self._action_index,
        )

    def _set_event(self, sequence: int, event: HsboxRecommendationEvent) -> bool:
        if not _event_is_usable(event):
            return False
        key = event_key(event, 0)
        with self._lock:
            if key in self._completed_keys:
                self._sequence = max(self._sequence, sequence)
                return False
            self._sequence = sequence
            self._event = event
            self._action_index = 0
            self._active_key = key
            return True

    def read(self, frame_supplier: Callable[[], Any], roi_supplier: Callable) -> CdpEvidence:
        """Wait for a new usable callback; frame/ROI arguments are ignored."""
        del frame_supplier, roi_supplier
        deadline = time.monotonic() + self.wait_timeout
        while time.monotonic() < deadline:
            sequence, event = self.store.snapshot()
            should_set = False
            with self._lock:
                if (event is not None and sequence == self._sequence
                        and self._event is event):
                    try:
                        return self._evidence_locked()
                    except CdpReaderError as exc:
                        if str(exc) != "recommendation_actions_consumed":
                            raise
                elif event is not None and sequence > self._sequence:
                    should_set = True
            if should_set and self._set_event(sequence, event):
                with self._lock:
                    return self._evidence_locked()
            remaining = max(0.01, deadline - time.monotonic())
            self.store.wait_for_change(sequence, min(remaining, 0.25))
        raise CdpReaderError("recommendation_wait_timeout")

    def read_frame(self, frame: Any, roi_supplier: Callable) -> CdpEvidence:
        del frame, roi_supplier
        with self._lock:
            return self._evidence_locked()

    def mark_consumed(self, proposed: ProposedAction | None = None) -> None:
        """Advance a multi-action callback after the existing flow succeeds."""
        with self._lock:
            if self._event is None:
                return
            current = self._evidence_locked()
            if proposed is not None and proposed.action_id != f"cdp-{event_key(self._event, current.action_index)}":
                return
            current_key = event_key(self._event, self._action_index)
            self._completed_keys.add(current_key)
            self._action_index += 1
            if self._action_index >= len(self._event.action_items()):
                self._completed_keys.add(event_key(self._event, 0))


class CdpCapture:
    """Evidence facade for RecommendationValidator without taking screenshots."""

    def __init__(self, reader: CdpRecommendationReader,
                 window_reader: Callable[[], tuple[int, bool, Any]] | None = None):
        self.reader = reader
        self.window_reader = window_reader or self._default_window_reader
        self.last_frame: FrameEvidence | None = None

    @staticmethod
    def _default_window_reader() -> tuple[int, bool, Any]:
        try:
            import win32gui
            from get_screen import get_HS_hwnd, is_allowed_hearthstone_foreground

            hwnd = int(get_HS_hwnd() or 0)
            foreground = bool(
                hwnd and is_allowed_hearthstone_foreground(
                    hwnd, win32gui.GetForegroundWindow()))
            return hwnd, foreground, None
        except Exception:
            return 0, False, None

    def capture(self, ocr_panel_ok: bool = False) -> FrameEvidence:
        del ocr_panel_ok
        evidence = self.reader.read_frame(None, None)
        hwnd, foreground, client_size = self.window_reader()
        if not hwnd:
            raise CdpReaderError("hearthstone_window_missing")
        if not foreground:
            raise CdpReaderError("hearthstone_not_foreground")
        digest = hashlib.sha256(evidence.frame_id.encode("utf-8")).hexdigest()
        frame = FrameEvidence(
            frame_id=evidence.frame_id,
            captured_at=evidence.created_at,
            desktop_size=(1920, 1080),
            dpi=96,
            window_handle=int(hwnd),
            foreground=bool(foreground),
            recommendation_roi=(0, 0, 0, 0),
            exact_hash=digest,
            perceptual_hash=digest[:16],
            panel_visible=True,
            pixels=None,
            client_size=client_size,
        )
        self.last_frame = frame
        return frame

    @staticmethod
    def crop_recommendation(frame: FrameEvidence) -> None:
        del frame
        return None


class CdpRecommendationParser:
    """Parser facade matching RecommendationFlow's OCR parser contract."""

    def parse(self, evidence: CdpEvidence, turn_number: int,
              log_revision: int) -> ProposedAction:
        if not isinstance(evidence, CdpEvidence):
            raise CdpReaderError("cdp_evidence_required")
        if int(turn_number) != int(evidence.event.turn_number or -1):
            raise CdpReaderError("turn_changed")
        return adapt_event(
            evidence.event, action_index=evidence.action_index,
            log_revision=log_revision,
        )
