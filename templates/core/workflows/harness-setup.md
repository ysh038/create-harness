---
description: Interactive harness installation workflow for agents - mirrors CLI install survey questions in chat.
---

# /harness-setup — 하네스 설치 (에이전트용)

사용자가 "하네스 설치해줘" / "create-harness 깔아줘" 등으로 요청했을 때 이 워크플로를 실행한다.

## 사전 조건

- `.harness/config.json` 이 **이미 존재**하고 필요한 답변이 모두 채워져 있으면 이 워크플로를 건너뛴다
- CLI를 재실행해도 무방한 경우(설정 변경)라면 명시적 플래그로 다시 실행 가능

## 절차

1. **설치 질문 4가지를 채팅에서 먼저 묻는다** (CLI의 대화형 프롬프트와 동일):

   **Q1. 대상 에이전트**
   - Cursor and/or Claude Code
   - 하나 또는 둘 다 선택 가능

   **Q2. 포함 모듈** (core는 항상 포함, 추가 선택)
   - `design-system`: 토큰 스켈레톤 + stylelint(색상 원시값 차단) + Atomic 계층 규칙 + 스토리 템플릿
   - `auth-http`: axios 인터셉터(토큰 첨부·refresh·401) + ProtectedRoute
   - `data-fetching`: queries 3계층 샘플 + IApiResponse + Zustand 스토어
   - `lint`: 명명 규칙·import 경계 ESLint 조각 + prettier + commitlint
   - 다중 선택 가능, 하나도 선택 안 해도 됨 (core만 설치)

   **Q3. Storybook 계획** (Q2에서 `design-system` 선택 시에만)
   - "Storybook을 사용할 계획인가요?"
   - yes → `storybook: "pending"` (나중에 `/ds-init` 으로 설치)
   - no → `storybook: "off"` (비활성화, `/ds-init` 실행 전 재확인 필요)

   **Q4. ponytail 설치**
   - "ponytail도 함께 설정할까요?" (YAGNI 사다리, 최소 구현 강제 규칙)
   - yes/no

2. **답변을 받으면 명시적 플래그와 함께 `-y`로 CLI 실행**:

```bash
{{PM_EXEC}} create-harness-cli <project-path> \
  --agents <cursor|claude|cursor,claude> \
  --modules <모듈1,모듈2,...> \
  --storybook <off|pending> \
  --ponytail \
  -y
```

   **중요**: 
   - 명시적 플래그 (`--agents`, `--modules`, `--storybook`, `--ponytail`)와 함께 `-y`를 사용한다
   - 이는 "묻지 말고 이 값들을 사용하라"는 의미다 (조용한 기본값이 아님)
   - 값 없이 단순히 `-y`만 쓰면 추론된 기본값을 쓰게 되어 의도와 다를 수 있다
   - `--storybook`은 design-system 모듈 선택 시에만 전달 (선택 안 했으면 생략)

3. **설치 완료 후**:
   - `.harness/config.json` 이 생성됐는지 확인
   - `AGENTS.md` TODO 절을 확인해 브랜드 컬러 등 프로젝트별 정보를 채우라고 안내
   - 커밋 게이트가 설치됐음을 알림: 이제 커밋 전 `node .harness/gates/run-checks.mjs` 가 자동 실행됨

## 완료 조건

- `.harness/config.json` 존재, `checks` 배열과 `storybook` 필드가 채워짐
- 선택한 에이전트별 파일 생성 (`.cursor/rules/` 또는 `.claude/skills/`)
- 선택한 모듈의 산출물 생성 (토큰·참조 구현·설정 파일)
- 커밋 게이트 설치 (`.harness/gates/pre-commit-gate.sh`)
