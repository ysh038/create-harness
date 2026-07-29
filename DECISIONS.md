# create-harness 설계 결정 기록

> 이 파일은 **create-harness CLI 자체의** 결정 기록이다. 대상 프로젝트로 복사되지 않는다.
> (대상 프로젝트용 결정 기록 템플릿은 `templates/core/docs/decisions.md`에 따로 있다.)

각 항목은 "무엇을"이 아니라 **"왜"**를 남긴다. 결론만 적으면 몇 주 뒤에 같은 논쟁을 반복하게 된다.

---

## 1. 품질 레벨 시스템(quick / standard / enterprise)을 도입하지 않는다

hrd-aimon-fe의 `project.config.json` + `project-levels/` 구조는 SI 환경에서 급한 안건과
장기 안건의 검증 강도를 다르게 가져가기 위한 **그 회사 고유의 장치**다.
범용 하네스에 넣으면 모든 사용자가 3단계 분류부터 배워야 한다.

대신 `.harness/config.json`의 평평한 `checks` 배열(순서 보장)로 검증 강도를 조절한다.
체크를 늘리고 줄이는 것이 곧 강도 조절이므로 레벨이라는 간접 계층이 필요 없다.

## 2. Storybook을 스캐폴딩 시점에 설치하지 않는다

- 이 CLI는 기존 프로젝트에 얹는 add-on이라 UI 작업이 없는 저장소도 대상이 된다.
  Storybook + addon-vitest는 Playwright 브라우저 바이너리까지 딸려 들어온다.
- `.storybook/main.ts`는 프레임워크·빌더에 따라 내용이 달라져 손으로 쓴 템플릿이 빠르게 낡는다.
  공식 CLI(`npx storybook@latest init`)가 프로젝트를 보고 생성하게 맡기는 편이 안전하다.

그래서 규칙(30-design-system.mdc)과 가벼운 강제 장치(stylelint·토큰 스켈레톤)만 즉시 생성하고,
Storybook 설치는 `/ds-init` 워크플로가 온디맨드로 수행한다.

## 3. AGENTS.md를 정본으로 두고 CLAUDE.md는 임포트 한 줄로 만든다

도구별 문서를 각각 손으로 관리하면 반드시 어긋난다. [AGENTS.md 표준](https://agents.md/)이
30개 이상 도구의 공통 진입점이 되었고, Cursor는 `AGENTS.md`와 `.cursor/rules`를 함께 읽으며,
Claude Code는 `CLAUDE.md` 첫 줄의 `@AGENTS.md` 임포트로 같은 바이트를 읽는다.

- `AGENTS.md`: 항상 로드되므로 짧게 (개요·명령어·검증 게이트·금지 사항)
- `.cursor/rules/*.mdc`: 상세 규칙을 `globs`로 조건부 로드
- Claude에는 globs 개념이 없으므로 상세 규칙은 스킬 안에서 참조

## 4. stylelint 토큰 강제는 색상부터 단계적으로 켠다

`stylelint-declaration-strict-value`로 모든 카테고리(색·간격·타이포)를 한 번에 error 처리하면,
토큰이 불완전한 상태에서 에이전트가 **존재하지 않는 토큰 이름을 발명**한다.
hex 원시값보다 나쁜 결과다. v0.1은 색상만 error로 켜고 간격·타이포는 주석으로 남긴다.
토큰 집합이 채워진 뒤 프로젝트가 스스로 켠다.

## 5. FSD(Feature-Sliced Design)를 전면 도입하지 않는다

6계층(app/pages/widgets/features/entities/shared) 전면 도입은 대부분의 프로젝트에 과하다.
대신 FSD와 Bulletproof React가 공통으로 권하는 실효 원칙만 흡수한다:

- 기능 응집 (기능 폴더 단위로 코드가 모인다)
- 단방향 의존 (상위 레이어만 하위를 import)
- 공개 API 경계 (`index.ts`만 통해 import — 문서가 아니라 `no-restricted-paths` 린트로 강제)

## 6. 하네스 내부 기록과 생성 산출물의 경계

`TODO.md`·`DECISIONS.md`(루트 대문자)는 이 CLI를 만드는 기록이고,
대상 프로젝트용 산출물은 전부 `templates/` 아래(소문자 `docs/` 경로)에 있다.

새어나감 방지 4중 장치:

1. 렌더러의 소스 루트는 `templates/`로 하드코딩 — 루트 파일이 복사될 경로가 없다
2. 이름 분리 — 루트 대문자 vs `templates/core/docs/` 소문자
3. `package.json` `files: ["dist", "templates"]` 화이트리스트 — tarball에서 자동 제외
4. `npm pack --dry-run` 결과에 `TODO.md`·`DECISIONS.md`가 있으면 실패하는 vitest 테스트

## 7. 생성 파일은 호스트 프로젝트의 도구에 안 걸리게 만든다 (E2E에서 배움)

hrd-aimon-fe 사본에 실제 적용해 보니, 생성 파일이 **대상 프로젝트 자신의 eslint·tsc에
걸리는** 문제가 세 갈래로 나왔다. 모두 "생성물은 호스트 도구의 수집 범위를 침범하지
않아야 한다"는 하나의 원칙으로 정리된다.

- **충돌 파일은 `.incoming` 접미사**: `.harness/incoming/foo.ts` 는 호스트의
  타입 인식 린트(parserOptions.project)에서 "tsconfig 밖 파일" 파싱 에러를 낸다.
  `foo.ts.incoming` 으로 저장하면 어떤 도구도 집어들지 않는다.
- **게이트 스크립트(.mjs)는 파일 단위 eslint-disable**: 브라우저 전용 eslint 설정이
  `process`·`console` 을 no-undef로 잡는다. Node 인프라 스크립트임을 헤더로 명시.
- **스토리 템플릿은 `_story-template.tsx`**: `_template.stories.tsx` 로 두면 Storybook
  테스트 러너의 `*.stories.*` glob이 참고용 템플릿을 실제 실행하려다 깨진다.
  파일명에서 `.stories.` 를 빼는 것이 유일하게 안전하다.
- Storybook 설치 산출물(`.storybook/`, `vitest.shims.d.ts`, 예제 `src/stories/`)의
  린트 정합은 `/ds-init` 워크플로의 명시적 단계로 편입했다.

## 8. 모듈 기본값의 판단 기준은 "취향"이 아니라 "설치 직후 검증 통과"다

모듈 4종(design-system·auth-http·data-fetching·lint)을 전부 기본 ON으로 두면,
axios 없는 프로젝트에 `axiosInstance.ts` 가 들어가 **첫 typecheck가 즉시 깨진다.**
하네스의 첫인상이 "검증 실패"인 것은 도구의 존재 이유와 정면으로 충돌한다.

그래서 `suggest.ts` 의 추천 기준을 단 하나로 고정했다 — *생성 직후 그대로
컴파일·통과하는가.* 이 기준은 검증 가능하고 취향 논쟁이 없다.

- `auth-http`: axios + react-router + Vite (참조 구현이 `import.meta.env.VITE_*` 를 쓴다)
- `data-fetching`: TanStack Query + Zustand + axios
- `design-system`: Tailwind·CSS-in-JS 면 OFF — stylelint 색상 강제가 유틸리티 클래스나
  TS 안의 값에 **닿지 못한다.** 통과는 하지만 아무것도 강제하지 못하는 규칙은 해롭다
  (지켜지고 있다는 착각을 준다).
- `lint`: flat config 없으면 OFF — 규칙 조각을 spread할 대상이 없다.

비추천을 **숨기지는 않는다.** 대화형에서는 `(비권장)` + 근거를 달아 목록에 그대로 두고,
`--yes` 경로에서는 제외된 모듈과 이유를 반드시 출력한다. `--modules` 를 명시하면
추천 로직을 완전히 우회한다 — "지금은 없지만 이 규약을 도입하겠다"는 선택을 막을 이유가 없다.

## 9. 모듈을 빼면 그 모듈을 전제하는 규칙도 뺀다

Tailwind 프로젝트에서 `design-system` 모듈이 빠져도 `30-design-system` 규칙은 코어라
항상 생성됐다. 그 규칙은 존재하지 않는 `src/design-system/tokens.css` 를 가리킨다.
에이전트에게 없는 파일을 참조하라고 시키는 셈이고, 그러면 파일을 **지어낸다.**

그래서 규칙 정본에 모듈 의존성을 선언하고(`RULE_MODULE_REQUIREMENT`), 워크플로도
`/ds-init`·`/ds-add` 는 디자인시스템 모듈에 묶었다. `AGENTS.md` 처럼 여러 절이 한
파일에 있는 경우를 위해 렌더러에 `{{#if FLAG}}` 블록을 추가했다.

대안이었던 "규칙을 토큰 강제 / 컴포넌트 선행으로 쪼개기"와 "Tailwind 전용 변형 두기"는
채택하지 않았다. 전자는 규칙 파일 수를 늘려 로드 비용만 키우고, 후자는 규칙 정본이
둘로 갈라져 유지비가 배로 든다(Tailwind v3의 `tailwind.config.js` 와 v4의 `@theme` 가
또 달라 실질 변형은 셋이 된다).

**대신 하네스의 입장을 명시한다** — 디자인시스템 모듈은 켜는 것을 권장하고, Tailwind는
권장하지 않는다. UI 드리프트를 결정적으로 막는 수단이 토큰 + stylelint 하나뿐인데
Tailwind는 그 수단을 무력화한다. 모듈 없이 진행하면 CLI가 이 근거를 출력한다.

## 10. 브라운필드 stylelint는 전부 warning이 아니라 파일 단위 유예다

hrd-aimon-fe에 얹었을 때 색상 원시값 637건이 한 번에 막혔다. 이 상태로는 사용자가
게이트를 꺼버리고, 그러면 하네스 전체가 무의미해진다.

처음엔 `severity: 'warning'` 을 전역으로 켜는 방안을 생각했다. 실제로 넣어 보니
기존 코드는 통과하지만 **새로 쓰는 CSS의 위반도 함께 warning이 됐다** — 드리프트를
막겠다는 목적 자체가 사라진다.

그래서 설치 시점에 원시값을 쓰던 파일 목록을 `.harness/stylelint-baseline.json` 에
기록하고 `overrides` 로 그 파일들만 warning으로 낮춘다. 새 파일은 error 그대로다.
검증: 기존 84개 파일 → 640 warnings / exit 0, 새 파일 하나 추가 → 3 errors / exit 2.

목록은 줄어들기만 하는 부채 목록이라 진행 상황이 눈에 보인다. 비면 `overrides` 를
지우면 끝이다.

부수적으로 발견한 것 — `stylelint-declaration-strict-value` 는 `ignoreFunctions` 가
기본 true라 `#hex` 는 잡아도 **`rgb()`·`hsl()` 은 통과시킨다.** 규칙 문서가 약속한 것과
실제 강제가 달랐다. 색상 속성에 한해 `declaration-property-value-disallowed-list` 로
따로 막았다 (background-image 그라디언트의 var() 조합은 그대로 허용된다).

## 11. eslint ignores는 안내가 아니라 패치한다

`.harness/**` 를 호스트 eslint ignores에 넣는 일을 매번 사람이 손으로 했다. 안내문은
읽히지 않고, 안 넣으면 게이트의 첫 lint 체크가 하네스 자기 파일 때문에 깨진다.

사용자 파일을 고치는 일이라 보수적으로 간다 — `export default [`,
`export default tseslint.config(`, `export default defineConfig([` 세 형태만 인식하고,
이미 있으면 아무것도 하지 않으며(멱등), 알아보지 못하면 파일을 건드리지 않고 조각만
출력한다. 무엇을 넣었는지는 항상 stdout에 찍어 git diff로 확인할 수 있게 한다.
