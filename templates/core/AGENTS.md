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
| `/ds-init` | Storybook 온디맨드 설치 (최초 UI 작업 전 1회) |
| `/ds-add` | 레이아웃 착수 전 디자인시스템 컴포넌트 + 스토리 선행 추가 |

## 절대 금지

| 금지 | 이유 |
|------|------|
| `any` 타입 | 타입 안전성 포기. `unknown` + 좁히기를 쓴다 |
| `git commit --no-verify` | 게이트 우회 금지 |
| `git push --force` (보호 브랜치) | 이력 파괴. 필요하면 `--force-with-lease` + 사전 협의 |
| `.env*` 파일 커밋 | 시크릿 유출 |
| 라우트(페이지) 컴포넌트에 비즈니스 로직 | hooks/queries 레이어로 내린다 (`{{RULES_DIR}}/10-architecture` 참고) |
| CSS 색상 원시값 (`#hex`, `rgb()`) | 디자인 토큰만 사용. stylelint가 error 처리 |
| 테스트 단정문 약화로 통과시키기 | 검증의 의미가 사라진다 |

## 장기 기억 문서

| 파일 | 용도 |
|------|------|
| `docs/architecture.md` | 구조가 바뀔 때 갱신 |
| `docs/decisions.md` | 결정과 **근거** (결론만 적지 않는다) |
| `docs/product-spec.md` | 기능 명세 + TODO 목록 |
| `docs/task-log.md` | `/ship` 시 자동 기록 |
