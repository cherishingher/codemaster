#!/usr/bin/env python3
import argparse
import os
import random
import sys

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
    read_external_config,
    resolve_profile,
    seed_to_int,
)

backend = load_cyaron_backend()
CYARON_AVAILABLE = bool(backend["available"])
Vector = backend["Vector"]
randint = backend["randint"]


def random_vector(n: int, left: int, right: int) -> list[int]:
    try:
        values = Vector.random(n, [(left, right)])
        return [int(item) for item in values]
    except TypeError:
        return [randint(left, right) for _ in range(n)]
    except Exception:
        return [randint(left, right) for _ in range(n)]


def build_case(profile: str, context: dict) -> tuple[str, dict]:
    # TODO: replace this with real generation logic for your problem.
    # The default template assumes a problem with:
    #   n
    #   a1 a2 ... an
    limits = guess_array_limits(context, n_default=200000, value_default=1000000000)
    n_min = int(limits["n_min"])
    n_max = int(limits["n_max"])
    value_min = int(limits["value_min"])
    value_max = int(limits["value_max"])

    if profile == "tiny-edge":
        n = 1
        values = [0]
    elif profile == "max-random":
        n = n_max
        values = random_vector(n, value_min, value_max)
    elif profile == "dense-duplicates":
        n = min(max(32, n_min), n_max)
        palette = [value_min, -1, 0, 1, value_max]
        values = [int(random.choice(palette)) for _ in range(n)]
    else:
        n = min(max(16, n_min), n_max)
        values = random_vector(n, value_min, value_max)

    text = f"{n}\n{' '.join(str(value) for value in values)}\n"
    metadata = {
        "profile": profile,
        "n": n,
        "minValue": min(values),
        "maxValue": max(values),
    }
    return text, metadata


def main():
    parser = argparse.ArgumentParser(description="Scaffolded CYaRon generator template")
    parser.add_argument("--mode", default=None)
    parser.add_argument("--seed", default=os.environ.get("TESTDATA_CASE_SEED", "scaffold-demo"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    context = load_context()
    external = read_external_config(context)
    random.seed(seed_to_int(args.seed))
    profile = resolve_profile(args.mode, context, default=str(external.get("profile") or "default"))
    text, metadata = build_case(profile, context)

    if not CYARON_AVAILABLE:
      print("warning: cyaron not installed, fallback to Python random. install requirements.txt for full CYaRon mode.", file=sys.stderr)

    if args.json:
        print(build_json_output(text, metadata))
        return

    sys.stdout.write(text)


if __name__ == "__main__":
    main()
