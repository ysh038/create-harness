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
