"""Inject the read-only HSArriver WebView plugin through CEF CDP.

Only Python's standard library is used. The Box must be started with:
    HSAng.exe --remote-debugging-port=9222
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit


class WebSocket:
    def __init__(self, url: str, timeout: float = 8.0) -> None:
        parts = urlsplit(url)
        if parts.scheme != "ws" or not parts.hostname:
            raise ValueError(f"unsupported CDP WebSocket URL: {url}")
        self.sock = socket.create_connection(
            (parts.hostname, parts.port or 80), timeout=timeout
        )
        self.sock.settimeout(timeout)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        path = parts.path or "/"
        if parts.query:
            path += "?" + parts.query
        request = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {parts.hostname}:{parts.port or 80}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        ).encode("ascii")
        self.sock.sendall(request)
        response = self._read_until(b"\r\n\r\n")
        if not response.startswith(b"HTTP/1.1 101"):
            raise RuntimeError("CDP WebSocket handshake failed: " + response[:200].decode("latin1", "replace"))

    def _read_until(self, marker: bytes) -> bytes:
        data = bytearray()
        while marker not in data:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise ConnectionError("CDP WebSocket closed during handshake")
            data.extend(chunk)
            if len(data) > 65536:
                raise ConnectionError("CDP WebSocket handshake is too large")
        return bytes(data)

    def _read_exact(self, size: int) -> bytes:
        data = bytearray()
        while len(data) < size:
            chunk = self.sock.recv(size - len(data))
            if not chunk:
                raise ConnectionError("CDP WebSocket closed")
            data.extend(chunk)
        return bytes(data)

    def send_text(self, text: str) -> None:
        payload = text.encode("utf-8")
        header = bytearray([0x81])
        if len(payload) < 126:
            header.append(0x80 | len(payload))
        elif len(payload) < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack(">H", len(payload)))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack(">Q", len(payload)))
        mask = os.urandom(4)
        header.extend(mask)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.sock.sendall(bytes(header) + masked)

    def recv_text(self) -> str | None:
        fragments = bytearray()
        while True:
            first, second = self._read_exact(2)
            opcode = first & 0x0F
            masked = bool(second & 0x80)
            length = second & 0x7F
            if length == 126:
                length = struct.unpack(">H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack(">Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else b""
            payload = bytearray(self._read_exact(length))
            if masked:
                for index in range(length):
                    payload[index] ^= mask[index % 4]

            if opcode == 0x8:
                return None
            if opcode == 0x9:
                self._send_control(0xA, bytes(payload))
                continue
            if opcode == 0x1:
                fragments.extend(payload)
            elif opcode == 0x0:
                fragments.extend(payload)
            else:
                continue

            # CDP messages are text frames. A final text frame is enough for
            # normal CDP responses; continuation frames are accumulated above.
            if not (first & 0x80):
                continue
            return bytes(fragments).decode("utf-8")

    def _send_control(self, opcode: int, payload: bytes) -> None:
        mask = os.urandom(4)
        masked = bytes(value ^ mask[index % 4] for index, value in enumerate(payload))
        self.sock.sendall(bytes([0x80 | opcode, 0x80 | len(payload)]) + mask + masked)

    def close(self) -> None:
        try:
            self.sock.close()
        except OSError:
            pass


def cdp_command(ws: WebSocket, counter: list[int], method: str, params: dict | None = None) -> dict:
    counter[0] += 1
    command_id = counter[0]
    ws.send_text(json.dumps({"id": command_id, "method": method, "params": params or {}}))
    while True:
        raw = ws.recv_text()
        if raw is None:
            raise ConnectionError(f"CDP target closed while calling {method}")
        message = json.loads(raw)
        if message.get("id") != command_id:
            continue
        if "error" in message:
            raise RuntimeError(f"CDP {method} failed: {message['error']}")
        return message.get("result", {})


def get_targets(port: int) -> list[dict]:
    url = f"http://127.0.0.1:{port}/json/list"
    with urllib.request.urlopen(url, timeout=5) as response:
        return json.load(response)


def inject(target: dict, source: str) -> dict:
    ws = WebSocket(target["webSocketDebuggerUrl"])
    counter = [0]
    try:
        registration = cdp_command(
            ws,
            counter,
            "Page.addScriptToEvaluateOnNewDocument",
            {"source": source},
        )
        evaluation = cdp_command(
            ws,
            counter,
            "Runtime.evaluate",
            {
                "expression": source + "\n//# sourceURL=hsarriver-webview-plugin.js",
                "returnByValue": True,
                "awaitPromise": False,
            },
        )
        return {
            "title": target.get("title", ""),
            "url": target.get("url", ""),
            "registration": registration.get("identifier"),
            "evaluation": evaluation.get("exceptionDetails") is None,
        }
    finally:
        ws.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Inject HSArriver read-only WebView plugin")
    parser.add_argument("--port", type=int, default=9222)
    parser.add_argument(
        "--script",
        type=Path,
        default=Path(__file__).with_name("hsbox_webview_plugin.js"),
    )
    parser.add_argument("--all-pages", action="store_true", help="inject every page target")
    args = parser.parse_args()

    source = args.script.read_text(encoding="utf-8")
    targets = [
        target for target in get_targets(args.port)
        if target.get("type") == "page" and target.get("webSocketDebuggerUrl")
    ]
    if not args.all_pages:
        targets = [
            target for target in targets
            if "lushi.163.com" in target.get("url", "")
            or "client-jipaiqi" in target.get("url", "")
        ] or targets[:1]
    if not targets:
        print("no CDP page target found", file=sys.stderr)
        return 3

    for target in targets:
        try:
            print(json.dumps(inject(target, source), ensure_ascii=False))
        except Exception as exc:  # noqa: BLE001 - CLI should report the target error
            print(f"inject failed for {target.get('url', '')}: {exc}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
