import json
import os
import unittest

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtWidgets import QApplication

from qt_console import QtConsole


class QtConsoleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.window = QtConsole()

    def tearDown(self):
        self.window.close()

    def test_navigation_matches_web_feature_order(self):
        labels = [self.window.nav.item(i).text() for i in range(self.window.nav.count())]
        self.assertEqual(len(labels), 13)
        for expected in ("概览", "基础配置", "定时任务", "对战控制", "自动投降", "投降规则", "段位目标", "延时设置", "校准区域", "日志与自检"):
            self.assertTrue(any(expected in label for label in labels), expected)
        self.assertEqual(len(self.window.pages), 13)

    def test_surrender_form_creates_backend_shape(self):
        self.window._add_deck()
        row = self.window.deck_rows[0]
        row["name"].setText("测试卡组")
        row["when"].setPlainText(json.dumps({"all": [{"type": "played", "side": "opponent", "card": "测试卡"}]}, ensure_ascii=False))
        value = self.window._surrender_config()
        self.assertFalse(value["enabled"])
        self.assertEqual(value["decks"][0]["name"], "测试卡组")
        self.assertEqual(value["decks"][0]["when"]["all"][0]["card"], "测试卡")

    def test_surrender_card_form_creates_leaf_without_json(self):
        self.window._add_deck()
        row = self.window.deck_rows[0]
        row["name"].setText("表单卡组")
        row["card"].setText("寒冰箭")
        value = self.window._surrender_config()
        leaf = value["decks"][0]["when"]["all"][0]
        self.assertEqual(leaf["type"], "played")
        self.assertEqual(leaf["side"], "opponent")
        self.assertEqual(leaf["card"], "寒冰箭")

    def test_saved_surrender_config_round_trips_into_form(self):
        config = {
            "enabled": True,
            "aliases": {},
            "decks": [{"name": "猎人", "class": "HUNTER", "when": {"all": [{"type": "played", "side": "opponent", "card": "奥秘"}]}}],
        }
        self.window._load_surrender_config(config)
        self.assertTrue(self.window.widgets["surrender_enabled"].isChecked())
        self.assertEqual(len(self.window.deck_rows), 1)
        self.assertEqual(self.window.deck_rows[0]["name"].text(), "猎人")
        self.assertIn("奥秘", self.window.deck_rows[0]["when"].toPlainText())

    def test_save_delay_payload_keeps_web_api_field_names(self):
        captured = {}
        self.window._post = lambda path, body, callback=None: captured.update(path=path, body=body)
        self.window._save_delays()
        self.assertEqual(captured["path"], "/api/delays")
        self.assertIn("mulligan_ready_delay_seconds", captured["body"])
        self.assertIn("ocr_preprocess_scale", captured["body"])

    def test_log_filters_are_selectable(self):
        self.window._set_log_filter("cdp", 2)
        self.assertTrue(self.window.log_model.enabled["cdp"])
        self.window._set_log_filter("cdp", 0)
        self.assertFalse(self.window.log_model.enabled["cdp"])


if __name__ == "__main__":
    unittest.main()
