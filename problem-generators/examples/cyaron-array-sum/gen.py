#!/usr/bin/env python3
import argparse
import os
import random
import sys
from typing import Optional

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
def discover_repo_root() -> str:
    override = os.environ.get("TESTDATA_REPO_ROOT")
    if override:
        return override

    current = SCRIPT_DIR
    while True:
        candidate = os.path.join(current, "problem-generators", "shared", "codemaster_external.py")
        if os.path.isfile(candidate):
            return current
        parent = os.path.dirname(current)
        if parent == current:
            return SCRIPT_DIR
        current = parent


REPO_ROOT = discover_repo_root()
SHARED_DIR = os.path.join(REPO_ROOT, "problem-generators", "shared")
if SHARED_DIR not in sys.path:
    sys.path.insert(0, SHARED_DIR)

from codemaster_external import (  # noqa: E402
    build_json_output,
    guess_array_limits,
    load_context,
    load_cyaron_backend,
    resolve_int_setting,
    resolve_profile,
    seed_to_int,
)

_backend = load_cyaron_backend()
CYARON_AVAILABLE = bool(_backend["available"])
Vector = _backend["Vector"]
randint = _backend["randint"]


DEFAULTS = {
    "n_min": 1,
    "n_max": 200000,
    "value_min": -1000000000,
    "value_max": 1000000000,
}
def resolve_limits(context: dict) -> dict:
    limits = {
        **DEFAULTS,
        **guess_array_limits(context, n_default=DEFAULTS["n_max"], value_default=DEFAULTS["value_max"]),
    }
    for key in limits:
        limits[key] = resolve_int_setting(context, key, limits[key])
    if limits["n_min"] > limits["n_max"]:
        raise SystemExit("invalid_n_range")
    if limits["value_min"] > limits["value_max"]:
        raise SystemExit("invalid_value_range")
    return limits

def random_vector(n: int, left: int, right: int) -> list[int]:
    try:
        values = Vector.random(n, [(left, right)])
        return [int(item) for item in values]
    except TypeError:
        try:
            values = Vector.random(num=n, position_range=[(left, right)])
            return [int(item) for item in values]
        except Exception:
            return [randint(left, right) for _ in range(n)]
    except Exception:
        return [randint(left, right) for _ in range(n)]


def build_case(profile: str, limits: dict) -> tuple[int, list[int], dict]:
    n_min = limits["n_min"]
    n_max = limits["n_max"]
    value_min = limits["value_min"]
    value_max = limits["value_max"]

    if profile == "min-single-zero":
        return 1, [0], {"profile": profile, "kind": "smallest"}

    if profile == "min-single-negative":
        return 1, [value_min], {"profile": profile, "kind": "smallest-negative"}

    if profile == "all-zero":
        n = min(max(n_min, 64), n_max)
        return n, [0] * n, {"profile": profile, "kind": "uniform-zero"}

    if profile == "all-max-positive":
        n = min(max(n_min, 2048), n_max)
        return n, [value_max] * n, {"profile": profile, "kind": "positive-boundary"}

    if profile == "all-max-negative":
        n = min(max(n_min, 2048), n_max)
        return n, [value_min] * n, {"profile": profile, "kind": "negative-boundary"}

    if profile == "alternating-extremes":
        n = min(max(n_min, 4096), n_max)
        values = [value_max if index % 2 == 0 else value_min for index in range(n)]
        return n, values, {"profile": profile, "kind": "alternating-extremes"}

    if profile == "repeated-extreme":
        n = min(max(n_min, 5000), n_max)
        hot = value_max if random.random() < 0.5 else value_min
        values = [hot] * n
        if n >= 3:
            values[-1] = 0
            values[-2] = -hot if hot != 0 else 1
        return n, values, {"profile": profile, "kind": "duplicate-extreme"}

    if profile == "near-overflow-32":
        n = min(max(n_min, 1000), n_max)
        large = min(value_max, 2147483647)
        small = max(value_min, -2147483648)
        values = [large] * (n // 2) + [small] * (n - n // 2)
        random.shuffle(values)
        return n, values, {"profile": profile, "kind": "overflow-sanity"}

    if profile == "random-small":
        upper = min(n_max, max(n_min, 8))
        n = randint(n_min, upper)
        return n, random_vector(n, max(value_min, -20), min(value_max, 20)), {
            "profile": profile,
            "kind": "small-random",
        }

    if profile == "random-large":
        lower = min(n_max, max(n_min, max(1, n_max // 2)))
        n = randint(lower, n_max)
        return n, random_vector(n, value_min, value_max), {
            "profile": profile,
            "kind": "large-random",
        }

    if profile == "dense-duplicates":
        n = min(max(n_min, 20000), n_max)
        base_values = [value_min, -1, 0, 1, value_max]
        values = [int(random.choice(base_values)) for _ in range(n)]
        return n, values, {"profile": profile, "kind": "dense-duplicates"}

    if profile == "max-n-random":
        n = n_max
        return n, random_vector(n, value_min, value_max), {
            "profile": profile,
            "kind": "max-n",
        }

    n = min(max(n_min, 4096), n_max)
    return n, random_vector(n, value_min, value_max), {
        "profile": profile,
        "kind": "default-random",
    }


def main():
    parser = argparse.ArgumentParser(description="CYaRon example generator for array sum problems")
    parser.add_argument("--mode", default=None)
    parser.add_argument("--seed", default=os.environ.get("TESTDATA_CASE_SEED", "cyaron-demo"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    context = load_context()
    limits = resolve_limits(context)
    profile = resolve_profile(args.mode, context)

    random.seed(seed_to_int(args.seed))
    n, values, metadata = build_case(profile, limits)

    text = f"{n}\n{' '.join(str(value) for value in values)}\n"

    if not CYARON_AVAILABLE:
        print(
            "warning: cyaron not installed, fallback to Python random. install requirements.txt for full CYaRon mode.",
            file=sys.stderr,
        )

    if args.json:
        print(build_json_output(text, {
            **metadata,
            "n": n,
            "minValue": min(values),
            "maxValue": max(values),
        }))
        return

    sys.stdout.write(text)


if __name__ == "__main__":
    main()
