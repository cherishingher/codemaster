#!/usr/bin/env python3
import json
import os
import sys


DEFAULTS = {
    "n_min": 1,
    "n_max": 200000,
    "value_min": -1000000000,
    "value_max": 1000000000,
}


def load_limits():
    limits = DEFAULTS.copy()
    path = os.environ.get("TESTDATA_CONTEXT_PATH")
    if not path:
        return limits
    try:
        with open(path, "r", encoding="utf8") as fh:
            payload = json.load(fh)
    except Exception:
        return limits

    external = payload.get("context") or {}
    for key in limits:
        value = external.get(key)
        if isinstance(value, int):
            limits[key] = value
    return limits


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def main() -> int:
    limits = load_limits()
    content = sys.stdin.read()
    if not content.strip():
        return fail("empty_input")

    tokens = content.split()
    try:
        values = [int(token) for token in tokens]
    except ValueError:
        return fail("non_integer_token")

    n = values[0]
    if not (limits["n_min"] <= n <= limits["n_max"]):
        return fail("n_out_of_range")
    if len(values) != n + 1:
        return fail("token_count_mismatch")

    for number in values[1:]:
        if not (limits["value_min"] <= number <= limits["value_max"]):
            return fail("value_out_of_range")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
