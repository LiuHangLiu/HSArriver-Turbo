"""Read-only Hearthstone Power.log observer.

This tool intentionally does not start, control, inject into, or modify any
Hearthstone/Box process. It reuses this project's existing Power.log parser and
prints only state changes that are available in the game log:

* turn / current-player changes;
* the known friendly hand snapshot;
* game end.

The Box's AI recommendation and win-rate callbacks are not written to
Power.log, so this tool does not claim to provide those two fields.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def _safe_int(value: Any) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _card_snapshot(entity_id: str, entity: Any) -> dict[str, Any]:
    return {
        "entity_id": entity_id,
        "card_id": str(getattr(entity, "card_id", "") or ""),
        "card_type": str(entity.query_tag("CARDTYPE", "") or ""),
        "zone": str(entity.query_tag("ZONE", "") or ""),
        "zone_position": _safe_int(entity.query_tag("ZONE_POSITION", "0")),
        "cost": _safe_int(entity.query_tag("TAG_LAST_KNOWN_COST_IN_HAND", "0")),
    }


def _hand_snapshot(state: Any) -> list[dict[str, Any]]:
    my_player_id = str(getattr(state, "my_player_id", "0") or "0")
    cards = []
    for entity_id, entity in getattr(state, "entity_dict", {}).items():
        if not hasattr(entity, "card_id"):
            continue
        if str(entity.query_tag("ZONE", "") or "") != "HAND":
            continue
        if str(entity.query_tag("CONTROLLER", "") or "") != my_player_id:
            continue
        cards.append(_card_snapshot(str(entity_id), entity))
    cards.sort(key=lambda card: (
        card["zone_position"] is None,
        card["zone_position"] or 0,
        int(card["entity_id"]) if str(card["entity_id"]).isdigit() else 0,
    ))
    return cards


def _game_snapshot(state: Any) -> dict[str, Any]:
    try:
        turn = int(state.game_num_turns_in_play)
    except (AttributeError, TypeError, ValueError, KeyError):
        turn = 0
    try:
        is_my_turn = bool(state.is_my_turn)
    except (AttributeError, TypeError, ValueError, KeyError):
        is_my_turn = None
    try:
        game_state = str(state.game_state or "")
    except (AttributeError, TypeError, ValueError, KeyError):
        game_state = ""
    return {
        "session_id": str(getattr(state, "session_id", "unknown-session")),
        "game_generation": int(getattr(state, "game_generation", 0) or 0),
        "revision": int(getattr(state, "revision", 0) or 0),
        "turn": turn,
        "is_my_turn": is_my_turn,
        "game_state": game_state,
        "my_player_id": str(getattr(state, "my_player_id", "0") or "0"),
        "opponent_player_id": str(getattr(state, "oppo_player_id", "0") or "0"),
        "hand": _hand_snapshot(state),
    }


def _event(kind: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "time": datetime.now(timezone.utc).isoformat(),
        "type": kind,
        "data": snapshot,
    }


def _write_event(event: dict[str, Any], output: Path | None) -> None:
    line = json.dumps(event, ensure_ascii=False, separators=(",", ":"))
    print(line, flush=True)
    if output is not None:
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")


def main() -> int:
    # Parse CLI first so --help remains usable even when optional project
    # dependencies are not installed on the current machine.
    parser = argparse.ArgumentParser(description="Read-only Power.log state observer")
    parser.add_argument(
        "--log-root",
        default="",
        help="Hearthstone Logs directory containing Hearthstone_*/Power.log",
    )
    parser.add_argument(
        "--name",
        default="",
        help="optional Hearthstone account name used to identify the friendly player",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("logs/hs_power_readonly.jsonl"),
    )
    parser.add_argument("--no-output", action="store_true")
    args = parser.parse_args()

    try:
        import log_op
        import log_state as state_module
    except ModuleNotFoundError as exc:
        print(
            f"project dependency is missing: {exc.name}; run the project's requirements first",
            file=sys.stderr,
        )
        return 2

    if not args.log_root:
        args.log_root = str(log_op.HEARTHSTONE_LOG_ROOT or "")

    log_root = Path(args.log_root).expanduser() if args.log_root else None
    if log_root is None or not log_root.is_dir():
        print(
            "Power.log root is unavailable; pass --log-root <Hearthstone Logs directory>",
            file=sys.stderr,
        )
        return 2

    if args.name:
        state_module.MY_NAME = args.name.strip()

    output = None if args.no_output else args.output
    state = state_module.LogState()
    previous_turn = None
    previous_my_turn = None
    previous_hand = None
    previous_generation = state.game_generation
    emitted_end_generation = None

    for container in log_op.log_iter_func(log_root):
        if container.log_type != log_op.LOG_CONTAINER_INFO:
            continue

        before_revision = state.revision
        for line in container.message_list:
            try:
                state_module.update_state(state, line)
            except Exception as exc:  # keep the observer alive for one bad line
                print(f"[observer] ignored parser error: {exc}", file=sys.stderr, flush=True)

        if state.revision == before_revision:
            continue

        snapshot = _game_snapshot(state)
        hand_key = json.dumps(snapshot["hand"], ensure_ascii=False, sort_keys=True)
        generation_changed = snapshot["game_generation"] != previous_generation
        turn_changed = (
            snapshot["turn"] != previous_turn
            or snapshot["is_my_turn"] != previous_my_turn
        )
        hand_changed = hand_key != previous_hand

        if generation_changed or turn_changed:
            _write_event(_event("turn.snapshot", snapshot), output)
        if generation_changed or hand_changed:
            _write_event(_event("hand.snapshot", snapshot), output)
        if (
            snapshot["game_state"] == "COMPLETE"
            and emitted_end_generation != snapshot["game_generation"]
        ):
            _write_event(_event("game.end", snapshot), output)
            emitted_end_generation = snapshot["game_generation"]

        previous_generation = snapshot["game_generation"]
        previous_turn = snapshot["turn"]
        previous_my_turn = snapshot["is_my_turn"]
        previous_hand = hand_key

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
