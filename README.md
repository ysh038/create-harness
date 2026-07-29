# create-harness

> 기존 프로젝트에 AI 코딩 에이전트 하네스를 한 명령으로 얹는다.

`create-harness`는 앱을 새로 만드는 스캐폴더가 아니라, **이미 있는 프로젝트**에
AI 에이전트(Cursor, Claude Code)가 일관된 결과물을 내도록 하는 하네스를 설치하는 CLI다.

```bash
npx create-harness            # 현재 디렉터리에
npx create-harness ./my-app --yes --dry-run   # 계획만 확인
```

## 무엇이 생기나

두 축으로 구성된다.

**축 1 — 코딩 컨벤션** (에이전트가 무엇을 모방할지)

- `AGENTS.md` — 모든 도구가 읽는 짧은 정본. `CLAUDE.md` 는 `@AGENTS.md` 임포트 한 줄
- `.cursor/rules/*.mdc` 6종 — 레이어·명명·상태 4분류·디자인시스템·테스트·인증 규칙 (globs 조건부 로드)
- 참조 구현 — axios 인터셉터(refresh 중복 제거)·`ProtectedRoute`·queries 3계층·Zustand 스토어.
  산문 문서가 아니라 **컴파일되는 코드**라서 에이전트가 실제로 모방한다

**축 2 — 검증 게이트** (문서가 아니라 게이트로 강제)

- `.harness/config.json` — 프로젝트가 통과해야 하는 `checks` 목록 (대상 package.json 의
  scripts 를 감지해 실제 존재하는 것만 담는다)
- 커밋 게이트 — 같은 스크립트 하나를 Cursor(`beforeShellExecution`)와
  Claude Code(`PreToolUse`) 양쪽에 연결. checks 실패·`.env` 스테이징·force push 시 커밋 거부
- 워크플로 6종 — `/spec`(명세) → `/impl`(테스트 우선 구현) → `/verify` → `/ship`,
  UI 작업은 `/ds-init`(Storybook 온디맨드 설치)·`/ds-add`(레이아웃 전 컴포넌트 선행)
- 린트 강제 — 명명 규칙(`I` 접두 등)·공개 API 경계·색상 원시값 차단(stylelint)을 error 처리

## 옵션

```
npx create-harness [대상 디렉터리] [옵션]

--preset <name>     프리셋 (v0.1: react-fe)
--agents <csv>      cursor,claude (기본: 둘 다)
--modules <csv>     design-system,auth-http,data-fetching,lint (기본: 전부)
--dry-run           파일을 쓰지 않고 계획만 출력
-y, --yes           질문 없이 진행
```

## 충돌 처리

이미 존재하는 파일(`AGENTS.md` 등)은 덮어쓰지 않는다. `.harness/incoming/` 아래
같은 경로에 두고 diff 명령을 안내한다. 재실행 시 동일 내용이면 건너뛴다(멱등).

모든 생성 파일은 `.harness/manifest.json` 에 sha256과 함께 기록된다.
(v0.2의 `update` 명령이 이 해시로 로컬 수정 여부를 구분해 3-way 병합할 예정)

## Storybook은 왜 미리 설치하지 않나

UI 작업이 없는 저장소에 Playwright 바이너리까지 끌고 들어오고, `.storybook/main.ts` 는
프레임워크마다 달라 손으로 쓴 템플릿이 빠르게 낡는다. 대신 `/ds-init` 워크플로가
필요해진 시점에 공식 CLI로 설치하고, a11y 위반을 검증 실패(`a11y.test = 'error'`)로
등록한다. 자세한 근거는 `DECISIONS.md`.

## 개발

```bash
npm run check   # typecheck → build → test
npm run dev -- <대상경로> --yes --dry-run
```

- `templates/` 아래가 대상 프로젝트로 복사되는 산출물, 나머지는 CLI 자체 코드
- 남은 작업: `TODO.md` / 설계 근거: `DECISIONS.md`
