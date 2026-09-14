# {{PROJECT_NAME}} — Agent Guide

> 이 파일은 모든 AI 에이전트(Cursor, Claude Code 등)가 항상 읽는 정본이다.
> 짧게 유지한다. 상세 규칙은 `{{RULES_DIR}}/` 에 있고, 해당 파일을 만질 때 로드된다.

## 프로젝트 개요

<!-- TODO: 한 문단으로 채우세요. 무엇을 하는 서비스이고, 핵심 도메인 용어는 무엇인지 -->

## 자주 쓰는 명령어

```bash
{{PM_RUN}} dev          # 개발 서버
node .harness/gates/run-checks.mjs   # 전체 검증 (.harness/config.json 의 checks 순차 실행)
```

## 검증 게이트

- 커밋 전 **반드시** `node .harness/gates/run-checks.mjs` 가 통과해야 한다.
  커밋 게이트(`.harness/gates/pre-commit-gate.sh`)가 실패 시 커밋을 거부한다.
- 검증 목록은 `.harness/config.json` 의 `checks` 배열이다. 체크를 추가/제거하려면 이 파일을 수정한다.
- 테스트를 통과시키기 위해 단정문(assertion)을 약화시키지 않는다. 실패하면 코드를 고친다.

## 워크플로

| 커맨드 | 용도 |
|--------|------|
| `/spec <기능>` | 구현 전 명세 작성 (`docs/specs/`) — 수용 기준은 테스트로 번역 가능해야 함 |
| `/impl <slug>` | 명세 기반 구현 — 실패하는 테스트 먼저 (Red → Green → Refactor) |
| `/verify` | checks 순차 실행, 실패 시 수정 루프 |
| `/ship` | 검증 → 커밋 → `docs/task-log.md` 기록 |
{{#if DESIGN_SYSTEM}}| `/ds-init` | Storybook 온디맨드 설치 (최초 UI 작업 전 1회) |
| `/ds-add` | 페이지 착수 전 Atomic 계층(atom → molecule → organism) 컴포넌트 + 스토리 선행 추가 |
| `/ux-review` | 인터랙션 상태·토큰 사용·시각적 완성도 리뷰 — 테스트로 못 옮기는 품질을 다룬다 |
{{/if}}

## 절대 금지

| 금지 | 이유 |
|------|------|
| `any` 타입 | 타입 안전성 포기. `unknown` + 좁히기를 쓴다 |
| `git commit --no-verify` | 게이트 우회 금지 |
| `git push --force` (보호 브랜치) | 이력 파괴. 필요하면 `--force-with-lease` + 사전 협의 |
| `.env*` 파일 커밋 | 시크릿 유출 |
| 라우트(페이지) 컴포넌트에 비즈니스 로직 | hooks/queries 레이어로 내린다 (`{{RULES_DIR}}/10-architecture` 참고) |
{{#if DESIGN_SYSTEM}}| CSS 색상 원시값 (`#hex`, `rgb()`) | 디자인 토큰만 사용. stylelint가 error 처리 |
| 페이지 파일에 일회성 마크업·스타일 | Atomic 계층부터 만들고 페이지는 조립만 (`{{RULES_DIR}}/30-design-system`) |
| Atomic 계층 역방향 import (atom → molecule 등) | 재사용 단위가 상위 계층에 끌려간다. ESLint가 error 처리 |
{{/if}}| 테스트 단정문 약화로 통과시키기 | 검증의 의미가 사라진다 |

## 설치·설정 질문이 비어 있을 때

에이전트가 `create-harness-cli`를 실행하려는데 사용자가 답변을 미리 지정하지 않았다면:

1. **CLI 질문 4가지를 먼저 채팅에서 물어본다**:
   - 대상 에이전트: Cursor and/or Claude Code
   - 포함 모듈: design-system, auth-http, data-fetching, lint (core는 항상 포함)
{{#if DESIGN_SYSTEM}}   - Storybook 계획 (design-system 선택 시): 사용 의향 있으면 `pending`, 없으면 `off`
{{/if}}   - ponytail 설치 여부
2. 답을 받으면 **명시적 플래그와 함께 `-y`로 CLI를 실행**한다
   - 예: `--agents cursor,claude --modules design-system,lint --storybook pending --ponytail -y`
   - 명시적 플래그 + `-y`는 "묻지 말고 이 값들 사용"을 의미 (조용한 기본값이 아님)
   - 값 없이 `-y`만 쓰면 안 됨 — 추론된 기본값이 의도와 다를 수 있다
3. `.harness/config.json`에 이미 해당 필드가 있으면 재질문하지 않는다
{{#if DESIGN_SYSTEM}}

**Storybook 상태별 처리**:
- `off`: `/ds-init` 실행 전 사용자에게 확인 — 동의 시에만 설치 진행
- `pending`: 첫 UI 작업 시 `/ds-init` 실행 가능 (확인 권장, 필수 아님)
- `ready`: 이미 설치됨, 추가 확인 불필요
{{/if}}

## 장기 기억 문서

| 파일 | 용도 |
|------|------|
| `docs/architecture.md` | 구조가 바뀔 때 갱신 |
| `docs/decisions.md` | 결정과 **근거** (결론만 적지 않는다) |
| `docs/product-spec.md` | 기능 명세 + TODO 목록 |
| `docs/task-log.md` | `/ship` 시 자동 기록 |
