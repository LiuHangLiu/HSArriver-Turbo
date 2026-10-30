import unittest

from src.cdp.hsbox_events import HsboxEventStore, parse_event
from src.cdp.recommendation_reader import (
    CdpCapture,
    CdpRecommendationParser,
    CdpRecommendationReader,
)
from src.recommendation_models import ActionKind


def event_with_actions(actions):
    return parse_event({
        "schema": 1,
        "kind": "recommendation",
        "callback": "onUpdateLadderActionRecommend",
        "captured_at": "2026-10-29T13:45:51.224Z",
        "target": {"id": "t1", "url": "https://hs-web.lushi.163.com/client-battle/"},
        "payload": {
            "status": 2, "error": "", "turnNum": 2,
            "optionId": 3, "choiceId": -1, "data": actions,
        },
        "raw_args": [],
    })


class CdpReaderTests(unittest.TestCase):
    def test_reader_advances_multi_action_callback_only_after_consumed(self):
        store = HsboxEventStore()
        reader = CdpRecommendationReader(store, wait_timeout=0.2)
        parser = CdpRecommendationParser()
        event = event_with_actions([
            {"actionName": "play_special", "card": {"ZONE_POSITION": 4}},
            {"actionName": "end_turn"},
        ])
        store.publish(event)

        first = reader.read(lambda: None, lambda _: None)
        self.assertEqual(ActionKind.PLAY_CARD,
                         parser.parse(first, 2, 10).action)
        same = reader.read(lambda: None, lambda _: None)
        self.assertEqual(first.normalized_text, same.normalized_text)

        first_action = parser.parse(first, 2, 10)
        reader.mark_consumed(first_action)
        second = reader.read(lambda: None, lambda _: None)
        self.assertNotEqual(first.normalized_text, second.normalized_text)
        self.assertEqual(ActionKind.END_TURN,
                         parser.parse(second, 2, 10).action)

    def test_capture_uses_window_guard_without_screenshot(self):
        store = HsboxEventStore()
        reader = CdpRecommendationReader(store, wait_timeout=0.2)
        store.publish(event_with_actions([{"actionName": "end_turn"}]))
        reader.read(lambda: None, lambda _: None)
        capture = CdpCapture(reader, window_reader=lambda: (42, True, None))
        frame = capture.capture()
        self.assertEqual(42, frame.window_handle)
        self.assertTrue(frame.foreground)
        self.assertTrue(frame.panel_visible)
        self.assertIsNone(frame.pixels)


if __name__ == "__main__":
    unittest.main()
