# create-harness TODO

> 이 파일은 **create-harness CLI 자체를 만드는** 작업 기록이다.
> 대상 프로젝트로 복사되는 산출물이 아니며, npm 패키지에도 포함되지 않는다
> (`package.json`의 `files` 화이트리스트가 `dist`·`templates`만 포함).

## v0.1

- [ ] CLI 스켈레톤 (bin·detect·prompts·render·manifest·registry, `--dry-run`)
- [ ] 컨벤션 정본 → `AGENTS.md` / `CLAUDE.md` / `.cursor/rules/*.mdc` fan-out
- [ ] 참조 구현 (axios 인터셉터 + refreshPromise·ProtectedRoute·queries 3계층·IApiResponse·Zustand 모달 스토어)
- [ ] 린트 강제 (naming-convention·import/order·no-restricted-paths·tsconfig strict·commitlint)
- [ ] `.harness/config.json` checks 목록 + 순차 러너 (레벨 개념 없음)
- [ ] 커밋 게이트 — 단일 `pre-commit-gate.sh`를 Cursor `beforeShellExecution` + Claude `PreToolUse` 양쪽에 연결
- [ ] 워크플로 6종 (spec / impl / verify / ship / ds-init / ds-add) fan-out
- [ ] 디자인시스템 (규칙 mdc·tokens 스켈레톤·stylelint 색상만 error·스토리 템플릿, Storybook은 `/ds-init` 온디맨드)
- [ ] 생성 문서 스켈레톤 (docs/architecture·decisions·product-spec·task-log + specs/_template)
- [ ] manifest(sha256)·충돌 처리 (`.harness/incoming/`)
- [ ] 실사용 검증 (hrd-aimon-fe 사본) + 트리 스냅샷 테스트 + `npm pack` 누출 검증 테스트 + README

## v0.2

- [ ] `create-harness update` — manifest 해시로 로컬 수정을 구분하는 3-way 병합
- [ ] `.claude-plugin/marketplace.json` — Claude Code 플러그인 배포 채널
- [ ] self-hosting: create-harness를 자기 저장소에 적용 (dogfooding)

## v0.3

- [ ] `node-be` 프리셋
- [ ] `monorepo` 프리셋
- [ ] Figma / Storybook MCP 연동

## 논의 필요

(확정 안 된 아이디어는 여기에 적는다. 바로 TODO로 승격하지 않는다.)
