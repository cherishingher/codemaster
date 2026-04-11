#!/usr/bin/env python3
import sys


def fail(message: str) -> int:
    print(message, file=sys.stderr)
    return 1


def main() -> int:
    content = sys.stdin.read()
    if not content.strip():
        return fail("empty_input")

    tokens = content.split()
    try:
        values = [int(token) for token in tokens]
    except ValueError:
        return fail("non_integer_token")

    if not values:
        return fail("missing_n")

    n = values[0]
    if n <= 0:
        return fail("n_must_be_positive")
    if len(values) != n + 1:
        return fail("token_count_mismatch")

    # TODO: replace with the real validator for your input format.
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
