# create-harness

> 기존 프로젝트에 AI 코딩 에이전트 하네스를 한 명령으로 얹는다.

`create-harness`는 앱을 새로 만드는 스캐폴더가 아니라, **이미 있는 프로젝트**에
AI 에이전트(Cursor, Claude Code)가 일관된 결과물을 내도록 하는 하네스를 설치하는 CLI다.

> npm의 `create-harness` 이름은 무관한 다른 패키지가 선점하고 있어, 배포명은
> `create-harness-cli`다. 저장소·CLI 브랜드명은 그대로 `create-harness`를 쓴다.

```bash
npx create-harness-cli            # 현재 디렉터리에
npx create-harness-cli ./my-app --yes --dry-run   # 계획만 확인
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
- 워크플로 7종 — `/spec`(명세) → `/impl`(테스트 우선 구현) → `/verify` → `/ship`,
  UI 작업은 `/ds-init`(Storybook 온디맨드 설치)·`/ds-add`(페이지 전 Atomic 계층 선행)·
  `/ux-review`(테스트로 못 옮기는 시각적 품질 리뷰 — AC 강제를 우회하는 별도 트랙)
- 린트 강제 — 명명 규칙(`I` 접두 등)·공개 API 경계·Atomic 계층 역방향 import·
  색상 원시값 차단(stylelint)을 error 처리

## 옵션

```
npx create-harness-cli [대상 디렉터리] [옵션]

--preset <name>     프리셋 (v0.1: react-fe)
--agents <csv>      cursor,claude (기본: 둘 다)
--modules <csv>     design-system,auth-http,data-fetching,lint (기본: 감지 결과에 따름)
--ponytail          서드파티 ponytail 규칙(YAGNI 사다리) 연동 (기본: 끔)
--dry-run           파일을 쓰지 않고 계획만 출력
-y, --yes           질문 없이 진행
```

## 모듈 기본값은 감지 결과가 정한다

코어(규칙·워크플로·게이트·docs)는 항상 설치되지만, **코드를 생성하는 모듈**은
대상 프로젝트에서 그대로 컴파일·통과하는 것만 기본 선택됩니다.
기준은 하나입니다 — 설치 직후 검증이 깨지지 않는가.

| 모듈 | 기본 선택 조건 | 빠지는 경우 |
|---|---|---|
| `design-system` | CSS / CSS Modules | Tailwind, CSS-in-JS (stylelint가 값에 닿지 못함) |
| `auth-http` | axios + react-router + Vite | fetch만 쓰거나 Next.js/CRA |
| `data-fetching` | TanStack Query + Zustand + axios | SWR·Redux 등 다른 조합 |
| `lint` | ESLint flat config + TypeScript | 구형 `.eslintrc`, JS 전용 |

빠진 모듈은 이유와 함께 출력되고, `--modules` 로 명시하면 강제로 포함됩니다.
대화형 실행에서는 비권장 모듈도 `(비권장)` 표시와 근거를 달고 목록에 나오므로 직접 켤 수 있습니다.

모듈을 빼면 **그 모듈을 전제하는 규칙·워크플로도 함께 빠집니다.** 예를 들어
`design-system` 없이 설치하면 `30-design-system` 규칙, `/ds-init`·`/ds-add`·`/ux-review`
워크플로, `AGENTS.md` 의 해당 항목이 모두 생성되지 않습니다. 존재하지 않는 파일을
가리키는 규칙은 에이전트를 헷갈리게 할 뿐입니다.

## 디자인시스템에 대한 입장

`design-system` 모듈은 웬만하면 켜는 것을 권장합니다. AI 에이전트가 화면마다 다른
색·간격을 쓰는 UI 드리프트를 막는 **결정적**(deterministic) 수단이 토큰 + stylelint
하나뿐이기 때문입니다. 규칙 문서는 확률적으로만 지켜집니다.

### UI는 Atomic 계층으로 쌓는다

에이전트에게 "로그인 페이지 만들어줘"라고 하면 페이지 파일 하나에 마크업과 스타일을
전부 쏟아붓습니다. 다음 화면에서도 같은 일이 반복되고, 버튼이 화면 수만큼 생깁니다.

그래서 `/ds-add` 는 **화면 분해를 먼저 강제합니다** — atom → molecule → organism 순으로
컴포넌트와 스토리를 만들고, 페이지는 마지막에 훅 호출 + 조립만 남깁니다.

```
src/design-system/atoms/       도메인 모름. 토큰만 (Button, Input, Badge)
src/design-system/molecules/   atom 2~3개 조합 (FormField, SearchBar)
src/design-system/organisms/   의미 있는 UI 블록 (범용)
src/components/{Domain}/       도메인 타입을 받는 organism
src/components/layouts/        template — 슬롯 레이아웃
라우트 파일                     page — 조립만
```

경계는 두 개뿐입니다. **도메인 타입이 들어오면 `design-system/` 을 떠난다**,
**데이터를 가져오면 컴포넌트가 아니라 page/hook이다.** 이 규칙은 문서로만 두면
지켜지지 않으므로 `lint` 모듈의 ESLint 조각이 계층 역방향 import를 error로 끊습니다
(atom → molecule, molecule → organism, design-system → queries/stores).

### 토큰은 primitive → semantic 2계층

`tokens.css`는 색상 램프(`--primitive-*`)와 그 위의 역할별 별칭(`--color-*`) 2계층이다.
컴포넌트는 semantic 토큰만 쓰고, 브랜드를 바꿀 땐 primitive 램프만 교체한다 —
`-hover`·`-pressed`·`-subtle` 같은 상태 별칭이 자동으로 새 브랜드를 따라간다.
구조는 [KRDS](https://github.com/KRDS-uiux/krds-uiux)(대한민국 디지털정부 디자인시스템)의
토큰 계층을 참고했다 — 코드를 그대로 쓰지 않고 계층·상태 세트 패턴만 이식했다.
그림자·트랜지션 토큰과 언제 쓰는지 기준도 함께 있다 — 근거는 `DECISIONS.md` #15.

같은 이유로 이 하네스는 **Tailwind 를 권장하지 않습니다.** 값이 클래스 문자열 안에
있어 stylelint 가 닿지 못하고, 임의값(`bg-[#3b82f6]`)을 막으려면 별도의 ESLint 규칙
체계를 따로 유지해야 합니다. 새 프로젝트라면 CSS Modules + `tokens.css` 를 권장합니다.

### 기존 프로젝트의 stylelint 유예

이미 색상 원시값을 쓰는 CSS가 있는 프로젝트에 토큰 강제를 error로 얹으면 첫 커밋부터
수백 건이 막혀 결국 게이트를 꺼버리게 됩니다. 그래서 설치 시점에 원시값을 쓰던 파일만
`.harness/stylelint-baseline.json` 에 올려 **그 파일들만 warning** 으로 낮춥니다.
새로 만드는 CSS는 그대로 error입니다. 정리할 때마다 목록에서 경로를 지우고, 비면
`stylelint.config.js` 의 `overrides` 를 삭제하면 됩니다.

## eslint ignores 자동 패치

`.harness/` 안의 게이트 스크립트는 Node 인프라 코드라 호스트의 브라우저용 lint 설정에
걸립니다. 그래서 설치 시 대상의 flat config(`eslint.config.*`)에 아래를 끼워 넣습니다.

```js
// create-harness: 하네스 생성 파일은 호스트 lint 대상이 아니다
{ ignores: ['.harness/**'] },
```

`export default [`, `export default tseslint.config(`, `export default defineConfig([`
형태를 인식하며, 이미 적용돼 있으면 아무것도 하지 않습니다(멱등). 알아보지 못하는
형태면 파일을 건드리지 않고 붙여넣을 조각만 출력합니다.

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

## ponytail 연동 (`--ponytail`)

[ponytail](https://github.com/DietrichGebert/ponytail)은 이 하네스와 무관한 서드파티
규칙으로, "YAGNI 사다리"를 강제해 에이전트가 과설계하지 않고 최소 구현을 하도록 만든다.
`--ponytail`(또는 대화형 확인)을 켜면:

- **Cursor**: 최신 GitHub 릴리스 태그에서 `.cursor/rules/ponytail.mdc` 를 실행 시점에
  받아와 자동 설치한다. `templates/` 에 벤더링하지 않는다 — 릴리스 태그가 아니라
  `main` 브랜치를 그대로 받으면 재실행마다 결과가 달라져 이 CLI의 멱등성 원칙과
  어긋나고, 손으로 복사해 두면 ponytail 쪽 업데이트를 우리가 계속 따라가야 한다.
  네트워크·API 실패 시에는 파일을 건너뛰고 수동 설치 안내로 폴백한다(스캐폴딩 전체를
  막지 않는다).
- **Claude Code**: `/plugin` 설치는 살아있는 세션 안에서만 실행되는 명령이라 이 CLI가
  대신 실행할 수 없다. 대신 두 줄짜리 설치 명령을 "다음 단계" 맨 위에 출력한다.

## 개발

```bash
npm run check   # typecheck → build → test
npm run dev -- <대상경로> --yes --dry-run
```

- `templates/` 아래가 대상 프로젝트로 복사되는 산출물, 나머지는 CLI 자체 코드
- 남은 작업: `TODO.md` / 설계 근거: `DECISIONS.md`
