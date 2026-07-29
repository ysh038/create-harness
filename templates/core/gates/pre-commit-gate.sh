#!/usr/bin/env bash
# 두 도구(Cursor·Claude Code)가 공유하는 커밋 게이트 진입점.
# 훅 입력 JSON은 stdin으로 들어오고, $1 로 어느 도구인지 받는다.
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$GATE_DIR/gate.mjs" "${1:-cursor}"
