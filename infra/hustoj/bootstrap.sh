#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$ROOT_DIR/hustoj"

if [ -d "$TARGET/.git" ]; then
  echo "HUSTOJ repo already exists at $TARGET"
  exit 0
fi

git clone https://github.com/zhblue/hustoj "$TARGET"
echo "Cloned HUSTOJ into $TARGET"
