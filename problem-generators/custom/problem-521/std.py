#!/usr/bin/env python3
import sys


def main() -> None:
    token = sys.stdin.read().strip()
    if not token:
        raise SystemExit("missing_input")
    n = int(token)
    answer = (n + 1) * (n + 2) * (n + 3) * (n + 4) // 24
    sys.stdout.write(f"{answer}\n")


if __name__ == "__main__":
    main()
