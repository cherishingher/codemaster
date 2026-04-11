#!/usr/bin/env python3
import hashlib
import json
import os
import random
import re
from typing import Any, Dict, Optional


JsonDict = Dict[str, Any]


def load_context() -> JsonDict:
    path = os.environ.get("TESTDATA_CONTEXT_PATH")
    if not path:
        return {}
    try:
        with open(path, "r", encoding="utf8") as fh:
            return json.load(fh)
    except Exception:
        return {}


def read_external_config(context: JsonDict) -> JsonDict:
    value = context.get("context")
    return value if isinstance(value, dict) else {}


def seed_to_int(seed_text: str) -> int:
    digest = hashlib.sha256(seed_text.encode("utf8")).digest()
    return int.from_bytes(digest[:8], "big")


def resolve_profile(args_mode: Optional[str], context: JsonDict, default: str = "default") -> str:
    if args_mode:
        return args_mode
    external = read_external_config(context)
    profile = external.get("profile")
    if isinstance(profile, str) and profile:
        return profile
    plan = context.get("plan") or {}
    group_key = plan.get("groupKey")
    if isinstance(group_key, str) and group_key:
        return group_key
    return default


def resolve_int_setting(context: JsonDict, key: str, default: int) -> int:
    external = read_external_config(context)
    value = external.get(key)
    return value if isinstance(value, int) else default


def extract_numeric_hints(text: Optional[str]) -> list[int]:
    if not text:
        return []

    hints: list[int] = []
    normalized = text.replace(",", "")

    for base, power in re.findall(r"(\d+)\s*\^\s*(\d+)", normalized):
        try:
            hints.append(int(base) ** int(power))
        except Exception:
            continue

    for mantissa, exponent in re.findall(r"(\d+)\s*e\s*(\d+)", normalized, flags=re.IGNORECASE):
        try:
            hints.append(int(mantissa) * (10 ** int(exponent)))
        except Exception:
            continue

    for token in re.findall(r"-?\d+", normalized):
        try:
            hints.append(int(token))
        except Exception:
            continue

    return hints


def _parse_int_token(token: str) -> Optional[int]:
    token = token.strip().lower().replace(",", "")
    if not token:
        return None
    if "^" in token:
        parts = token.split("^", 1)
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            return int(parts[0]) ** int(parts[1])
    match = re.fullmatch(r"(\d+)e(\d+)", token)
    if match:
        return int(match.group(1)) * (10 ** int(match.group(2)))
    if re.fullmatch(r"-?\d+", token):
        return int(token)
    return None


def find_named_upper_bound(text: Optional[str], names: list[str]) -> Optional[int]:
    if not text:
        return None
    normalized = text.lower().replace("≤", "<=").replace("≥", ">=")

    for name in names:
        escaped = re.escape(name.lower())
        patterns = [
            rf"{escaped}\s*<=\s*([0-9eE\^]+)",
            rf"{escaped}\s*<\s*([0-9eE\^]+)",
            rf"[0-9eE\^]+\s*<=\s*{escaped}\s*<=\s*([0-9eE\^]+)",
            rf"[0-9eE\^]+\s*<\s*{escaped}\s*<=\s*([0-9eE\^]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, normalized)
            if not match:
                continue
            value = _parse_int_token(match.group(1))
            if value is not None:
                return value
    return None


def find_named_abs_bound(text: Optional[str], names: list[str]) -> Optional[int]:
    if not text:
        return None
    normalized = text.lower().replace("≤", "<=").replace("≥", ">=")

    for name in names:
        escaped = re.escape(name.lower())
        patterns = [
            rf"\|\s*{escaped}\s*\|\s*<=\s*([0-9eE\^]+)",
            rf"abs\(\s*{escaped}\s*\)\s*<=\s*([0-9eE\^]+)",
            rf"{escaped}\s*<=\s*([0-9eE\^]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, normalized)
            if not match:
                continue
            value = _parse_int_token(match.group(1))
            if value is not None:
                return value
    return None


def guess_array_limits(
    context: JsonDict,
    n_default: int = 200000,
    value_default: int = 1000000000,
    count_names: Optional[list[str]] = None,
    value_names: Optional[list[str]] = None,
) -> JsonDict:
    count_names = count_names or ["n", "m", "q"]
    value_names = value_names or ["a", "ai", "a_i", "x", "val"]

    external = read_external_config(context)
    constraints = None
    problem = context.get("problem")
    if isinstance(problem, dict):
        constraints = problem.get("constraints")

    n_max = external.get("n_max")
    if not isinstance(n_max, int):
        n_max = find_named_upper_bound(constraints, count_names) or n_default

    value_max = external.get("value_max")
    if not isinstance(value_max, int):
        value_max = find_named_abs_bound(constraints, value_names) or value_default

    value_min = external.get("value_min")
    if not isinstance(value_min, int):
        value_min = -value_max

    n_min = external.get("n_min")
    if not isinstance(n_min, int):
        n_min = 1

    return {
        "n_min": n_min,
        "n_max": n_max,
        "value_min": value_min,
        "value_max": value_max,
    }


def build_json_output(input_text: str, metadata: Optional[JsonDict] = None) -> str:
    return json.dumps(
        {
            "input": input_text,
            "metadata": metadata or {},
        },
        ensure_ascii=False,
    )


def load_cyaron_backend():
    try:
        from cyaron import Vector, randint  # type: ignore

        return {
            "available": True,
            "Vector": Vector,
            "randint": randint,
        }
    except Exception:
        class _FallbackVector:
            @staticmethod
            def random(n, ranges):
                left, right = ranges[0]
                return [random.randint(left, right) for _ in range(n)]

        def _fallback_randint(left: int, right: int) -> int:
            return random.randint(left, right)

        return {
            "available": False,
            "Vector": _FallbackVector,
            "randint": _fallback_randint,
        }
