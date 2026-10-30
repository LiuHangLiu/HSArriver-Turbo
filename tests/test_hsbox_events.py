import json
from pathlib import Path
import tempfile
import unittest

from src.cdp.hsbox_events import (
    CdpEventError,
    HsboxEventJournal,
    HsboxEventStore,
    event_key,
    parse_event,
)


TARGET = {
    "id": "target-1",
    "url": "https://hs-web-embed.lushi.163.com/client-jipaiqi/ladder-opp",
    "title": "炉石盒子记牌器",
}


def event_payload(data, **extra):
    payload = {"status": 2, "error": "", "turnNum": 2,
               "optionId": 2, "choiceId": -1, "data": data}
    payload.update(extra)
    return {
        "schema": 1,
        "kind": "recommendation",
        "callback": "onUpdateLadderActionRecommend",
        "captured_at": "2026-10-29T13:45:51.224Z",
        "target": TARGET,
        "payload": payload,
        "raw_args": [json.dumps(payload, ensure_ascii=False)],
    }


class HsboxEventTests(unittest.TestCase):
    def test_parses_real_shape_and_action_array(self):
        event = parse_event(event_payload([{
            "actionName": "play_minion",
            "card": {"ZONE_POSITION": 4, "cardId": "TOY_518"},
            "position": 1,
        }]))
        self.assertTrue(event.is_ready)
        self.assertEqual(2, event.turn_number)
        self.assertEqual("play_minion", event.action_items()[0]["actionName"])
        self.assertEqual("target-1", event.target.id)

    def test_normalizes_frontend_hyphenated_target_keys(self):
        event = parse_event(event_payload([{
            "actionName": "play_special",
            "card": {"ZONE_POSITION": 2},
            "opp-target-hero": True,
            "target-hero": False,
        }]))
        action = event.action_items()[0]
        self.assertTrue(action["oppTargetHero"])
        self.assertFalse(action["targetHero"])

    def test_unready_event_is_journalable_but_not_executable(self):
        event = parse_event(event_payload([], status=1, error="busy"))
        self.assertFalse(event.is_ready)
        self.assertEqual((), event.action_items())

    def test_event_key_changes_per_action_index(self):
        event = parse_event(event_payload([
            {"actionName": "play_special", "card": {"ZONE_POSITION": 4}},
            {"actionName": "end_turn"},
        ]))
        self.assertNotEqual(event_key(event, 0), event_key(event, 1))
        self.assertEqual(event_key(event, 0), event_key(event, 0))

    def test_malformed_action_array_is_rejected(self):
        event = parse_event(event_payload({"actionName": "end_turn"}))
        with self.assertRaises(CdpEventError):
            event.action_items()

    def test_store_notifies_and_keeps_latest_event(self):
        store = HsboxEventStore()
        event = parse_event(event_payload([{"actionName": "end_turn"}]))
        sequence = store.publish(event)
        self.assertEqual(1, sequence)
        current_sequence, current = store.snapshot()
        self.assertEqual(sequence, current_sequence)
        self.assertIs(event, current)

    def test_journal_is_bounded_and_keeps_complete_json_lines(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            journal = HsboxEventJournal(
                path, max_bytes=900, keep_bytes=600, trim_interval=0)
            for index in range(20):
                journal.append(event_payload([{
                    "actionName": "play_minion",
                    "card": {"cardId": f"TEST_{index:02d}"},
                }]))

            self.assertLessEqual(path.stat().st_size, 900)
            lines = path.read_text(encoding="utf-8").splitlines()
            self.assertTrue(lines)
            for line in lines:
                self.assertIsInstance(json.loads(line), dict)


if __name__ == "__main__":
    unittest.main()
