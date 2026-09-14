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
- [ ] npm 배포 create-harness-cli@0.3.1 (discoverability: keywords + README badges + GitHub topics)
- [x] Storybook Option A — 설치 시 의향 질문, config에 상태 기록 (`off` | `pending` | `ready`)
- [x] Brownfield Atomic baseline — 기존 페이지 raw JSX 유예 목록 (`.harness/atomic-baseline.json`)
- [x] 페이지 raw JSX 금지 ESLint 규칙 — intrinsic elements 직접 사용 error (유예 파일은 warning)
- [x] Storybook 상태 기반 조건부 강제 준비 (ready 상태에서만 story 요구사항 활성화할 구조)

## v0.4

- [ ] `node-be` 프리셋
- [ ] `monorepo` 프리셋
- [ ] Figma / Storybook MCP 연동

## 논의 필요

(확정 안 된 아이디어는 여기에 적는다. 바로 TODO로 승격하지 않는다.)

- 유예 목록이 오래 방치되지 않게 하는 장치 — 예: `/verify` 가 남은 baseline 개수를
  같이 출력하거나, 유예 파일을 수정하면서 원시값을 남기면 경고
- Tailwind 프로젝트를 위한 최소한의 강제 수단 — 현재는 그냥 비권장으로 두고 있다.
  임의값(`bg-[#hex]`) 차단 ESLint 규칙만 별도 모듈로 떼는 안은 검토 가치가 있다
