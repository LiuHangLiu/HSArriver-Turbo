import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch

from native_console import LogFilterModel, find_hsbox_executable, start_hsbox


class LogFilterModelTests(unittest.TestCase):
    def test_categories_are_independently_filterable(self):
        model = LogFilterModel({"recommendation": False, "cdp": True})
        recommendation = {"level": "SYS", "msg": "[推荐] play_minion"}
        operation = {"level": "SYS", "msg": "[执行] 点击手牌"}
        cdp = {"level": "SYS", "msg": "CDP raw_args callback"}
        self.assertEqual("recommendation", model.category(recommendation))
        self.assertFalse(model.accepts(recommendation))
        self.assertTrue(model.accepts(operation))
        self.assertTrue(model.accepts(cdp))

    def test_power_and_debug_have_separate_categories(self):
        model = LogFilterModel()
        self.assertEqual("power", model.category({"msg": "Power.log 停滞"}))
        self.assertEqual("debug", model.category({"level": "DEBUG", "msg": "trace"}))
        self.assertFalse(model.accepts({"msg": "Power.log 停滞"}))
        self.assertFalse(model.accepts({"level": "DEBUG", "msg": "trace"}))


class BoxProcessTests(unittest.TestCase):
    def test_find_box_accepts_direct_executable(self):
        with tempfile.TemporaryDirectory() as temp:
            executable = Path(temp) / "HSAng.exe"
            executable.write_bytes(b"")
            self.assertEqual(executable, find_hsbox_executable(str(executable)))

    def test_start_box_passes_loopback_cdp_arguments(self):
        with tempfile.TemporaryDirectory() as temp:
            temp_path = Path(temp)
            executable = temp_path / "HSAng.exe"
            executable.write_bytes(b"")
            process = object()
            with patch("native_console.subprocess.Popen", return_value=process) as popen:
                result = start_hsbox(str(temp_path), 9333)
        self.assertIs(result, process)
        args, kwargs = popen.call_args
        self.assertEqual(str(executable), args[0][0])
        self.assertIn("--remote-debugging-port=9333", args[0])
        self.assertIn("--remote-debugging-address=127.0.0.1", args[0])
        self.assertEqual(str(temp_path), kwargs["cwd"])


if __name__ == "__main__":
    unittest.main()
