# create-harness — Agent Guide

AI 에이전트 하네스(컨벤션·검증 게이트·워크플로)를 기존 프로젝트에 얹는 스캐폴딩 CLI.

## 영역 경계 (가장 중요)

- **`templates/` 아래는 다른 프로젝트로 복사되는 산출물이다.**
  그 밖의 파일(`src/`, `test/`, 루트 문서)은 이 CLI 자체의 코드와 기록이다.
- "대상 프로젝트용 규칙/문서를 수정하라"는 지시를 받으면 반드시 `templates/` 안에서 고친다.
- 루트의 `TODO.md`·`DECISIONS.md` 는 이 CLI를 만드는 내부 기록이다. 대상 프로젝트용
  결정 기록 템플릿은 `templates/core/docs/decisions.md` — 혼동하지 않는다.
- 렌더러(`src/render.ts`)의 소스 루트는 `templates/` 하나로 하드코딩되어 있다. 바꾸지 않는다.
- npm 배포 범위는 `package.json` 의 `files: ["dist", "templates"]` 화이트리스트다.
  루트 문서가 tarball에 새지 않는 것은 `test/scaffold.test.ts` 가 검증한다.

## 명령어

```bash
npm run check       # typecheck → build → test (커밋 전 필수)
npm run dev -- <대상경로> --yes --dry-run   # 로컬에서 CLI 실행
```

## 구조

```
src/cli.ts        # 인자 파싱·오케스트레이션
src/detect.ts     # 대상 프로젝트 감지 (package.json·react·vite·기존 에이전트 파일)
src/registry.ts   # 템플릿 → 파일 계획 fan-out (단일 정본 → 도구별 포맷)
src/render.ts     # {{VAR}} 치환, frontmatter 파서
src/manifest.ts   # sha256 기록, 충돌 시 .harness/incoming/ 배치
templates/core/       # 프리셋 무관: 컨벤션 정본·워크플로·게이트·docs
templates/presets/    # react-fe: 참조 구현·디자인시스템·lint 설정
```

## 규칙

- 새 템플릿 파일을 추가하면 `src/registry.ts` 에 등록하고 스냅샷 테스트를 갱신한다.
- 결정을 내리면 `DECISIONS.md` 에 근거와 함께 기록한다.
- 남은 작업은 `TODO.md` 에 있다. 완료하면 체크한다.
