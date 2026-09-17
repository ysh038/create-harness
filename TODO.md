# create-harness TODO

> 이 파일은 **create-harness CLI 자체를 만드는** 작업 기록이다.
> 대상 프로젝트로 복사되는 산출물이 아니며, npm 패키지에도 포함되지 않는다
> (`package.json`의 `files` 화이트리스트가 `dist`·`templates`만 포함).

## v0.1

- [x] CLI 스켈레톤 (bin·detect·prompts·render·manifest·registry, `--dry-run`)
- [x] 컨벤션 정본 → `AGENTS.md` / `CLAUDE.md` / `.cursor/rules/*.mdc` fan-out
- [x] 참조 구현 (axios 인터셉터 + refreshPromise·ProtectedRoute·queries 3계층·IApiResponse·Zustand 모달 스토어)
- [x] 린트 강제 (naming-convention·import/order·공개 API 경계·commitlint)
- [x] `.harness/config.json` checks 목록 + 순차 러너 (레벨 개념 없음)
- [x] 커밋 게이트 — 단일 `pre-commit-gate.sh`를 Cursor `beforeShellExecution` + Claude `PreToolUse` 양쪽에 연결
- [x] 워크플로 6종 (spec / impl / verify / ship / ds-init / ds-add) fan-out
- [x] 디자인시스템 (규칙 mdc·tokens 스켈레톤·stylelint 색상만 error·스토리 템플릿, Storybook은 `/ds-init` 온디맨드)
- [x] 생성 문서 스켈레톤 (docs/architecture·decisions·product-spec·task-log + specs/_template)
- [x] manifest(sha256)·충돌 처리 (`.harness/incoming/*.incoming`)
- [x] 실사용 검증 (hrd-aimon-fe 사본: checks 5종 통과·게이트 deny/allow·/ds-init Storybook 설치·a11y=error 실패 판정) + 트리 스냅샷 테스트 + `npm pack` 누출 검증 테스트 + README
- [ ] Cursor·Claude 실제 세션에서 규칙·커맨드·훅 로드를 눈으로 확인 (프로그램 검증 불가 항목)
- [x] npm 이름 충돌 발견 및 해결 — `create-harness`는 무관한 기존 패키지(uiharness)가
  선점 중이라 `npx create-harness`가 그 패키지를 실행하고 있었다. `create-harness-cli`로
  개명 (`package.json` name·bin, `src/cli.ts` 도움말, README). 근거: `DECISIONS.md` #13
- [x] npm 배포 (`npm publish`) — v0.2.2 배포 완료; v0.3.0 은 이 릴리스에서 배포

## v0.2

- [x] 감지 결과로 모듈 기본 선택값 결정 (`suggest.ts`) — 설치 직후 컴파일·통과하는 모듈만 기본 ON, 제외 이유를 항상 출력
- [x] 모듈 미선택 시 그 모듈을 전제하는 규칙·워크플로도 제외 (렌더러 `{{#if}}` 블록 + `RULE_MODULE_REQUIREMENT`)
- [x] 하네스 입장 명시 — design-system 권장 / Tailwind 비권장 (CLI 권고 출력 + README)
- [x] eslint `.harness/**` ignores 자동 패치 (`eslintPatch.ts`, 멱등·미인식 시 조각만 출력)
- [x] 브라운필드 stylelint 유예 — `.harness/stylelint-baseline.json` 파일 단위 override (새 파일은 error 유지)
- [x] `rgb()`·`hsl()` 이 토큰 강제를 빠져나가던 문제 수정 (`ignoreFunctions` 기본값)
- [x] UI 규칙을 Atomic 계층으로 전환 — `design-system/{atoms,molecules,organisms}` + 도메인 결합 시
      `components/{Domain}` 으로 분리, `/ds-add` 가 화면 분해를 선행 강제, 계층 역방향 import를
      ESLint error로 차단 (위반 픽스처 lint로 검증 — DECISIONS #14)
- [x] 색상 토큰을 primitive → semantic 2계층으로 재구성(hover/pressed/subtle, focus-ring) +
      장식·모션 토큰(`--duration-*`/`--easing-*`, 그림자 사용 기준) + `/ux-review` 워크플로 신설
      (AC로 못 옮기는 시각적 품질 리뷰 — 실사용 A/B 비교로 드러난 문제, DECISIONS #15·#16)
- [ ] `create-harness update` — manifest 해시로 로컬 수정을 구분하는 3-way 병합
- [ ] `.claude-plugin/marketplace.json` — Claude Code 플러그인 배포 채널
- [ ] self-hosting: create-harness를 자기 저장소에 적용 (dogfooding)

## v0.3

- [x] npm 배포 create-harness-cli@0.3.0 (+ git tag `v0.3.0`)
- [x] npm 배포 create-harness-cli@0.3.1 (discoverability: keywords + README badges + GitHub topics)
- [x] Storybook Option A — 설치 시 의향 질문, config에 상태 기록 (`off` | `pending` | `ready`)
- [x] Brownfield Atomic baseline — 기존 페이지 raw JSX 유예 목록 (`.harness/atomic-baseline.json`)
- [x] 페이지 raw JSX 금지 ESLint 규칙 — intrinsic elements 직접 사용 error (유예 파일은 warning)
- [x] Storybook 상태 기반 조건부 강제 준비 (ready 상태에서만 story 요구사항 활성화할 구조)

## v0.4

- [x] 프로젝트 디자인 모드 (free/inspire/implement) + fidelity
- [x] 에이전트 관리 디자인 참조 맵 (`.harness/design-references.json`)
- [x] 코딩 스타일 설문 + config 저장 (componentDeclaration/Export, styling)
- [x] 이중 진입점 (CLI 프롬프트 + 에이전트 재질문)
- [x] `/ds-ref` 워크플로 (디자인 소스·컴포넌트 링크 관리)
- [x] 면책 조항 (Figma 라이선스 책임)
- [x] AGENTS.md / ds-add.md 템플릿 업데이트
- [x] DECISIONS.md #22 기록
- [ ] 테스트 스냅샷 재생성 + 통과 확인
- [ ] npm 배포 create-harness-cli@0.4.0 (PR 병합 후)

## v0.4.1

- [x] `/ds-init` example naming — Example* 접두사로 제품 컴포넌트와 충돌 방지
- [x] `styling` 감지 개선 — CSS Modules 실제 감지, plain CSS 기본값 명시
- [x] `implement`/`inspire` 모드에서 Figma 변수를 브랜드 토큰 질문보다 먼저
- [x] 제품 스토리는 실제 사용 변형 포함해야 한다는 안내 추가
- [x] 모듈 선택 UX 개선 (비권장 경고 명확화)
- [x] Machine path 노트 (README)
- [x] DECISIONS.md #24 기록
- [x] 테스트 스냅샷 재생성 + 통과 확인 (45/45 통과)
- [x] npm 배포 create-harness-cli@0.4.1 (PR 병합 후, 수동)

## v0.4.2

- [x] `ds-add` must respect `config.style.styling` — 하드코딩된 `.module.css` 제거
- [x] AGENTS.md Mustache leak 수정 — `HAS_DESIGN_FIDELITY` 플래그 추가
- [x] Storybook peer dependency 안내 추가 (ds-init.md)
- [x] `/ds-ref` 올바른 화면 노드 필요성 노트 추가
- [x] 버전 0.4.2 bump (package.json)
- [x] DECISIONS.md #25 기록
- [x] AGENTS.md raw Mustache 테스트 추가 (여러 시나리오)
- [x] 테스트 스냅샷 재생성 + 통과 확인 (49/49 통과)
- [x] PR 생성 (https://github.com/ysh038/create-harness/pull/7)
- [ ] npm 배포 create-harness-cli@0.4.2 (PR 병합 후, 수동)

## v0.4.3

- [x] 설치 시 Figma URL 프롬프트 제거 (inspire/implement 모드 포함)
- [x] `--figma-url` 플래그는 유지 (power user용)
- [x] mode가 free가 아니면 빈 design-references.json 생성
- [x] harness-setup 워크플로 업데이트 (Figma URL 질문 제거)
- [x] AGENTS.md 업데이트 (설치 시 Figma 재질문 제거, /ds-add 시 물어보기)
- [x] ds-add 워크플로 강조 (있음/없음/나중에)
- [x] README 업데이트 (--figma-url 선택적)
- [x] 버전 0.4.3 bump (package.json)
- [x] DECISIONS.md #26 기록
- [ ] 테스트 스냅샷 재생성 + 통과 확인
- [ ] PR 생성
- [ ] npm 배포 create-harness-cli@0.4.3 (PR 병합 후, 수동)

## v0.5

- [ ] `node-be` 프리셋
- [ ] `monorepo` 프리셋

## v0.5.1

- [x] Dogfood 실패 분석: implement 모드에서 디자인 참조 ask 건너뜀
- [x] AGENTS.md 절대 금지에 디자인 참조 강제 규칙 추가
- [x] AGENTS.md 디자인 화면 작업 섹션 강화 (타이밍·순서 명확화)
- [x] ds-add.md 디자인 참조 확인을 step 0으로 이동
- [x] ds-add.md "컴포넌트 만든 후 물어보기" 블록 제거
- [x] templates/core/gates/design-ref-check.mjs 생성 (커밋 게이트 강제)
- [x] src/registry.ts: buildGateActions에 design-ref-check.mjs 추가
- [x] src/registry.ts: buildChecks에 design-ref check 추가
- [x] DECISIONS.md #29 기록
- [x] package.json 버전 0.5.1
- [x] test/scaffold.test.ts: design-ref-check 테스트 추가
- [x] npm run check 통과
- [x] PR 생성 (main 대상) — https://github.com/ysh038/create-harness/pull/11
- [ ] npm publish (PR 병합 후)

## v0.5.2

- [x] src/types.ts: IDesignEntry 확장 (ref.kind, lastReadAt, lastReadOk, readError)
- [x] templates/core/AGENTS.md: 디자인 참조 맵 섹션 + 절대 금지 + 디자인 화면 작업 섹션 업데이트
- [x] templates/core/workflows/ds-add.md: "0. 디자인 참조 확인 및 읽기" 절차 상세화
- [x] templates/core/workflows/ds-ref.md: "B. 컴포넌트 링크 등록 및 읽기 probe" + 규칙 업데이트
- [x] templates/core/gates/design-ref-check.mjs: inspire/implement 모드별 검증 강화
- [x] package.json: 버전 0.5.2
- [x] DECISIONS.md: #30 기록
- [x] npm run check 통과 (typecheck → build → test) — 60/60 tests passed
- [x] PR 생성 (main 대상) — https://github.com/ysh038/create-harness/pull/12
- [ ] npm publish (PR 병합 후)

## v0.5.4

- [x] templates/core/gates/pre-write-gate.mjs 생성 (Write/StrReplace 시점 체크)
- [x] templates/core/gates/pre-write-gate.sh 생성 (bash wrapper)
- [x] templates/core/gates/cursor-hooks.json: preToolUse 훅 추가
- [x] templates/core/gates/claude-settings.json: PreToolUse 훅 추가 (Write|StrReplace)
- [x] src/registry.ts: buildGateActions에 pre-write-gate 파일 추가
- [x] package.json: 버전 0.5.4
- [x] DECISIONS.md: #31 기록 (v12 dogfood 실패 분석)
- [x] templates/core/AGENTS.md: Write-time enforcement 섹션 추가
- [x] test/scaffold.test.ts: pre-write-gate 생성 테스트 추가
- [x] test/scaffold.test.ts: cursor-hooks.json / claude-settings.json preToolUse 훅 테스트
- [x] npm run check 통과 (typecheck → build → test) — 64/64 tests passed
- [x] PR 생성 (main 대상) — https://github.com/ysh038/create-harness/pull/14
- [ ] npm publish (PR 병합 후)

## v0.5.5

### Part A — Tailwind 실제 설치 + 와이어링
- [x] src/registry.ts: requiredDevDeps에 tailwindcss, @tailwindcss/vite 추가
- [x] templates/core/notes/tailwind-setup.md 생성 (설정 안내)
- [x] src/registry.ts: buildModuleActions에 Tailwind 노트 조건부 생성
- [x] templates/core/AGENTS.md: Tailwind 경고 추가
- [x] src/registry.ts: buildVars에 TAILWIND_SETUP 플래그 추가

### Part B — Layered enforcement (Shell bypass 차단)
- [x] templates/core/gates/ui-prereq-check.mjs 생성 (공유 체크 모듈)
- [x] templates/core/gates/before-shell-gate.sh 생성
- [x] templates/core/gates/before-shell-gate.mjs 생성 (Shell bypass 차단)
- [x] templates/core/gates/pre-write-gate.mjs 리팩토링 (공유 모듈 사용)
- [x] templates/core/gates/cursor-hooks.json: beforeShellExecution 변경 + matcher 확장
- [x] templates/core/AGENTS.md: STOP 체크리스트 추가
- [x] src/registry.ts: buildVars에 STORYBOOK_PENDING 플래그 추가
- [x] src/registry.ts: buildGateActions에 새 게이트 파일들 추가

### 문서 및 버전
- [x] package.json: 버전 0.5.5
- [x] DECISIONS.md: #33 기록 (v14 dogfood 실패 분석)
- [x] TODO.md: v0.5.5 체크리스트 추가

### 테스트
- [x] test/pre-write-gate.test.ts: ui-prereq-check.mjs 복사 추가
- [x] 테스트 스냅샷 재생성 (새 게이트 파일들 추가)
- [x] npm run check 통과 (typecheck → build → test) — 74/74 tests passed

### PR
- [ ] 변경사항 커밋 및 푸시
- [ ] PR 생성 (main 대상)
- [ ] npm publish (PR 병합 후)

## v0.6

(확정 안 된 아이디어는 여기에 적는다. 바로 TODO로 승격하지 않는다.)

- 유예 목록이 오래 방치되지 않게 하는 장치 — 예: `/verify` 가 남은 baseline 개수를
  같이 출력하거나, 유예 파일을 수정하면서 원시값을 남기면 경고
- Tailwind 프로젝트를 위한 최소한의 강제 수단 — 현재는 그냥 비권장으로 두고 있다.
  임의값(`bg-[#hex]`) 차단 ESLint 규칙만 별도 모듈로 떼는 안은 검토 가치가 있다
