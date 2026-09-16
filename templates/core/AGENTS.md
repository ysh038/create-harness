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
{{#if DESIGN_SYSTEM}}- **Write-time enforcement**: UI 파일(페이지, design-system 컴포넌트) 작성 시점에 다음을 차단한다:
  * Storybook `pending`/`ready` 상태인데 `.storybook/` 없으면 → `/ds-init` 먼저 실행
  * 커밋하지 않아도 **파일 쓰기 시점에** 차단되므로 정책 위반 코드가 남지 않는다.
{{/if}}{{#if HAS_DESIGN_REFS}}- **Design ref enforcement**: inspire/implement 모드에서 페이지/화면 작성 시 design-references.json 항목 필요.
  * 항목 없으면 파일 쓰기가 차단되고, 먼저 디자인 참조를 물어보라는 메시지가 표시된다.
  * 읽기 실패한 참조(lastReadOk: false)로는 UI 작성 불가 — 다른 참조 제공 또는 명시적 waive 필요.
{{/if}}

## 디자인 모드 및 코딩 스타일

- **디자인 모드**: `{{DESIGN_MODE}}`{{#if HAS_DESIGN_FIDELITY}} (충실도: `{{DESIGN_FIDELITY}}`){{/if}}
- **컴포넌트 선언**: `{{COMPONENT_DECLARATION}}`
- **컴포넌트 export**: `{{COMPONENT_EXPORT}}`
- **스타일링**: `{{STYLING}}`

디자인 모드별 행동:
- `free` — 디자인 참조 없이 자율 구현
- `inspire` — 디자인을 영감으로 활용, 재해석 허용
- `implement` — 제공된 디자인과 최대한 일치, 자유로운 재디자인 금지

{{#if HAS_DESIGN_REFS}}
### 디자인 참조 맵

`.harness/design-references.json` — 에이전트가 관리하는 디자인 참조 레지스트리.

**세 가지 모드별 정책**:

1. **`inspire` 모드** — 화면/페이지마다:
   - 읽을 수 있는 참조가 이미 있으면 → 영감으로 활용 (재해석 허용)
   - 없으면 → 물어봄: 「이 화면에 참고할 피그마/URL/캡처 있어요? (있음 / 없음 / 나중에)」
     * **없음** → `waived` 기록, 진행 OK
     * **나중에** → `needed` 기록, 진행 OK
     * **있음** → URL/이미지 받아 **즉시 읽기 시도**
   - 읽기 실패 시 → **STOP**. 다른 Figma 노드 URL 또는 스크린샷 요청 (또는 명시적 waive)

2. **`implement` 모드** — 화면/페이지마다:
   - 같은 타이밍에 물어봄 (inspire와 동일 질문)
   - `needed` 만으로는 UI 작업 시작 불가 — 지금 제공하거나 `waived` 선택 필요
   - 읽기 실패 시 → **STOP**. UI 작성하지 않음. 다른 Figma 노드 URL 또는 스크린샷 요청.
   - 성공적으로 읽은 참조(`linked`, `lastReadOk: true`) 또는 명시적 `waived`만 UI 작업 허용

**"성공적으로 읽음" 정의** — 참조 종류별 라우팅:
1. **Figma** (`figma.com`, `figjam` URL): 사용자 Figma MCP로 design context 및/또는 스크린샷 획득. 성공 = 사용 가능한 컨텍스트/이미지 받음.
2. **이미지** (png/jpg/webp/gif URL 또는 첨부): fetch/open해 에이전트가 볼 수 있는지 확인. 성공 = 이미지 로드됨.
3. **기타 URL** (Notion, Drive, 일반 웹): 믿을 수 있는 match를 보장하지 못함. 사용자에게 지원 불가 알리고 Figma 노드 URL 또는 내보낸 스크린샷 요청. 읽기 실패로 간주.

**성공 후에만** `status: 'linked'` + `lastReadOk: true` 기록. 실패한 시도는 fake `linked` 상태로 남기지 않음.

**질문 빈도**: 화면/페이지 단위로 1회 (매 메시지마다 X). 맵에 기존 항목(`linked`/`waived`/`needed`)이 있으면 재질문 안 함.
**Figma 접근**: 사용자 MCP 설정으로 제공 (CLI는 API 키를 다루지 않음).
{{/if}}

### 코딩 스타일 준수

위에 명시된 스타일 선호를 **항상** 따른다:
- 컴포넌트 선언: `{{COMPONENT_DECLARATION}}` 키워드 사용
- export: `{{COMPONENT_EXPORT}}` 방식 사용
- 스타일: `{{STYLING}}` 패턴 사용

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
{{/if}}{{#if HAS_DESIGN_REFS}}| `/ds-ref` | 디자인 소스 등록 및 참조 맵 관리 |
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
{{/if}}{{#if HAS_DESIGN_REFS}}| **inspire/implement 모드: 디자인 참조 없이 새 페이지/화면 UI 작성** | **반드시 먼저** design-references.json 에 기록하거나 사용자에게 디자인 링크를 물어본다. 커밋 게이트가 누락 시 실패 처리 |
| **implement 모드: 읽기 실패한 참조로 UI 작성** | 사용자가 제공한 참조를 읽을 수 없으면 **STOP**. 다른 Figma 노드 URL 또는 스크린샷 요청. `linked` 는 성공적으로 읽은 후에만 |
{{/if}}| 테스트 단정문 약화로 통과시키기 | 검증의 의미가 사라진다 |

## 설치·설정 질문이 비어 있을 때

에이전트가 `create-harness-cli`를 실행하려는데 사용자가 답변을 미리 지정하지 않았다면:

1. **CLI와 같은 설치 질문을 채팅에서 먼저 물어본다** (`/harness-setup` 참고):
   - 언어 선택: 한국어 또는 English
   - 프로젝트 유형(`mode`): 자유롭게 / 톤만 참고 / 회사·피그마 맞추기
   - 코딩 스타일: 선언(function|arrow), 스타일링(필요 시)
   - 대상 에이전트: Cursor and/or Claude Code
   - 포함 모듈: design-system, auth-http, data-fetching, lint (core는 항상 포함)
{{#if DESIGN_SYSTEM}}   - Storybook 계획 (design-system 선택 시): 사용 의향 있으면 `pending`, 없으면 `off`
{{/if}}2. 답을 받으면 **명시적 플래그와 함께 CLI를 실행**한다
   - 예: `--lang ko --mode implement --component-declaration function --agents cursor --modules design-system,lint --storybook pending`
   - **모든 필수 답변을 플래그 또는 `--config <path.json>`으로 제공**
   - Non-TTY 환경에서 필수 답변 누락 시 즉시 에러 (stdin 프롬프트로 걸리지 않음)
3. `.harness/config.json`에 이미 해당 필드가 있으면 재질문하지 않는다
{{#if DESIGN_SYSTEM}}4. **디자인 화면 작업**은 `/ds-add` (컴포넌트 추가) 워크플로에서 처리
   - **새 화면/페이지 작업을 시작할 때 (매 채팅 메시지가 아닌 화면 단위로 1회)**:
     * design-references.json에 해당 화면 항목이 **이미 있으면** (`linked`/`waived`/`needed`) → 재질문 안 함
     * 사용자 메시지에 URL/이미지가 **포함되어 있으면** → **즉시 읽기 시도** → 성공 시 `linked` 저장, 실패 시 아래 정책 적용
     * 둘 다 없으면 → **반드시 물어봄**: 「이 화면에 참고할 피그마/URL/캡처 있어요? (있음 / 없음 / 나중에)」
   - **답변에 따른 처리**:
     * **있음** → URL/이미지 받아 **즉시 읽기 시도**
       - **읽기 성공** → `linked` + `lastReadOk: true` 기록, UI 작업 진행 OK
       - **읽기 실패** (inspire/implement 동일) → **STOP**. UI 작성하지 않음. 다른 Figma 노드 URL 또는 스크린샷 요청 (또는 명시적 waive)
     * **없음** → `waived` 기록, 진행 OK (inspire/implement 모두 허용)
     * **나중에** → `needed` 기록
       - inspire: 진행 OK
       - implement: `needed` 만으로는 UI 작업 불가 — 지금 제공하거나 waive 필요
   - **읽기 방법** (참조 종류별):
     1. Figma: 사용자 MCP로 design context/screenshot
     2. 이미지: fetch/open 확인
     3. 기타 URL: 지원 불가, Figma 노드 또는 스크린샷 요청
{{/if}}{{#if HAS_DESIGN_REFS}}   - `/ds-ref` (디자인 링크 맵 관리) — 나중에 URL 추가 또는 소스 등록
{{/if}}
{{#if DESIGN_SYSTEM}}

**Storybook 상태별 처리**:
- `off`: `/ds-init` 실행 전 사용자에게 확인 — 동의 시에만 설치 진행
- `pending`: `.storybook/` 없고 새 UI 작업 시 **반드시 먼저** `/ds-init` 실행 (커밋 게이트가 체크)
- `ready`: 이미 설치됨, 추가 확인 불필요
{{/if}}

## 장기 기억 문서

| 파일 | 용도 |
|------|------|
| `docs/architecture.md` | 구조가 바뀔 때 갱신 |
| `docs/decisions.md` | 결정과 **근거** (결론만 적지 않는다) |
| `docs/product-spec.md` | 기능 명세 + TODO 목록 |
| `docs/task-log.md` | `/ship` 시 자동 기록 |
