#!/usr/bin/env bash
# before-shell-gate.sh — Shell 명령 실행 전 검증 wrapper
set -euo pipefail

GATES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "$GATES_DIR/before-shell-gate.mjs" "$1"
