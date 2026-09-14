---
description: Interactive harness installation workflow for agents - mirrors CLI install survey questions in chat.
---

# /harness-setup — 하네스 설치 (에이전트용)

사용자가 "하네스 설치해줘" / "create-harness 깔아줘" 등으로 요청했을 때 이 워크플로를 실행한다.

## 사전 조건

- `.harness/config.json` 이 **이미 존재**하고 필요한 답변이 모두 채워져 있으면 이 워크플로를 건너뛴다
- CLI를 재실행해도 무방한 경우(설정 변경)라면 명시적 플래그로 다시 실행 가능

## 절차

1. **설치 질문을 채팅에서 먼저 묻는다** (CLI 대화형 프롬프트와 동일):

   **Q1. 이 프로젝트는 어떤 작업인가요?** (`--mode`)
   - 자유롭게 만들기 (`free`) — 디자인 참고 없음
   - 톤만 참고할래요 (`inspire`) — URL 있으면 영감으로만
   - 회사 일, 피그마 화면 맞추기 (`implement`) — 준 화면을 맞춤

   **Q2. 코딩 스타일**
   - 컴포넌트 선언: `function` | `arrow` (`--component-declaration`)
   - export: `default` | `named` (`--component-export`)
   - 스타일: 감지되면 그대로, 애매하면 `css` | `css-modules` | `tailwind` (`--styling`)

   **Q3. 대상 에이전트**
   - Cursor and/or Claude Code

   **Q4. 포함 모듈** (core는 항상 포함)
   - `design-system` / `auth-http` / `data-fetching` / `lint`

   **Q5. Storybook 계획** (design-system 선택 시)
   - yes → `pending` / no → `off` (`--storybook`)

   **Q6. ponytail**
   - yes/no (`--ponytail`)

2. **답변을 받으면 명시적 플래그와 함께 CLI 실행**:

```bash
{{PM_EXEC}} create-harness-cli <project-path> \
  --mode <free|inspire|implement> \
  --component-declaration <function|arrow> \
  --component-export <default|named> \
  --styling <css|css-modules|tailwind> \
  --agents <cursor|claude|cursor,claude> \
  --modules <모듈1,모듈2,...> \
  --storybook <off|pending> \
  --ponytail
```

   **중요**:
   - 채팅에서 물은 값을 플래그로 넣는다
   - **모든 필수 답변을 제공** (non-TTY 환경에서 누락 시 에러)
   - 또는 `--config config.json` 으로 설정 파일 사용
   - `--storybook` / `--ponytail` 은 해당될 때만

3. **설치 완료 후**:
   - `.harness/config.json` 확인 (`mode`, `style`, `storybook` 등)
   - inspire/implement면 `.harness/design-references.json` 생겼는지 확인 (빈 맵으로 시작)
   - `AGENTS.md` TODO·브랜드 컬러 안내
   - 커밋 게이트 안내

## 완료 조건

- `.harness/config.json` 존재, 모드·스타일·checks·storybook 필드 반영
- inspire/implement면 디자인 참조 맵 시드(빈 맵으로 시작, 또는 free면 없음)
- 선택한 에이전트·모듈 산출물·커밋 게이트 설치
