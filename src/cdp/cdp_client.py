"""Small dependency-free CDP client for the local HSAng CEF instance.

The project intentionally keeps this client limited to the browser debugging
protocol.  It discovers local page targets, injects the same callback hook as
the reference collector, and publishes read-only events.  It never sends a
game action and it refuses non-loopback CDP hosts.
"""

from __future__ import annotations

import base64
from dataclasses import dataclass
import hashlib
import json
import os
from pathlib import Path
import socket
import threading
import time
from typing import Any, Callable, Iterable, Mapping, Optional
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from .hsbox_events import (
    ALLOWED_CALLBACKS,
    CdpEventError,
    HsboxEventStore,
    HsboxTarget,
    parse_event,
)


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9222
HOOK_MARKER = "__HSBOX_CDP_RECOMMEND_HOOK_V1__"
OUTPUT_MARKER = "__HSBOX_CDP_EVENT__"


class CdpError(RuntimeError):
    """A CDP connection, protocol or target operation failed."""


@dataclass(frozen=True)
class CdpTarget:
    id: str
    type: str
    url: str
    title: str
    websocket_url: str

    @classmethod
    def from_json(cls, value: Mapping[str, Any]) -> "CdpTarget":
        target_id = str(value.get("id") or "")
        websocket_url = str(value.get("webSocketDebuggerUrl") or "")
        if not target_id or not websocket_url:
            raise CdpError("cdp_target_identity_missing")
        return cls(
            id=target_id,
            type=str(value.get("type") or ""),
            url=str(value.get("url") or ""),
            title=str(value.get("title") or ""),
            websocket_url=websocket_url,
        )

    def event_target(self) -> HsboxTarget:
        return HsboxTarget(self.id, self.url, self.title)


def _assert_loopback(host: str) -> None:
    normalized = str(host or "").strip().lower()
    if normalized not in {"127.0.0.1", "localhost", "::1"}:
        raise CdpError("cdp_host_must_be_loopback")


def _http_json(host: str, port: int, path: str, timeout: float) -> Any:
    _assert_loopback(host)
    url = f"http://{host}:{int(port)}{path}"
    request = Request(url, method="GET")
    try:
        with urlopen(request, timeout=max(0.1, float(timeout))) as response:
            if int(response.status) != 200:
                raise CdpError(f"cdp_http_status:{response.status}")
            return json.loads(response.read().decode("utf-8"))
    except CdpError:
        raise
    except Exception as exc:
        raise CdpError(f"cdp_http_failed:{type(exc).__name__}") from exc


class LocalCdpDiscovery:
    """HTTP discovery for `/json/version` and `/json/list`."""

    def __init__(self, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT,
                 timeout: float = 2.0):
        _assert_loopback(host)
        self.host = host
        self.port = int(port)
        self.timeout = float(timeout)

    def version(self) -> dict[str, Any]:
        value = _http_json(self.host, self.port, "/json/version", self.timeout)
        if not isinstance(value, dict):
            raise CdpError("cdp_version_not_object")
        return value

    def targets(self) -> tuple[CdpTarget, ...]:
        value = _http_json(self.host, self.port, "/json/list", self.timeout)
        if not isinstance(value, list):
            raise CdpError("cdp_targets_not_array")
        result = []
        for item in value:
            if isinstance(item, Mapping):
                try:
                    result.append(CdpTarget.from_json(item))
                except CdpError:
                    continue
        return tuple(result)


class _WebSocket:
    """Minimal RFC6455 client sufficient for local CDP text messages."""

    def __init__(self, url: str, timeout: float = 5.0):
        parsed = urlsplit(url)
        if parsed.scheme != "ws":
            raise CdpError("cdp_only_ws_scheme_supported")
        _assert_loopback(parsed.hostname or "")
        self.host = parsed.hostname or ""
        self.port = int(parsed.port or 80)
        self.path = parsed.path or "/"
        if parsed.query:
            self.path += "?" + parsed.query
        self.timeout = max(0.1, float(timeout))
        self.sock: socket.socket | None = None
        self._send_lock = threading.Lock()

    def connect(self) -> None:
        if self.sock is not None:
            return
        try:
            sock = socket.create_connection(
                (self.host, self.port), timeout=self.timeout)
            key = base64.b64encode(os.urandom(16)).decode("ascii")
            host_header = f"{self.host}:{self.port}"
            request = (
                f"GET {self.path} HTTP/1.1\r\n"
                f"Host: {host_header}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\n"
                "Sec-WebSocket-Version: 13\r\n\r\n"
            ).encode("ascii")
            sock.sendall(request)
            response = self._read_until(sock, b"\r\n\r\n", 65536)
            first_line = response.split(b"\r\n", 1)[0]
            if b" 101 " not in first_line and not first_line.endswith(b" 101"):
                sock.close()
                raise CdpError("cdp_websocket_handshake_failed")
            self.sock = sock
        except CdpError:
            raise
        except Exception as exc:
            raise CdpError(f"cdp_websocket_connect_failed:{type(exc).__name__}") from exc

    @staticmethod
    def _read_until(sock: socket.socket, marker: bytes, limit: int) -> bytes:
        data = bytearray()
        while marker not in data:
            chunk = sock.recv(4096)
            if not chunk:
                raise CdpError("cdp_websocket_eof_during_handshake")
            data.extend(chunk)
            if len(data) > limit:
                raise CdpError("cdp_websocket_handshake_too_large")
        return bytes(data)

    def _read_exact(self, size: int) -> bytes:
        sock = self.sock
        if sock is None:
            raise CdpError("cdp_websocket_not_connected")
        result = bytearray()
        while len(result) < size:
            chunk = sock.recv(size - len(result))
            if not chunk:
                raise CdpError("cdp_websocket_closed")
            result.extend(chunk)
        return bytes(result)

    def send_text(self, text: str) -> None:
        payload = str(text).encode("utf-8")
        length = len(payload)
        if length < 126:
            header = bytes([0x81, 0x80 | length])
        elif length < 65536:
            header = bytes([0x81, 0x80 | 126]) + length.to_bytes(2, "big")
        else:
            header = bytes([0x81, 0x80 | 127]) + length.to_bytes(8, "big")
        mask = os.urandom(4)
        masked = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
        with self._send_lock:
            if self.sock is None:
                raise CdpError("cdp_websocket_not_connected")
            self.sock.sendall(header + mask + masked)

    def send_json(self, value: Mapping[str, Any]) -> None:
        self.send_text(json.dumps(value, ensure_ascii=False,
                                  separators=(",", ":")))

    def recv_text(self, timeout: float | None = None) -> str | None:
        sock = self.sock
        if sock is None:
            raise CdpError("cdp_websocket_not_connected")
        sock.settimeout(self.timeout if timeout is None else max(0.0, timeout))
        fragments: list[bytes] = []
        while True:
            header = self._read_exact(2)
            first, second = header
            opcode = first & 0x0F
            masked = bool(second & 0x80)
            length = second & 0x7F
            if length == 126:
                length = int.from_bytes(self._read_exact(2), "big")
            elif length == 127:
                length = int.from_bytes(self._read_exact(8), "big")
            if length > 16 * 1024 * 1024:
                raise CdpError("cdp_websocket_frame_too_large")
            mask = self._read_exact(4) if masked else b""
            payload = self._read_exact(length)
            if masked:
                payload = bytes(byte ^ mask[i % 4]
                                for i, byte in enumerate(payload))
            if opcode == 0x8:
                return None
            if opcode == 0x9:
                self._send_control(0xA, payload)
                continue
            if opcode == 0xA:
                continue
            if opcode in (0x1, 0x0):
                fragments.append(payload)
                if first & 0x80 and opcode == 0x0:
                    # A continuation frame with FIN is the end of a message.
                    continue
                if first & 0x80:
                    try:
                        return b"".join(fragments).decode("utf-8")
                    except UnicodeDecodeError as exc:
                        raise CdpError("cdp_websocket_text_invalid") from exc
            elif opcode == 0x2:
                continue

    def _send_control(self, opcode: int, payload: bytes) -> None:
        if len(payload) >= 126:
            payload = payload[:125]
        mask = os.urandom(4)
        header = bytes([0x80 | opcode, 0x80 | len(payload)])
        masked = bytes(byte ^ mask[i % 4] for i, byte in enumerate(payload))
        with self._send_lock:
            if self.sock is not None:
                self.sock.sendall(header + mask + masked)

    def close(self) -> None:
        sock, self.sock = self.sock, None
        if sock is None:
            return
        try:
            sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            sock.close()
        except OSError:
            pass


def _hook_source() -> str:
    callbacks = json.dumps(sorted(ALLOWED_CALLBACKS), ensure_ascii=False)
    marker = json.dumps(HOOK_MARKER)
    output = json.dumps(OUTPUT_MARKER)
    return f"""
(() => {{
  const marker = {marker};
  const output = {output};
  const names = {callbacks};
  if (window[marker]) return window[marker];
  const emit = (name, args) => {{
    try {{
      console.log(output, JSON.stringify({{
        callback: name,
        args: Array.from(args),
        href: location.href,
      }}));
    }} catch (_) {{}}
  }};
  const wrap = (name, fn) => {{
    if (typeof fn !== "function") return fn;
    if (fn.__hsboxWrappedByCdp) return fn;
    const wrapped = function (...args) {{
      emit(name, args);
      return fn.apply(this, args);
    }};
    try {{ Object.defineProperty(wrapped, "__hsboxWrappedByCdp", {{ value: true }}); }} catch (_) {{}}
    return wrapped;
  }};
  for (const name of names) {{
    let current = window[name];
    try {{
      Object.defineProperty(window, name, {{
        configurable: true,
        enumerable: true,
        get() {{ return current; }},
        set(value) {{ current = wrap(name, value); }},
      }});
      current = wrap(name, current);
    }} catch (_) {{}}
  }}
  Object.defineProperty(window, marker, {{ configurable: true,
    value: {{ installed: true, callbacks: names }} }});
  return window[marker];
}})()
"""


def _parse_console_event(values: list[Any], target: CdpTarget) -> dict[str, Any] | None:
    if len(values) < 2 or values[0] != OUTPUT_MARKER:
        return None
    if not isinstance(values[1], str):
        return None
    try:
        captured = json.loads(values[1])
    except json.JSONDecodeError:
        return None
    if not isinstance(captured, Mapping):
        return None
    callback = str(captured.get("callback") or "")
    args = captured.get("args")
    if not isinstance(args, list):
        args = []
    first = args[0] if args else None
    if isinstance(first, str):
        try:
            payload = json.loads(first)
        except json.JSONDecodeError:
            payload = first
    else:
        payload = first
    kind = "winrate" if callback == "onUpdateWinrateData" else "recommendation"
    return {
        "schema": 1,
        "kind": kind,
        "callback": callback,
        "captured_at": datetime_utc_now(),
        "target": {"id": target.id, "url": target.url, "title": target.title},
        "payload": payload,
        "raw_args": args,
    }


def datetime_utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class _CdpPage:
    def __init__(self, target: CdpTarget,
                 on_message: Callable[[Mapping[str, Any], CdpTarget], None],
                 on_error: Callable[[str, CdpTarget], None]):
        self.target = target
        self._on_message = on_message
        self._on_error = on_error
        self.ws: _WebSocket | None = None
        self._next_id = 1
        self._pending_lock = threading.Lock()
        self._closed = threading.Event()
        self._listener: threading.Thread | None = None

    def _call(self, method: str, params: Mapping[str, Any] | None = None,
              timeout: float = 5.0) -> Mapping[str, Any]:
        ws = self.ws
        if ws is None:
            raise CdpError("cdp_page_not_connected")
        with self._pending_lock:
            request_id = self._next_id
            self._next_id += 1
            ws.send_json({"id": request_id, "method": method,
                          "params": dict(params or {})})
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                remaining = max(0.01, deadline - time.monotonic())
                raw = ws.recv_text(remaining)
                if raw is None:
                    raise CdpError("cdp_page_closed")
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                if not isinstance(message, Mapping):
                    continue
                if message.get("id") == request_id:
                    if message.get("error"):
                        raise CdpError(f"cdp_command_failed:{method}")
                    result = message.get("result")
                    return result if isinstance(result, Mapping) else {}
                self._dispatch(message)
            raise CdpError(f"cdp_command_timeout:{method}")

    def _dispatch(self, message: Mapping[str, Any]) -> None:
        if message.get("method") == "Runtime.consoleAPICalled":
            params = message.get("params")
            if not isinstance(params, Mapping):
                return
            args = params.get("args")
            if not isinstance(args, list):
                return
            values = []
            for arg in args:
                if isinstance(arg, Mapping):
                    values.append(arg.get("value", arg.get("description")))
                else:
                    values.append(None)
            self._on_message({"console_values": values}, self.target)

    def connect(self) -> None:
        self.ws = _WebSocket(self.target.websocket_url)
        self.ws.connect()
        self._call("Runtime.enable")
        self._call("Page.enable")
        source = _hook_source()
        self._call("Page.addScriptToEvaluateOnNewDocument", {"source": source})
        result = self._call("Runtime.evaluate", {
            "expression": source, "awaitPromise": False,
            "returnByValue": True,
        })
        self._on_message({
            "status": "hook-installed",
            "result": result.get("result", {}).get("value"),
        }, self.target)
        self._listener = threading.Thread(
            target=self._listen, name=f"hsbox-cdp-{self.target.id[:8]}",
            daemon=True)
        self._listener.start()

    def _listen(self) -> None:
        while not self._closed.is_set():
            try:
                raw = self.ws.recv_text(1.0) if self.ws else None
                if raw is None:
                    return
                message = json.loads(raw)
                if isinstance(message, Mapping):
                    self._dispatch(message)
            except socket.timeout:
                continue
            except Exception as exc:
                if not self._closed.is_set():
                    self._on_error(str(exc), self.target)
                return

    def close(self) -> None:
        self._closed.set()
        if self.ws is not None:
            self.ws.close()
        self.ws = None


class CdpRecommendationClient:
    """Discover, hook and monitor HSBox recommendation pages."""

    def __init__(
        self,
        host: str = DEFAULT_HOST,
        port: int = DEFAULT_PORT,
        *,
        url_contains: Iterable[str] = (),
        event_store: HsboxEventStore | None = None,
        on_event: Callable[[Any], None] | None = None,
        on_error: Callable[[str], None] | None = None,
    ):
        _assert_loopback(host)
        self.discovery = LocalCdpDiscovery(host, port)
        self.url_contains = tuple(str(item) for item in url_contains if item)
        self.event_store = event_store or HsboxEventStore()
        self.on_event = on_event
        self.on_error = on_error
        self._pages: dict[str, _CdpPage] = {}
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._last_error = ""

    @property
    def host(self) -> str:
        return self.discovery.host

    @property
    def port(self) -> int:
        return self.discovery.port

    def _wanted(self, target: CdpTarget) -> bool:
        if target.type != "page" or not target.websocket_url:
            return False
        if not self.url_contains:
            return True
        return any(value in target.url for value in self.url_contains)

    def _page_message(self, message: Mapping[str, Any], target: CdpTarget) -> None:
        if message.get("status") == "hook-installed":
            return
        values = message.get("console_values")
        if not isinstance(values, list):
            return
        raw = _parse_console_event(values, target)
        if raw is None:
            return
        try:
            event = parse_event(raw)
        except CdpEventError as exc:
            self._report_error(f"cdp_event_invalid:{exc}")
            return
        self.event_store.publish(event)
        if self.on_event is not None:
            self.on_event(event)

    def _page_error(self, error: str, target: CdpTarget) -> None:
        self._report_error(f"{target.id}:{error}")

    def _report_error(self, error: str) -> None:
        self._last_error = str(error)
        if self.on_error is not None:
            self.on_error(self._last_error)

    def scan_once(self) -> dict[str, Any]:
        targets = self.discovery.targets()
        wanted = {target.id: target for target in targets if self._wanted(target)}
        with self._lock:
            for target_id in tuple(self._pages):
                if target_id not in wanted:
                    self._pages.pop(target_id).close()
            for target_id, target in wanted.items():
                current = self._pages.get(target_id)
                if current is not None:
                    current.target = target
                    continue
                page = _CdpPage(target, self._page_message, self._page_error)
                try:
                    page.connect()
                except Exception as exc:
                    page.close()
                    self._report_error(f"target_connect_failed:{target.id}:{exc}")
                    continue
                self._pages[target_id] = page
        return self.status()

    def start_background(self, interval: float = 2.0) -> threading.Thread:
        if self._thread is not None and self._thread.is_alive():
            return self._thread
        self._stop.clear()

        def run() -> None:
            while not self._stop.is_set():
                try:
                    self.scan_once()
                except Exception as exc:
                    self._report_error(str(exc))
                self._stop.wait(max(0.25, float(interval)))

        self._thread = threading.Thread(target=run, name="hsbox-cdp-scan",
                                        daemon=True)
        self._thread.start()
        return self._thread

    def stop(self) -> None:
        self._stop.set()
        with self._lock:
            pages, self._pages = tuple(self._pages.values()), {}
        for page in pages:
            page.close()

    def status(self) -> dict[str, Any]:
        with self._lock:
            pages = tuple(self._pages.values())
        return {
            "host": self.host,
            "port": self.port,
            "connectedTargets": len(pages),
            "targets": [
                {"id": page.target.id, "url": page.target.url,
                 "title": page.target.title}
                for page in pages
            ],
            "lastError": self._last_error,
        }
