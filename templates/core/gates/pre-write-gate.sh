#!/usr/bin/env bash
# 파일 쓰기 도구(Write/Edit/MultiEdit/StrReplace/ApplyPatch) 사용 시점 검사 진입점
set -euo pipefail

GATE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$GATE_DIR/pre-write-gate.mjs" "${1:-cursor}"
