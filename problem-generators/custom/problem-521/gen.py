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
    load_context,
    load_cyaron_backend,
    read_external_config,
    resolve_profile,
    seed_to_int,
)

backend = load_cyaron_backend()
CYARON_AVAILABLE = bool(backend["available"])

MAX_DIGITS = 2048


def random_digit_string(length: int, *, first_non_zero: bool = True) -> str:
    if length <= 0:
        return "0"
    digits = []
    for index in range(length):
        if index == 0 and first_non_zero:
            digits.append(str(random.randint(1, 9)))
        else:
            digits.append(str(random.randint(0, 9)))
    return "".join(digits)


def patterned_number(length: int, pattern: str) -> str:
    repeated = (pattern * ((length // len(pattern)) + 1))[:length]
    if repeated[0] == "0":
        repeated = "1" + repeated[1:]
    return repeated


def build_case(profile: str, _context: dict) -> tuple[str, dict]:
    if profile == "tiny-edge":
        candidates = ["0", "1", "2", "9"]
        value = candidates[random.randrange(len(candidates))]
    elif profile == "dense-duplicates":
        length = random.choice([32, 64, 128, 256, 384, 512])
        patterns = ["9", "90", "109", "1234567890", "31415926"]
        value = patterned_number(length, random.choice(patterns))
    elif profile == "max-random":
        length = MAX_DIGITS
        value = random_digit_string(length)
    else:
        mode = random.choice(["random", "all-nine", "power-minus-one", "sparse-zeros", "palindrome-ish"])
        if mode == "random":
            length = random.randint(2, 256)
            value = random_digit_string(length)
        elif mode == "all-nine":
            length = random.choice([8, 16, 32, 64, 128, 256])
            value = "9" * length
        elif mode == "power-minus-one":
            length = random.choice([10, 50, 100, 200, 400])
            value = "9" * length
        elif mode == "sparse-zeros":
            length = random.randint(16, 256)
            chars = ["0"] * length
            chars[0] = str(random.randint(1, 9))
            for index in random.sample(range(1, length), k=max(1, length // 12)):
                chars[index] = str(random.randint(1, 9))
            value = "".join(chars)
        else:
            half = random.randint(2, 80)
            prefix = random_digit_string(half)
            value = prefix + prefix[::-1]

    text = f"{value}\n"
    metadata = {
        "profile": profile,
        "digits": len(value),
        "leadingDigit": value[0],
        "trailingDigit": value[-1],
    }
    return text, metadata


def main():
    parser = argparse.ArgumentParser(description="Problem 521 external CYaRon-style generator")
    parser.add_argument("--mode", default=None)
    parser.add_argument("--seed", default=os.environ.get("TESTDATA_CASE_SEED", "problem-521-demo"))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    context = load_context()
    external = read_external_config(context)
    random.seed(seed_to_int(args.seed))
    profile = resolve_profile(args.mode, context, default=str(external.get("profile") or "default"))
    text, metadata = build_case(profile, context)

    if not CYARON_AVAILABLE:
        print(
            "warning: cyaron not installed, fallback to Python random. install requirements.txt for full CYaRon mode.",
            file=sys.stderr,
        )

    if args.json:
        print(build_json_output(text, metadata))
        return

    sys.stdout.write(text)


if __name__ == "__main__":
    main()
