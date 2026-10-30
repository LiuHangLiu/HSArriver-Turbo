import unittest

from src.cdp.hsbox_events import parse_event
from src.cdp.recommendation_adapter import (
    CdpRecommendationError,
    adapt_event,
    supported_live_action_names,
)
from src.recommendation_models import ActionKind


TARGET = {
    "id": "target-1",
    "url": "https://hs-web-embed.lushi.163.com/client-jipaiqi/ladder-opp",
}


def make_event(data, turn=2):
    return parse_event({
        "schema": 1,
        "kind": "recommendation",
        "callback": "onUpdateLadderActionRecommend",
        "captured_at": "2026-10-29T13:45:51.224Z",
        "target": TARGET,
        "payload": {
            "status": 2, "error": "", "turnNum": turn,
            "optionId": 2, "choiceId": -1, "data": data,
        },
        "raw_args": [],
    })


class CdpRecommendationAdapterTests(unittest.TestCase):
    def test_maps_real_replace_event_to_mulligan(self):
        event = make_event([{
            "actionName": "replace",
            "card": [
                {"ZONE_POSITION": 1, "cardId": "GDB_310"},
                {"ZONE_POSITION": 3, "cardId": "SW_444"},
            ],
        }], turn=1)
        action = adapt_event(event, log_revision=7)
        self.assertEqual(ActionKind.MULLIGAN, action.action)
        self.assertEqual((1, 3), action.mulligan_slots)
        self.assertEqual(7, action.log_revision)

    def test_maps_real_minion_event_to_hand_slot(self):
        event = make_event([{
            "actionName": "play_minion",
            "card": {"ZONE_POSITION": 4, "cardId": "TOY_518"},
            "position": 1,
            "using_disguised": 0,
        }])
        action = adapt_event(event)
        self.assertEqual(ActionKind.PLAY_CARD, action.action)
        self.assertEqual("hand_slot", action.source.kind)
        self.assertEqual(4, action.source.index)
        self.assertEqual("MINION", action.card_type)
        self.assertEqual(1.0, action.ocr_confidence)

    def test_maps_special_and_end_turn(self):
        event = make_event([
            {"actionName": "play_special", "card": {"ZONE_POSITION": 4}},
            {"actionName": "end_turn"},
        ])
        special = adapt_event(event, action_index=0)
        end_turn = adapt_event(event, action_index=1)
        self.assertEqual(ActionKind.PLAY_CARD, special.action)
        self.assertEqual("SPECIAL", special.card_type)
        self.assertEqual(ActionKind.END_TURN, end_turn.action)

    def test_unknown_frontend_action_is_safe_stop(self):
        event = make_event([{
            "actionName": "hero_skill",
            "card": {"ZONE_POSITION": 0},
        }])
        with self.assertRaisesRegex(CdpRecommendationError, "unsupported"):
            adapt_event(event)

    def test_live_baseline_is_explicit(self):
        self.assertEqual(
            {"replace", "play_minion", "play_special", "end_turn"},
            set(supported_live_action_names()),
        )


if __name__ == "__main__":
    unittest.main()
