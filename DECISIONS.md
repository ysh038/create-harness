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

## 11. ponytail은 벤더링하지 않고 실행 시점에 릴리스 태그에서 받는다

[ponytail](https://github.com/DietrichGebert/ponytail)(YAGNI 사다리를 강제하는 서드파티
규칙)을 `--ponytail`로 연동하기로 하면서, "손으로 복사해 둔 산출물은 원본이 바뀌면
낡는다"는 2번 결정(Storybook)과 같은 문제를 다시 만났다. 다만 원인은 다르다 — Storybook은
*프로젝트 조합마다 정답이 달라지는 산출물*이 문제였고, ponytail은 *우리가 저작하지 않은
콘텐츠를 계속 동기화해야 하는* 문제다.

그래서 `templates/`에 넣지 않고, 스캐폴딩 시점에 GitHub Releases API로 최신 릴리스
태그를 찾은 뒤 그 태그에서 `.cursor/rules/ponytail.mdc` 원문을 받아온다(`src/ponytail.ts`).
`main` 브랜치를 그대로 받는 방안은 버리고 태그에 고정했다 — `main`을 받으면 같은 옵션으로
재실행해도 매번 다른 내용이 나와, 파일 재실행 시 동일 내용이면 건너뛰는 멱등성 전제와
충돌한다(2번 결정 참고). 네트워크·API 실패는 조용히 흡수하고 수동 설치 안내로
폴백한다 — 서드파티 저장소 상태가 이 CLI의 스캐폴딩 성공 여부를 좌우해서는 안 된다.

Claude Code는 `/plugin marketplace add` · `/plugin install`이 살아있는 세션 안에서만
동작하는 명령이라 한 번 실행되고 끝나는 이 CLI가 대신 실행할 방법이 없다. 파일을
자동 설치해줄 수 있는 Cursor와 달리, Claude Code는 두 줄짜리 명령을 "다음 단계"
맨 앞에 출력하는 것이 구조적 상한선이다.

## 12. eslint ignores는 안내가 아니라 패치한다

`.harness/**` 를 호스트 eslint ignores에 넣는 일을 매번 사람이 손으로 했다. 안내문은
읽히지 않고, 안 넣으면 게이트의 첫 lint 체크가 하네스 자기 파일 때문에 깨진다.

사용자 파일을 고치는 일이라 보수적으로 간다 — `export default [`,
`export default tseslint.config(`, `export default defineConfig([` 세 형태만 인식하고,
이미 있으면 아무것도 하지 않으며(멱등), 알아보지 못하면 파일을 건드리지 않고 조각만
출력한다. 무엇을 넣었는지는 항상 stdout에 찍어 git diff로 확인할 수 있게 한다.

## 13. npm 배포명은 `create-harness-cli`, 브랜드명은 `create-harness` 유지

npm 배포를 준비하며 `npm view create-harness`로 확인해보니 이름이 이미 선점돼 있었다 —
`uiharness`(philcockfield/uiharness, 1년 이상 전 배포)라는 완전히 무관한 프로젝트다.
`package.json`의 `name`이 여전히 `create-harness`인 상태로 README의 `npx create-harness`를
그대로 뒀다면, 그 명령은 이 프로젝트가 아니라 그 무관한 패키지를 실행했을 것이다.

저장소명·CLI 브랜드(`p.intro('create-harness')`, 도움말 문구, 각 md 문서 제목)는
`create-harness`를 유지하고, npm에 실제로 등록되는 `package.json`의 `name`과
`bin` 키만 `create-harness-cli`로 바꿨다. 저장소 이름까지 바꾸는 것은 더 큰 파급(README
링크·git remote·기존 clone)이 있어 배제했다 — npm 패키지명과 GitHub 저장소명은
독립적이라 이걸로 충분하다.

후보로 `create-ai-harness`·`create-agent-harness`·`harness-init`도 검토했으나 이미
사용 중이었다(`npm view <name>`으로 확인). `create-harness-cli`가 원래 이름에 가장
가깝고 비어 있어 채택했다.

## 14. UI 규칙을 "레이아웃 전 컴포넌트"에서 Atomic 계층으로 바꾼다

기존 30-design-system은 `src/design-system/components/` 라는 평면 폴더에 "레이아웃보다
컴포넌트를 먼저 만들라"는 **순서**만 규정했다. 실제로 에이전트에게 화면을 시키면 이
규칙은 절반만 지켜진다 — 컴포넌트를 하나 만들고 나머지는 페이지 파일에 그대로 쏟는다.
"컴포넌트"의 크기가 정의되지 않으면 페이지 전체를 컴포넌트 하나라고 불러도 규칙 위반이
아니기 때문이다.

Atomic 계층은 그 크기에 **이름과 폴더**를 준다. atom → molecule → organism 순으로
쌓게 하면 "어디까지 쪼갤 것인가"가 판단이 아니라 위치 문제가 되고, 판단이 위치가 되는
순간 린트로 검사할 수 있다.

계층 배치는 교과서의 5계층을 그대로 쓰지 않았다:

- `design-system/{atoms,molecules,organisms}` 는 **도메인 비의존**만 담는다. 도메인 타입을
  props로 받는 순간 기존 10-architecture의 `src/components/{Domain}/` 으로 간다.
  두 규칙이 같은 자리를 두고 다투지 않게 하려면 경계가 "계층"이 아니라 "도메인 결합"이어야 한다.
- `templates` 는 `src/components/layouts/`, `pages` 는 라우트 파일에 매핑한다.
  design-system 안에 pages 폴더를 두면 라우트와 이중화된다.

강제는 ESLint `no-restricted-imports` 의 계층별 블록으로 건다 (atom → molecule/organism,
molecule → organism, design-system → components/queries/stores). 결정 2·4와 같은 이유다 —
문서로만 있는 규칙은 확률적으로만 지켜진다. 다만 이 조각은 `lint` 모듈에 들어 있어
`design-system` 만 켠 프로젝트에서는 문서 수준으로 남는다. 존재하지 않는 폴더를 가리키는
패턴은 무해하므로 두 모듈을 묶지는 않았다.

강제를 붙이며 배운 것 두 가지 (둘 다 처음엔 조용히 통과했다):

1. `no-restricted-imports` 는 **작성된 import 문자열**을 매칭한다. 해석된 경로가 아니다.
   `**/design-system/molecules/**` 로 썼더니 atom 내부의 `../../molecules/FormField` 가
   통과했다 — 계층 내부에서는 경로에 `design-system/` 세그먼트가 없다. 계층 폴더 이름만으로
   매칭한다(`**/molecules/**`).
2. flat config 는 같은 규칙을 **병합하지 않고 마지막 정의로 대체한다.** 계층 블록이
   `no-restricted-imports` 를 다시 쓰는 순간 base 블록의 공개 API 경계가 그 파일에서 사라졌다.
   공통 패턴을 `PUBLIC_API_PATTERN` 상수로 빼서 계층 블록마다 함께 넣는다.

두 결함 모두 "설정을 읽어보면 맞아 보이는" 형태였다. 위반 픽스처를 실제로 lint해서
error 3건이 나오는 것을 확인하고 나서야 드러났다.

**보충 — components/{Domain} 명명 혼동.** 실사용 중 `components/{Domain}`을 "organism 다음
Atomic 계층"으로 오해하는 일이 반복됐다. Atomic 계층은 `design-system/` 안에서 닫히고,
`components/{Domain}`은 기존 10-architecture의 도메인 폴더로서 *도메인 organism의 위치*다.
`10-architecture.md`·`30-design-system.md` 양쪽에 subsection을 추가해 명시했다
(hybrid 자체는 유지, 문서만 보강).

## 15. 디자인 토큰을 primitive → semantic 2계층으로 재구성한다

v0.1의 `tokens.css`는 색상마다 hex 하나씩만 있는 평평한 목록이었다(`--color-primary`,
`--color-primary-hover` 정도). 이 상태로 컴포넌트를 만들면 hover는 있어도
pressed·subtle·disabled 배경 같은 상태를 표현할 토큰이 없어, 결국 아무 hex나 새로
지어내거나(토큰 발명 금지 규칙과 충돌) 상태를 생략하게 된다. "그냥 HTML에 색만
입힌 것 같다"는 사용자 피드백의 근본 원인이 여기 있었다 — 토큰 자체가 인터랙션
요소를 만들기엔 얕았다.

[KRDS(대한민국 디지털정부 디자인시스템) HTML Component Kit](https://github.com/KRDS-uiux/krds-uiux)를
참고해 구조를 정했다. KRDS의 토큰(`tokens/transformed_tokens.json`)은
`primitive`(색상 11단계 램프·숫자·타이포)를 `semantic`(간격·radius·높이)이 참조하는
2계층이고, 라이트/고대비 모드와 PC/모바일 반응형 스케일까지 있다 — 코드 라이선스는
`package.json`의 `ISC`(permissive)를 확인했다. 다만 KRDS는 raw HTML + 전역 CSS
클래스(`krds-btn`) 기반이라 이 하네스의 React + CSS Modules 구조에 그대로 얹을 수
없고, 그대로 얹으면 모든 프로젝트가 정부 브랜드 파란색 하나로 통일돼버려 "톤은
가져오되 프로젝트마다 다르게 나와야 한다"는 요구와도 맞지 않는다. 그래서 **KRDS의
코드가 아니라 계층 구조(primitive→semantic)와 상태 세트(subtle/base/strong,
hover/pressed) 패턴만** 새로 작성해 이식했다.

- `--primitive-*`: 브랜드 램프(primary 10단계)·중립 램프(gray 11단계)·상태 램프
  (success/warning/danger/info, subtle/base/strong 3단만 — 배지·알림이 주 용도라
  풀 램프가 필요 없다). 컴포넌트 CSS에서 직접 참조하지 않는다.
- `--color-*` (semantic): `primitive-primary-600` 같은 특정 단계를 가리키는 역할
  이름. 브랜드를 바꿀 땐 `primitive-primary-*` 10단계만 교체하면 `-hover`·`-pressed`·
  `-subtle`을 쓰는 모든 컴포넌트가 자동으로 새 브랜드를 따라간다 — semantic 이름은
  안 바뀐다.
- `--focus-ring-*`: 별도 토큰으로 뗐다. 공공 디자인시스템은 키보드 포커스 표시를
  선택이 아니라 필수로 다루는데, v0.1엔 이 개념 자체가 없었다.

간격·radius·타이포는 이번엔 계층화하지 않았다 — 색상과 달리 "브랜드 스왑"이 필요한
축이 아니라 단일 스케일을 그대로 참조해도 되고, 괜히 계층을 얹으면 간접
참조만 늘어난다(ponytail 논의에서 다룬 것과 같은 과설계 함정). primitive/semantic
분리는 **색상에서만** 값어치가 있다.

라이트/고대비 모드, PC/모바일 반응형 스케일은 KRDS에 있지만 이번 범위에는 넣지 않았다
— 접근성 모드·반응형 토큰까지 한 번에 얹으면 검토할 표면이 너무 커진다. 필요해지면
별도 결정으로 다룬다.

## 16. `/ux-review` — AC 강제를 우회하는 별도 트랙을 만든다

실사용 프로젝트(하네스 적용 vs 미적용 대조군)에서 사용자가 직접 확인한 결과: 하네스를
적용한 쪽은 90여 개 커밋 동안 `tokens.css`의 브랜드 플레이스홀더가 한 번도 안 바뀌었고,
gradient·box-shadow·transition·`@keyframes` 사용이 전부 0이었다(대조군은 있었다).
원인을 셋으로 추렸다:

1. 토큰 추가에 마찰비용이 있다 (즉석 hex 대신 `tokens.css`·`tokens.ts` 두 파일을 먼저 고쳐야 함)
2. **`/spec`→`/impl`이 테스트로 번역 가능한 수용 기준만 허용한다.** "이게 더 우아하다"는
   AC로 못 쓰고, 명세에 없으면 스케줄되지 않는다 — 셋 중 임팩트가 제일 크다고 판단했다
3. `30-design-system` 규칙 자체가 "일관성"(드리프트 방지)만 다루고 "미감"을 다루지 않았다

①은 15번 결정(hover/pressed/subtle 토큰 선반영)으로 이미 부분적으로 손댔다. 이번엔
②·③을 겨냥한다.

**②에 대한 해법 — `/ux-review` 신설.** `/impl`의 AC 강제를 없애는 대신, AC로 못 옮기는
항목(인터랙션 상태·트랜지션·그림자·토큰 준수)을 다루는 **별도 워크플로**를 만들고,
거기서 찾은 항목 중 "직접 고쳐도 되는 범위"(이미 있는 규칙을 지키게 맞추는 것)는
`/spec` 없이 바로 고치도록 명시했다. 범위를 딱 잘라 정한 이유는 이게 "취향을 마음대로
추가해도 된다"는 구멍이 되면 안 되기 때문이다 — 새 토큰·계층 재배치·브랜드 색상
결정처럼 판단이 필요한 건 여전히 `/spec`으로 돌려보낸다.

`ux-review`는 `design-system` 모듈에 묶었다(`registry.ts`의
`DESIGN_SYSTEM_REVIEW_WORKFLOWS`) — 토큰·Atomic 계층 판단 기준이 전제라서 모듈
없이는 체크리스트 절반이 참조할 게 없다. Claude에서는 `ds-init`·`ds-add`와 합치지
않고 독립 스킬로 뒀다 — 목적이 다르다(설치/추가 vs 진행 중인 리뷰), 합치면 "언제
이 스킬을 부르나"의 트리거 조건이 두 개로 갈라져 설명이 꼬인다.

이것도 결국 ESLint 계층 강제(14번 결정) 같은 결정적 수단이 아니라 prose다 — 다만
지금 가진 도구(정적 분석)로는 "그림자가 있어야 할 자리에 있는가"를 애초에 검증할
수 없어서, 결정적 수단이 없는 영역엔 리뷰 워크플로가 현재로선 최선이다. `/ship`에도
UI 변경 시 `/ux-review`를 거쳤는지 확인하는 절을 추가해 최소한 커밋 직전에 한 번은
상기시킨다.

**③에 대한 해법 — 장식·모션 토큰 + 사용 기준.** `--duration-*`·`--easing-*`를
추가하고, 기존에 있었지만 안 쓰이던 `--shadow-sm/md/lg`에 "언제 쓰는지"(문서 위에
뜬 정도)를 표로 명시했다. 간격·radius처럼 계층화하지 않고 플랫하게 뒀다 — 15번
결정과 같은 이유(브랜드 스왑이 필요한 축이 아님). `prefers-reduced-motion` 대응도
같이 넣었다 — 모션을 다루면서 접근성 예외를 안 다루면 반쪽짜리다.

**부수적으로 — 브랜드 토큰 미교체 문제.** CLI가 스캐폴딩 직후 "다음 단계"로 이미
"AGENTS.md TODO를 채우세요"를 출력하고 있었는데도 실측 결과 90개 커밋 동안 안
지켜졌다 — day-1 출력문은 안 읽힌다는 게 증명된 셈이다. 그래서 실제로 UI 작업이
시작되는 시점인 `/ds-init` 절차 맨 앞에 브랜드 토큰 확인을 못박고, `/ux-review`
체크리스트에도 상기 항목으로 넣어 이중 안전망을 뒀다. 매 `/ship`마다 확인하는
안은 채택하지 않았다 — 브랜드가 이미 정해진 뒤엔 매번 물어보는 게 소음이 된다.

## 17. 실사용에서 발견한 lint 버그 2건 수정

`design-system`+`lint` 모듈을 켜서 실제로 계산기 화면 하나를 만들어보는 실사용
검증(최신 `npm create vite` react-ts 템플릿 — ESLint 대신 oxlint가 기본이라 flat
config가 아예 없는 프로젝트) 중 발견했다. 둘 다 지금까지 테스트가 없어서 안
잡혔다.

1. **`requiredDevDeps()`에 `eslint`·`typescript-eslint` 누락.**
   `eslint.harness.config.js`가 `import tseslint from 'typescript-eslint'`를 직접
   쓰는데도 lint 모듈의 필요 의존성 안내 목록엔 `eslint-plugin-import`·commitlint·
   prettier만 있었다. `lint` 모듈의 추천 조건(`suggestLint`)이 "기존 flat config
   존재"를 전제해서 보통은 `eslint`가 이미 있었을 뿐이지, `--modules`로 강제
   포함하면(9번 결정이 허용하는 경로) 실제로 없는 상황이 나온다 — 이번처럼.
   `eslint`·`typescript-eslint` 둘 다 목록에 추가했다.

2. **`naming-convention`이 화살표 함수 컴포넌트를 오탐.** `const Button = () =>
   ...` 같은, React에서 가장 흔한 컴포넌트 선언 형태가 PascalCase 변수인데,
   `variable` 셀렉터의 일반 규칙(`format: ['camelCase']`)에 그대로 걸려 표준
   패턴 자체가 위반으로 잡혔다. `types: ['function']` 셀렉터를 boolean 예외
   바로 다음, 일반 camelCase 규칙보다 앞에 추가했다 — naming-convention은
   식별자마다 먼저 매치되는 셀렉터 하나만 적용하므로 순서가 중요하다.

두 버그 모두 `requiredDevDeps()`와 생성된 `eslint.harness.config.js` 내용을
직접 검증하는 테스트가 그동안 없었다는 공통점이 있다. 재발 방지로 두 항목 다
테스트를 추가했다 — `requiredDevDeps` describe 블록 신설, naming-convention
예외가 실제로 템플릿에 있는지 확인하는 케이스 추가.

## 18. Storybook은 설치 시 의향만 물어 config에 기록한다 (Option A)

Storybook을 CLI 설치 시 즉시 `npx storybook init`으로 설치하는 안(Option B)은 결정 #2에서
이미 배제했다 — UI 작업 없는 저장소도 대상이며, 공식 CLI가 프로젝트를 보고 생성하게
맡기는 편이 안전하다. 다만 `/ds-init` 온디맨드 설치를 전제로 하면 **의향 자체를 기록하지
않은** 탓에 heavy gates(story 필수, a11y error)를 언제 켜야 하는지 판단 기준이 없었다.

그래서 CLI 프롬프트에 "Storybook을 사용할 계획인가요?" 질문을 추가하고, 답을 `.harness/config.json`의
`storybook: "off" | "pending" | "ready"` 필드에 저장한다:

- `off` — 의향 없음, Storybook 관련 체크를 전부 끈다
- `pending` — 의향 있음, 아직 미설치 (기본값). `/ds-init` 성공 시 `ready`로 승격
- `ready` — 설치 완료, story 요구사항·a11y error·test-storybook checks 활성화

`--yes` 비대화형 경로에서는 `design-system` 모듈이 선택되면 `pending`, 없으면 `off`를
기본값으로 둔다.

## 19. Brownfield baseline을 Atomic 계층 강제에도 적용한다

결정 #10(stylelint 유예 목록)과 같은 원리를 Atomic 계층 강제에도 적용한다. 페이지/라우트
파일에서 `<button>`, `<input>` 같은 intrinsic elements를 직접 쓰는 것을 ESLint `no-restricted-syntax`로
error 처리하되, **기존 프로젝트가 이미 쓰고 있던 페이지 파일 목록**을 `.harness/atomic-baseline.json`에
기록해 그 파일들만 warning으로 낮춘다.

감지 대상 태그: `button`, `input`, `select`, `textarea`, `form`, `a`, `div`, `span`, `p`,
`h1~h6`, `ul`, `ol`, `li`, `table`, `tr`, `td`, `th`, `img`, `video`, `audio`, `canvas`, `svg`
(Atomic 계층으로 추상화해야 하는 대표적인 UI 요소들)

스캔 경로: `src/pages/`, `src/routes/`, `src/App.tsx`, `src/app/page.tsx` (react-router v6
및 Next.js App Router 관례 기준)

이 규칙은 `design-system` + `lint` 모듈이 둘 다 켜진 경우에만 강제된다 — ESLint 규칙이므로
lint 모듈이 전제이고, Atomic 계층 자체가 design-system 모듈의 구조다.

## 20. 페이지 raw JSX 금지는 "조기 게이트"로서 실효성이 크다

제품 목표 #2(Early ban on raw JSX in pages)가 요구한 것은 "Atomic 재작성을 늦게 하지 않게
막는 조기 게이트"다. story 필수나 역방향 import 금지보다 **먼저** 걸리는 규칙이어야 의미가 있다:

- story 필수는 Storybook `ready` 상태가 전제 → `/ds-init` 이후
- 역방향 import는 이미 계층이 나뉘어 있다는 전제 → 이미 Atomic 계층을 도입한 뒤
- **페이지 raw JSX 금지는 Atomic 계층 도입 전부터 걸린다** → 게이트가 없어도 되는 환경에서
  미리 습관을 만드는 셈이다

그래서 이 규칙은 `design-system` + `lint` 모듈만 켜지면 즉시 활성화되고, Storybook 상태와
무관하다. 기존 프로젝트의 페이지가 이미 intrinsic elements를 수십 개 쓰고 있어도 baseline으로
grandfather 처리하므로 첫 커밋이 막히지 않는다.

## 21. 버전 0.3.0 — Storybook 의향 기록 + 조기 Atomic 게이트

이번 릴리스는 다음을 포함한다:

- Storybook 상태 3단계(`off` / `pending` / `ready`)를 config에 저장
- 페이지 파일에서 raw intrinsic elements 사용 금지 ESLint 규칙
- `.harness/atomic-baseline.json` brownfield 유예 목록 (stylelint와 같은 방식)
- 감지 로직: 기존 페이지 파일 중 `<button>` 등을 이미 쓰고 있던 것 자동 스캔

새 기능이 사용자에게 명시적으로 노출되므로(프롬프트 추가, 새 규칙 에러) minor 버전 bump.

git 태그는 PR 병합 후 `v0.3.0`으로 생성 권장. npm publish는 maintainer가 병합 후 수동 실행:

```bash
git tag v0.3.0
git push origin v0.3.0
npm publish
```

## 22. CLI 프롬프트를 에이전트 채팅 경로에 미러링한다 (v0.3.3)

사용자가 에이전트에게 "하네스 설치해줘"라고 요청하면 에이전트는 `--yes` 로 CLI를 건너뛰고
싶은 유혹이 있지만, `--yes`의 기본값이 사용자 의도와 맞지 않을 수 있다 — 특히 Storybook
의향(`off` vs `pending`)과 모듈 선택(프로젝트마다 다름)은 추측으로 덮어쓸 수 없다.

그래서 **CLI의 4가지 질문을 에이전트 채팅 경로에서도 그대로 물어본다**:

1. 대상 에이전트 (Cursor and/or Claude Code)
2. 포함 모듈 (design-system, auth-http, data-fetching, lint)
3. Storybook 계획 (design-system 선택 시 — `pending` or `off`)
4. ponytail 설치 여부

답을 받으면 **명시적 플래그와 함께 `-y`로 CLI를 실행**한다:
- `--agents`, `--modules`, `--storybook` (design-system 선택 시), `--ponytail`, `-y`
- 명시적 플래그 + `-y` 는 "묻지 말고 이 값들을 사용하라"는 의미 (조용한 기본값이 아님)
- 값 없이 `-y`만 쓰는 것은 피해야 함 — 추론된 기본값이 의도와 다를 수 있다

CLI 플래그 추가:
- `--storybook <off|pending>` 플래그 추가 (`src/cli.ts`)
- `ready` 상태는 설치 시점에 불가 (이미 설치됨을 의미하므로)
- 명시적 `--storybook` 이 있으면 design-system 모듈 선택 여부에 따른 추론보다 우선

`.harness/config.json` 이 이미 존재하고 해당 필드가 채워져 있으면 재질문하지 않는다 —
이미 설치된 하네스를 다시 실행하는 경우는 설정 변경 등 명시적 의도가 있을 때뿐이다.

**Storybook `off` 처리**: `/ds-init` 워크플로가 Storybook 설치 전에 `.harness/config.json`의
`storybook` 필드를 먼저 확인하도록 절차를 수정했다. `off` 이면 사용자에게 지금 켤지 물어보고,
동의한 경우에만 설치를 계속한다. `pending` 이면 의향이 있다는 뜻이므로 바로 진행 가능
(간단히 확인 권장, 필수 아님). `ready` 면 이미 설치됨.

문서 변경:
- `templates/core/AGENTS.md`: "설치·설정 질문이 비어 있을 때" 절 추가, 명시적 플래그 + `-y` 사용 명시
- `templates/core/workflows/ds-init.md`: 절차 첫머리에 Storybook 의향 확인 단계 추가
- `templates/core/workflows/harness-setup.md`: 새 워크플로 생성 — 에이전트가 하네스 설치 시 실행
- `src/registry.ts`: `BASE_WORKFLOWS` 에 `harness-setup` 등록 (Cursor command + Claude skill)
- `src/cli.ts`: `--storybook` 플래그 추가, `--help` 업데이트, 명시적 값이 추론보다 우선하도록 수정

이번 변경은 **질문 미러링만** 다룬다. 프로젝트 모드(free/inspire/implement), Figma 디자인
참조 맵, 코딩 스타일 선호(function/arrow) 등의 설문 추가는 별도 범위다.

## 23. 버전 0.4.0 — 프로젝트 디자인 모드 + 에이전트 관리 디자인 참조 맵 + 코딩 스타일 설문

### 배경

실사용 프로젝트에서 발견한 세 가지 차이점:
1. **프로젝트마다 디자인 충실도 요구가 다르다** — 자유 구현(side project), 영감(오픈소스 재해석), 
   정확한 구현(회사 일, Figma 화면 맞추기)
2. **Figma 링크를 수동으로 복사하면 흩어진다** — 에이전트가 매번 물어보거나, 안 물어보고 
   재디자인하거나. 중앙 레지스트리가 없으면 "이 컴포넌트의 디자인은 어디 있나요?"에 답할 수 없다
3. **코딩 스타일 선호가 프로젝트마다 다르다** — `function Button()` vs `const Button = ()`, 
   `export default` vs `export { Button }`, CSS Modules vs Tailwind. 에이전트가 혼용하면 
   코드 리뷰에서 매번 통일 요청이 나온다

### 해결 방안

#### A. 프로젝트 디자인 모드 3단계

`.harness/config.json`에 `mode` 필드 추가:
- `free` — 디자인 참조 없이 자율 구현 (기본값)
- `inspire` — 디자인을 영감으로 활용, 재해석 허용
- `implement` — 제공된 디자인과 최대한 일치, 자유로운 재디자인 금지

`fidelity` 필드 (선택):
- `inspire` — 톤만 참고
- `match` — 최대한 일치 (implement 모드 기본값)
- `strict` — 픽셀 단위 일치 (미래 확장용, v0.4.0에서는 UI만)

모드에 따라 에이전트 행동이 달라진다:
- `free`: 디자인 참조 맵 비활성
- `inspire`: 디자인 링크는 선택, 링크가 있어도 재해석 허용
- `implement`: 링크된 디자인에서 벗어나지 않음, `/ds-add`에서 링크 요청

#### B. 에이전트 관리 디자인 참조 맵

`.harness/design-references.json` (mode가 `free`가 아닐 때 생성):
```json
{
  "version": 1,
  "mode": "implement",
  "fidelity": "match",
  "disclaimerAcceptedAt": "ISO-8601",
  "sources": [{ "id", "label", "fileUrl", "role": "primary" }],
  "entries": [{
    "id": "atom-button",
    "kind": "atom",
    "codePath": "src/design-system/atoms/Button/Button.tsx",
    "figma": { "url", "nodeId", "label" },
    "status": "linked|needed|inspire-only|waived|broken",
    "notes": ""
  }]
}
```

- **에이전트가 관리** — 사용자는 Figma URL만 붙여넣으면 됨 (JSON 편집 불필요)
- `/ds-ref` 워크플로로 소스 등록 및 컴포넌트 링크 추가
- `/ds-add`에서 `implement` 모드는 컴포넌트별 링크를 물어봄 (있음/없음/나중에)
- Figma 접근은 사용자 MCP로 제공 (CLI가 API 키를 다루지 않음)

**1:1 codegen 제품이 아니다** — 맵은 "어디를 보고 만들었는가"의 추적 기록이지, 
"Figma → 코드" 자동 변환 엔진이 아니다. 에이전트는 여전히 토큰·Atomic 계층·접근성 규칙을 
따라 **손으로** 코드를 작성한다.

#### C. 코딩 스타일 설문 + config 저장

`.harness/config.json`에 `style` 필드 추가:
```json
{
  "style": {
    "componentDeclaration": "function" | "arrow",
    "componentExport": "default" | "named",
    "styling": "css-modules" | "tailwind" | "detected"
  }
}
```

- 설치 시 질문 (감지 가능하면 감지, 불가능하면 물어봄)
- `AGENTS.md`에 명시 → 에이전트가 항상 따름
- CLI 플래그로도 제공: `--component-declaration`, `--component-export`, `--styling`

**기본값 (--yes 경로)**: aimon-like 스타일 — `function` + `default` + CSS Modules 
(감지 불가능한 경우). 이 조합이 접근성·React DevTools 호환성이 가장 넓다.

#### D. 이중 진입점 (CLI + 에이전트 재질문)

decision #18 (Storybook 의향)과 같은 패턴:
1. CLI 프롬프트에서 물어봄 (대화형 / --yes / 플래그)
2. 에이전트 채팅에서 config 비어있으면 다시 물어봄 (`/ds-ref` 워크플로)

"설치 시 안 물어본 건 나중에 못 쓴다" 함정 방지 — 설치를 `--yes`로 넘겼어도 에이전트가 
실제로 디자인 작업을 시작할 때 한 번 더 물어볼 수 있다.

#### E. 면책 조항 (라이선스 책임)

Figma 파일 URL 입력 또는 `implement` 모드 선택 시:
```
⚠️  면책 조항

디자인 참조 맵은 사용자의 책임으로 관리됩니다.
- Figma 파일에 대한 접근 권한과 라이선스는 사용자 책임입니다
- 에이전트는 제공된 링크를 저장만 하며, 라이선스를 검증하지 않습니다
- 디자인 저작권·사용 권리는 프로젝트 소유자에게 있습니다

위 조건을 이해하고 동의하시나요?
```

수락 시각을 `config.json`과 `design-references.json` 양쪽에 ISO-8601로 기록.

### 범위 밖 (v0.4.0)

- Figma MCP 클라이언트를 CLI에 내장 — 사용자 MCP 설정으로 위임
- 픽셀 단위 자동 검증 (`strict` 모드) — UI만 준비, 실제 강제는 나중
- 전체 Figma 파일 자동 파싱 → 컴포넌트 시드 — 수동 등록만 (복잡도 과다)
- npm 배포 — PR만, 병합 후 수동 publish

### 추가 작업

- `templates/core/AGENTS.md` — 모드·스타일 섹션 추가, 디자인 맵 설명
- `templates/core/workflows/ds-add.md` — `implement` 모드에서 링크 물어보기 단계
- `templates/core/workflows/ds-ref.md` (신규) — 디자인 소스·컴포넌트 링크 관리
- `src/types.ts` — 새 타입들 (`IDesignReferences`, `ICodingStyle` 등)
- `src/prompts.ts` — 모드·스타일·Figma URL·면책 프롬프트
- `src/cli.ts` — 새 플래그들
- `src/registry.ts` — `design-references.json` 생성, `HAS_DESIGN_REFS` 변수
- `package.json` — v0.4.0
- 테스트 업데이트 (스냅샷 재생성)

### 결정의 이유

**왜 1:1 codegen이 아닌가?** 
Figma → 코드 자동 변환은 생성 품질·접근성·유지보수·토큰 준수에서 신뢰할 수 없다. 
참조 맵은 "어디를 보고 만들었는가"의 **추적 기록**이지, 코드 생성 엔진이 아니다. 
에이전트는 규칙을 따라 손으로 작성하되, 올바른 소스를 보고 작성한다는 차이다.

**왜 이중 진입점?**
실사용에서 `--yes`로 넘긴 뒤 "디자인 맵이 왜 없지?"라는 상황이 반복됐다. 
설치 시 안 물어본 것을 나중에 다시 물어보면, 사용자는 그냥 채팅에서 답하면 되고 
CLI를 재실행할 필요가 없다 (decision #18과 동일 패턴).

**왜 에이전트가 맵을 관리?**
JSON을 손으로 편집하게 하면 형식 오류·중복 id·status 불일치가 쌓인다. 
에이전트가 URL만 받아 맵을 업데이트하면, 사용자는 Figma에서 복사-붙여넣기만 하면 된다.

## 24. v0.4.1 — Dogfood findings 반영 (Example* naming, styling 감지, Figma 우선)

실제 사용(dogfooding)에서 발견한 문제점 4가지를 수정한다:

### 1. Example* 접두사로 참조 구현과 제품 컴포넌트 분리

`/ds-init`이 만드는 참조 구현 컴포넌트(`Button`, `FormField`, `Form`, `Layout`)가
실제 제품 컴포넌트와 **이름이 충돌**했다. 제품에서 `Button`을 만들려는데 이미 
예제 `Button`이 있어서 덮어쓰거나 이름을 바꿔야 하는 상황이 반복됐다.

해법: 참조 구현 컴포넌트는 **항상 `Example*` 접두사**를 쓴다 
(`ExampleButton`, `ExampleFormField`, `ExampleForm`, `ExampleLayout`).
스토리 title도 `Atoms/ExampleButton` 처럼 Example*으로 통일해 Storybook 사이드바에서
제품 컴포넌트와 섞이지 않게 한다.

대상 파일:
- `templates/core/workflows/ds-init.md` — 절차 8번(참조 구현 생성)에 Example* 명명 명시
- `templates/core/workflows/ds-add.md` — 제품 스토리는 실제 사용 변형을 포함해야 한다는 안내 추가

### 2. `styling` 감지 개선 — CSS Modules 실제 감지, 명시적 기본값

**기존 문제**: Tailwind·CSS-in-JS가 없으면 CLI가 조용히 `css-modules`를 기본값으로 
설정했다. 실제로 프로젝트에 `.module.css` 파일이 하나도 없고 `App.css`·`index.css`만 
있어도 `css-modules`로 설정돼 혼란을 줬다.

**변경 사항**:
1. `src/detect.ts`에 `hasCssModules()` 함수 추가 — src/ 안에 `.module.css` / `.module.scss` 
   파일이 실제로 있는지 스캔
2. 감지 순서: Tailwind → CSS-in-JS → CSS Modules → **plain CSS** (새 타입)
3. 대화형 프롬프트: Tailwind·CSS-in-JS·CSS Modules 모두 감지 안 되면 세 선택지 제공
   (`css`, `css-modules`, `tailwind`)
4. `--yes` 기본값: Tailwind이나 CSS-in-JS나 CSS Modules가 감지되지 않으면 `css` (명시적)
5. `src/types.ts`: `TStyling`에 `'css'` 타입 추가, `IDetectResult`에 `hasCssModules` 필드 추가
6. CLI `--styling` 플래그: `css|css-modules|tailwind` 세 값 허용

이제 "CSS Modules 없는 프로젝트에 css-modules가 기본값으로 들어간다"는 버그가 사라진다.

### 3. `implement`/`inspire` 모드에서 Figma 변수를 브랜드 토큰 질문보다 먼저

**기존 문제**: `/ds-init`이 브랜드 토큰(`--primitive-primary-*`)을 물어볼 때 사용자 입력만 
받았다. 이미 Figma 파일에 변수(variables)로 브랜드 색상이 정의돼 있어도 **무시하고** 
다시 물어봐서 수동 입력을 강제했다.

**변경 사항**:
`templates/core/workflows/ds-init.md` 절차 2번(브랜드 토큰 확인) 수정:
- 모드가 `implement` 또는 `inspire`이고 `.harness/design-references.json`에 Figma 소스가 있으면:
  1. 먼저 사용자 MCP로 Figma 파일의 variables / design context 읽기 시도
  2. primary/brand 색상 램프를 찾아 `--primitive-primary-*` 10단계로 매핑
  3. 변수를 찾을 수 없거나 MCP 없으면 기존 수동 질문으로 fallback
- `free` 모드이거나 Figma 소스 없으면: 기존 수동 질문 그대로

이제 Figma를 이미 연결한 프로젝트는 브랜드 색상을 자동으로 가져올 수 있다 
(Figma MCP 사용 가능 시). 사용자 경험 개선.

### 4. 제품 컴포넌트 스토리는 실제 사용 변형을 포함해야 한다는 안내

**발견한 문제**: 제품 컴포넌트(`Button`, `TextField`)의 스토리가 기본 예제만 있고, 
실제 화면에서 쓰이는 변형(예: Login 화면의 fullWidth Button + size="large")은 스토리에 없었다. 
결과적으로 "스토리는 통과하지만 실제 페이지는 깨진" 상황이 반복됐다.

**변경 사항**:
`templates/core/workflows/ds-add.md`에 다음 안내 추가:
- Example* 참조 구현과 달리, 제품 컴포넌트의 스토리는 실제 화면에서 쓰이는 조합을 보여줘야 함
- "기본 예제만 있고 실제 쓰이는 조합은 스토리에 없다"면 변형 검증이 안 됨
- 새 화면을 만들 때 기존 컴포넌트의 variant/prop이 충분한지 스토리를 먼저 확인

이건 규칙이 아니라 **워크플로 지침**이라 강제는 안 하지만, 에이전트가 `/ds-add` 실행 시 
상기하게 된다.

### 추가 개선 (SHOULD 항목)

#### 모듈 선택 UX 개선
`src/prompts.ts`에서 모듈 multiselect 전에 안내문 추가:
- "모듈 선택 기준: 설치 직후 컴파일·검증을 통과할 수 있는 모듈만 기본 선택됩니다."
- "비권장 모듈을 포함하면 필요한 의존성이 없어 컴파일이 깨질 수 있습니다."
- 비권장 항목에 `⚠️` 이모지 추가 (`(비권장)` → `⚠️ 비권장`)

#### Machine path 노트 (README)
README 끝에 짧은 노트 추가:
- 로컬 Mac 경로(`/Users/...`)로 CLI를 실행하려면 machine-targeted 도구나 parent 에이전트 필요
- Cloud Agent sandbox executor는 로컬 machine path를 직접 볼 수 없을 수 있음

이 노트는 Cloud Agent가 `/Users/...` 경로로 CLI를 실행하려다 실패하는 상황을 미리 설명한다.

### 결론

v0.4.1은 대상 프로젝트 산출물 개선(Example* naming, Figma 우선), 감지 로직 수정(CSS Modules vs plain CSS), 
워크플로 지침 명확화(제품 스토리)를 포함한다. npm 배포는 PR 병합 후 수동 실행.

## 25. 버전 0.4.2 — Harness v05 Tester dogfood 피드백 반영

실제 사용(Harness v05 테스터 dogfood)에서 발견한 버그 4건을 수정한다:

### 1. ds-add가 config.style.styling을 무시하고 .module.css를 강제함

**문제**: `templates/core/workflows/ds-add.md`가 스타일 파일을 `<Name>.module.css`로 하드코딩했다.
프로젝트가 plain CSS나 Tailwind를 쓰는 경우에도 CSS Modules를 강제해 혼란을 줬다.

**수정**:
- ds-add.md에서 스타일 파일 생성 지침을 `.harness/config.json`의 `style.styling` 값에 따라 조건부로 작성
  - `css-modules`: `<Name>.module.css` + `import styles from './Name.module.css'`
  - `css` (plain): `<Name>.css` + `import './Name.css'`
  - `tailwind`: 최소한의 CSS 모듈 또는 없음, 유틸리티 클래스
  - `detected` (CSS-in-JS): 짧은 가이드, module.css 강제 안 함
- `10-architecture.md`의 "스타일은 컴포넌트 옆 `*.module.css`" 문구를 `{{STYLING}}` 변수로 교체

이제 각 프로젝트의 실제 스타일 방식을 존중한다.

### 2. AGENTS.md에 Mustache 조건문이 raw로 출력됨

**문제**: 렌더링된 `AGENTS.md`에 `{{#if HAS_DESIGN_REFS}}`·`{{/if}}` 같은 Mustache 조건문이
그대로 남았다. 원인은 `DESIGN_FIDELITY`를 조건문에 직접 사용했는데, 이 변수는 boolean이 아니라
문자열 값이었다 — 렌더러는 `vars[key] === 'true'`일 때만 블록을 유지하므로, `fidelity`가 `null`이면
빈 문자열이 되고 블록이 남아버렸다.

**수정**:
- `src/registry.ts`에 `HAS_DESIGN_FIDELITY: String(!!options.fidelity)` 추가
- `templates/core/AGENTS.md`에서 `{{#if DESIGN_FIDELITY}}`를 `{{#if HAS_DESIGN_FIDELITY}}`로 변경
- 테스트 추가: `AGENTS.md`에 raw `{{#if` / `{{/if}}`가 남지 않는지 여러 시나리오로 검증
  (design-system ON/OFF, free/implement 모드, fidelity 유무)

조건문은 반드시 boolean 플래그(`'true'` / `'false'`)를 사용해야 한다는 원칙 재확인.

### 3. Storybook peer dependency 충돌 대응 안내 부족

**문제**: `storybook init` 후 npm peer conflict(예: `@vitest/browser-playwright`와 vitest 버전 불일치)가
자주 발생하는데, 안내가 없어 사용자가 막혔다.

**수정**:
- `templates/core/workflows/ds-init.md`에 "Peer dependency 충돌 대응" 절 추가
  - vitest 관련 패키지 버전을 Storybook 요구사항에 맞추거나
  - `npm install --legacy-peer-deps`로 경고 무시
  - 실제 빌드·테스트가 깨지지 않으면 경고만으로 막을 필요 없음

짧고 실용적인 안내로 첫 설치 마찰을 줄인다.

### 4. ds-ref에 "올바른 화면 노드 필요" 안내 추가

**보충**: `/ds-ref`로 Figma 링크를 붙일 때 **올바른 화면/컴포넌트 노드**가 필요하다는 안내가 없었다.
잘못된 노드(상위 페이지, 다른 variant)를 링크하면 구현이 어긋난다.

**수정**:
- `templates/core/workflows/ds-ref.md` "컴포넌트 링크 등록" 절에 짧은 노트 추가
  - 올바른 노드 필요성 명시
  - 이미 잘못 링크한 경우 `status: 'waived'` 또는 재링크로 수정 가능

이것은 제품 기능이 아니라 워크플로 안내 개선이다.

### 영향 범위

- 대상 프로젝트로 복사되는 템플릿 3개 수정 (ds-add.md, AGENTS.md, ds-init.md, ds-ref.md, 10-architecture.md)
- 렌더러 변수 정의 1개 추가 (HAS_DESIGN_FIDELITY)
- 테스트 케이스 4개 추가 (Mustache 누출 방지 검증)
- 버전 0.4.2 bump

npm 배포는 PR 병합 후 수동 실행. 이번 릴리스는 버그 수정이 주 목적이다.

## 26. 버전 0.4.3 — 설치 시 Figma URL 수집 제거 (implement 모드 포함)

### 배경

실사용에서 발견한 근본 문제: **설치 시점에 Figma URL을 물어보는 것은 implement 모드에서도 의미가 없다.**

- **implement 모드는 N개 화면을 만드는 프로젝트다** — 하나의 Figma 파일 URL로는 "어느 화면인가?"를 표현할 수 없다
- 설치 시 URL을 받으면:
  1. 첫 화면만 링크되고 나머지는 안 받게 되거나
  2. 전체 파일 URL을 받았는데 각 화면 노드 ID는 없어서 쓸모없거나
  3. 첫 화면 말고는 맵에 안 쌓여서 결국 "링크가 있는데 왜 안 보고 만들었나요?" 재질문이 나온다
- **올바른 시점은 각 화면을 만들 때** (`/ds-add`): "이 화면에 참고할 피그마/URL 있어요?"

### 결정

**설치 = 모드만. Figma URL = 화면 작업 시.**

- CLI 대화형 프롬프트에서 Figma URL 질문 제거 (inspire/implement 무관)
- `--figma-url` 플래그는 남김 (power user가 명시적으로 주면 받음)
- Figma URL 없으면 disclaimer도 스킵 (명시적 플래그 없는 한)
- inspire/implement 모드 선택 시 `.harness/design-references.json` 빈 맵으로 시드 (URL 없이)
- 에이전트 워크플로 (`/harness-setup`, `AGENTS.md`)도 동일 — 설치 때 Figma 안 물어봄
- **`/ds-add` 워크플로**: implement 모드에서 각 화면 시작 시 "이 화면에 참고할 피그마/URL 있어요?" 물어봄 (있음/없음/나중에)
- 사용자가 이미 요청 메시지에 URL을 포함했으면 저장하고, 다시 묻지 않음

### 근거

- **"어느 화면"을 설치 시점에 알 수 없다** — implement 프로젝트는 화면이 여러 개다
- URL 수집은 **컨텍스트가 있는 시점**(화면 이름·요구사항이 명확할 때)에 하는 게 맞다
- 설치 때 받으면 첫 화면만 링크되거나, 전체 파일 URL인데 노드 ID 없어서 쓸모없거나
- `/ds-add` 실행 시 물어보면: 
  - 맥락이 명확함 ("로그인 화면" + "피그마 있어요?")
  - N개 화면을 N번 물어보므로 누락 없음
  - 없으면 waived, 나중에면 needed 상태로 기록

### 변경 사항

1. **`src/prompts.ts`**: 155-211줄 Figma URL 프롬프트 제거, figmaUrl/acceptDisclaimer는 defaults 값 사용
2. **`src/registry.ts`**: mode가 free가 아니면 figmaUrl 유무와 관계없이 빈 design-references.json 생성
3. **`templates/core/workflows/harness-setup.md`**: Q3 (피그마 파일 링크) 제거, Q 번호 재조정
4. **`templates/core/AGENTS.md`**: 설치 시 Figma URL 재질문 제거, `/ds-add` 실행 시 물어보도록 명시
5. **`templates/core/workflows/ds-add.md`**: 디자인 링크 물어보기 강조 (있음/없음/나중에), 사용자가 이미 URL 포함 시 재질문 안 함
6. **`README.md`**: --figma-url 플래그는 optional, interactive install에서 묻지 않는다는 노트 추가
7. **`package.json`**: 버전 0.4.3 bump

### 범위 밖

- npm 배포 (PR 병합 후 수동)
- 데모 앱

### 완료 조건

- PR 생성
- 버전 0.4.3
- 테스트 통과
- 설치 경로에 Figma 프롬프트 없음

## 27. 버전 0.4.4 — `-y`/`--yes` 제거, 명시적 두 경로 (TTY vs explicit flags/config)

### 배경 (v07 dogfood 문제)

에이전트가 TTY 없이 CLI를 실행할 때 두 가지 실패 패턴:
1. `-y` 사용 → 질문 건너뛰고 잘못된 기본값 적용 (모드/모듈/스타일 추론 실패)
2. `-y` 없이 실행 → clack 프롬프트에서 stdin 대기로 무한 대기

둘 다 나쁨. 근본 원인은 `-y`가 "조용한 기본값" 경로를 열어뒀기 때문.

### 해결 방안

**두 경로만 허용:**

1. **Interactive (TTY)**: `process.stdin.isTTY === true` → 현재대로 `@clack/prompts` 사용
   - 명시적 플래그는 여전히 해당 질문을 건너뛰고 prefill 역할 (partial flags OK)
   
2. **Explicit answers (non-TTY / automation)**: clack 안 씀
   - 모든 필수 답변을 `--플래그` **및/또는** `--config <path.json>`으로 제공해야 함
   - stdin으로도 config 가능: `--config -`
   - **누락 시 즉시 non-zero exit** (한국어+영어 안내, 예시 명령 제공)
   - stdin 프롬프트로 **절대 걸리지 않음** (`!process.stdin.isTTY`)

**`-y`/`--yes` 완전 제거:**
- `parseArgs` options에서 제거
- `IScaffoldOptions.yes` 필드 제거
- `runPrompts` 첫 줄 early-return 제거
- README, AGENTS.md, harness-setup.md, help text, DECISIONS 참조 제거
- 테스트에서 `yes: true` 사용 제거

**"기본값으로 넘어가기" 탈출구 없음.** 누락 = 에러, aimon 기본값이나 추론 기본값으로 조용히 넘어가지 않음.

### 필수 답변 기준 (현재 `runPrompts` 질문과 1:1 매칭)

- `--mode` (free|inspire|implement)
- `--agents` (cursor|claude|both)
- `--modules` (감지 기반 권장이 아니라 명시 필요)
- React 프로젝트인데 감지 안 되면: `--component-declaration`, `--component-export`
- 스타일 감지 안 되면: `--styling` (css|css-modules|tailwind)
- `design-system` 모듈 선택 시: `--storybook` (off|pending)
- `--ponytail` 명시 (false는 플래그 생략으로 표현 가능, true는 플래그 필수)
- Figma: 설치 시 **필수 아님** (decision #26). `--figma-url`/`--accept-disclaimer`는 power-user 선택

Partial flags on TTY: 여전히 OK (나머지는 프롬프트).  
Partial flags on non-TTY: 에러 + 누락 항목 나열.

### `--config <path>` 추가

JSON 파일로 설정 제공. 스키마는 플래그와 1:1 매핑:
```json
{
  "mode": "free",
  "agents": ["cursor", "claude"],
  "modules": ["design-system", "lint"],
  "storybook": "pending",
  "ponytail": false,
  "componentDeclaration": "function",
  "componentExport": "default",
  "styling": "css-modules",
  "figmaUrl": "...",
  "acceptDisclaimer": true
}
```

- 플래그가 config보다 우선 (충돌 시)
- stdin 지원: `--config -`
- 알 수 없는 키 = 에러 (오타 방지)
- 유효하지 않은 enum 값 = 에러

### 문서 변경 (올바른 에이전트 경로)

에이전트가 `-y` 없이 설치하는 올바른 패턴:
1. 채팅에서 설치 질문 (`/harness-setup`, AGENTS.md)
2. **명시적 플래그 및/또는 `--config`** 로 CLI 재실행 (**`-y` 없음**)
3. `.harness/config.json` 이미 있으면 재질문 안 함

업데이트 대상:
- `templates/core/AGENTS.md` — 설치 섹션
- `templates/core/workflows/harness-setup.md` — CLI 실행 예시
- `README.md` — TTY vs non-TTY 두 경로, `--config` 설명
- `DECISIONS.md` — 이 decision #27
- `TODO.md` — 0.4.4 체크리스트 (있으면)

### 테스트

- `test/scaffold.test.ts`: `yes: true` 사용 제거, 전체 명시적 옵션으로 교체
- 새 테스트 추가:
  - non-TTY + 필수 답변 누락 → exit 1 (또는 throw)
  - non-TTY + 전체 플래그 → OK
  - `--config` 로드 → 플래그 우선
  - `-y` 플래그 파싱 시도 → 에러 (또는 unknown option)
- `npm run check` 통과

### 버전

`package.json` + `package-lock.json`: **0.4.3 → 0.4.4**

npm publish는 PR 병합 후 수동 (자동 배포 없음).

### PR

브랜치 + PR against main. 제목/본문은 한국어 또는 이중 언어 OK.  
에이전트 행동 변경 요약 (더 이상 `-y` 안 씀, non-TTY는 명시 필수).

### 성공 기준

- 공개 CLI에 `--yes` 없음
- TTY는 여전히 대화형
- non-TTY는 절대 무한 대기 안 함
- 에이전트 문서: 채팅 → 플래그/config로 CLI 실행 (no `-y`)
- 테스트 통과

