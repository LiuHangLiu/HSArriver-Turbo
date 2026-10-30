"""Local read-only receiver for hsbox_webview_plugin.js.

The receiver is optional. The WebView plugin continues to work through its
console/event buffer when this process is not running.
"""

from __future__ import annotations

import argparse
import json
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class Receiver(BaseHTTPRequestHandler):
    server_version = "HSArriverPluginReceiver/0.1"

    def _send(self, status: int, body: bytes, content_type: str = "text/plain") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS, GET")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send(204, b"")

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._send(404, b"not found")
            return
        self._send(200, b"ok\n")

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/event":
            self._send(404, b"not found")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
        except (ValueError, json.JSONDecodeError) as exc:
            self._send(400, ("invalid json: " + str(exc) + "\n").encode())
            return

        line = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        log_path: Path | None = self.server.log_path  # type: ignore[attr-defined]
        if log_path is not None:
            with log_path.open("a", encoding="utf-8") as handle:
                handle.write(line + "\n")

        event_type = payload.get("type", "unknown") if isinstance(payload, dict) else "unknown"
        callback = payload.get("callback", "") if isinstance(payload, dict) else ""
        print(f"[{datetime.now(timezone.utc).isoformat()}] {event_type} {callback}", flush=True)
        if isinstance(payload, dict):
            data = payload.get("data")
            if event_type in {
                "arena.recommend",
                "ladder.recommend",
                "standard.recommend",
            } and isinstance(data, dict):
                actions = data.get("data", [])
                summary = [
                    {
                        "index": index,
                        "actionName": item.get("actionName") if isinstance(item, dict) else None,
                        "card": item.get("card") if isinstance(item, dict) else None,
                        "target": item.get("target") if isinstance(item, dict) else None,
                    }
                    for index, item in enumerate(actions)
                ]
                print("recommend=" + json.dumps(summary, ensure_ascii=False, separators=(",", ":")), flush=True)
            elif event_type in {"winrate.predict", "standard.winrate"} and isinstance(data, dict):
                if event_type == "standard.winrate":
                    print(
                        "winrate=" + json.dumps(
                            {
                                key: data.get(key)
                                for key in (
                                    "status",
                                    "turn",
                                    "winRate",
                                    "tieRate",
                                    "lossRate",
                                    "opponentDeathRate",
                                    "myDeathRate",
                                )
                                if key in data
                            },
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                        flush=True,
                    )
                else:
                    print(f"winrate={data.get('myWinRate')} turns={len(data.get('turns', []))}", flush=True)
            elif event_type == "tracker.cards" and isinstance(data, dict):
                print(f"hand={json.dumps(data.get('hand'), ensure_ascii=False)} remain={data.get('remain')}", flush=True)
            elif event_type.startswith("tracker."):
                print("tracker=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")), flush=True)
        self._send(204, b"")

    def log_message(self, _format: str, *_args) -> None:
        return


def main() -> int:
    parser = argparse.ArgumentParser(description="Receive HSArriver WebView plugin events")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--log", type=Path, default=Path("logs/hsbox_plugin_events.jsonl"))
    parser.add_argument("--no-save", action="store_true", help="print events only; do not write a file")
    args = parser.parse_args()

    if not args.no_save:
        args.log.parent.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer((args.host, args.port), Receiver)
    server.log_path = None if args.no_save else args.log  # type: ignore[attr-defined]
    print(f"HSArriver plugin receiver listening on http://{args.host}:{args.port}", flush=True)
    if args.no_save:
        print("events -> stdout only", flush=True)
    else:
        print(f"events -> {args.log.resolve()}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
