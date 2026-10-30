import json
import unittest

from src.cdp.cdp_client import (
    OUTPUT_MARKER,
    CdpRecommendationClient,
    CdpTarget,
)


TARGET = CdpTarget(
    id="target-1",
    type="page",
    url="https://hs-web.lushi.163.com/client-home/",
    title="炉石传说盒子",
    websocket_url="ws://127.0.0.1/devtools/page/target-1",
)


class CdpRawLogTests(unittest.TestCase):
    def test_hook_status_is_forwarded_as_reference_raw_json(self):
        raw_events = []
        client = CdpRecommendationClient(on_raw=raw_events.append)

        client._page_message(
            {
                "status": "hook-installed",
                "result": {
                    "installed": True,
                    "callbacks": ["onUpdateLadderActionRecommend"],
                },
            },
            TARGET,
        )

        self.assertEqual(1, len(raw_events))
        self.assertEqual("status", raw_events[0]["kind"])
        self.assertEqual("hook-installed", raw_events[0]["status"])
        self.assertEqual(TARGET.id, raw_events[0]["target"]["id"])

    def test_callback_is_forwarded_without_business_prefix(self):
        raw_events = []
        client = CdpRecommendationClient(on_raw=raw_events.append)
        payload = {"status": 2, "error": "", "turnNum": 2, "data": []}
        captured = {
            "callback": "onUpdateLadderActionRecommend",
            "args": [json.dumps(payload, ensure_ascii=False)],
        }

        client._page_message(
            {"console_values": [OUTPUT_MARKER, json.dumps(captured)]},
            TARGET,
        )

        self.assertEqual(1, len(raw_events))
        self.assertEqual("recommendation", raw_events[0]["kind"])
        self.assertEqual(payload, raw_events[0]["payload"])
        self.assertNotIn("[CDP]", json.dumps(raw_events[0], ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
