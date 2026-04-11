#!/usr/bin/env python3
import re
import sys

MAX_DIGITS = 2048
INTEGER_RE = re.compile(r"^(0|[1-9][0-9]*)$")


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def main() -> int:
    content = sys.stdin.read()
    if not content:
        return fail("empty_input")
    if not content.endswith("\n"):
        return fail("missing_trailing_newline")

    lines = content.splitlines()
    if len(lines) != 1:
        return fail("expected_single_line_integer")

    token = lines[0].strip()
    if not token:
        return fail("missing_integer")
    if not INTEGER_RE.fullmatch(token):
        return fail("invalid_decimal_integer")
    if len(token) > MAX_DIGITS:
        return fail("too_many_digits")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
