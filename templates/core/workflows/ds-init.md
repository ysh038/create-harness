---
description: One-time on-demand Storybook setup with a11y-as-error and vitest integration.
---

# /ds-init — Storybook 온디맨드 설치 (최초 1회)

UI 작업이 처음 필요해진 시점에 실행한다. 이미 `.storybook/` 이 있으면 실행하지 않는다.

## 절차

1. **Storybook 의향 확인**: `.harness/config.json` 의 `storybook` 필드를 읽는다.
   - `off` (또는 명시적 비활성화): **사용자에게 지금 Storybook을 켤지 물어본다**.
     동의한 경우에만 계속 진행하고, `storybook` 을 `pending` 으로 변경한다.
   - `pending` 또는 필드 없음: 의향이 있다는 뜻이므로 바로 설치 진행 (간단히 확인 가능)
   - `ready`: 이미 설치됨, 이 워크플로를 실행하지 않는다

2. **브랜드 토큰 확인**: `src/design-system/tokens.css` 의 `--primitive-primary-*` 가
   아직 하네스 기본값(`#4f46e5` 계열)이면, 지금이 UI 작업이 실제로 시작되는 시점이므로
   사용자에게 브랜드 색상을 묻는다. 답을 받으면 램프 10단계를 전부 교체한다(단계 하나만
   바꾸면 hover·pressed 파생값이 어긋난다). 아직 정해지지 않았다면 기본값 그대로 두되
   `docs/product-spec.md` TODO에 "브랜드 컬러 확정 필요"를 남긴다 — 이 확인을 건너뛰면
   기본값이 그대로 굳어져 나중에 아무도 안 건드리게 된다.

3. **공식 CLI로 설치** (손으로 설정 파일을 쓰지 않는다 — 프레임워크·빌더 감지는 CLI가 한다):

```bash
{{PM_EXEC}} storybook@latest init --no-dev --yes
```

   Vite 프로젝트면 최신 Storybook init이 `addon-vitest`·`addon-a11y`까지 함께 설치한다.
   설치 후 `package.json` 에 없으면 그때만 수동 추가:

```bash
{{PM_EXEC}} storybook add @storybook/addon-vitest
{{PM_EXEC}} storybook add @storybook/addon-a11y
```

4. **접근성 위반을 검증 실패로**: `.storybook/preview.(ts|tsx)` 의 `parameters.a11y.test` 를
   `'todo'`(init 기본값)에서 `'error'` 로 바꾼다:

```ts
a11y: {
    test: 'error',
},
```

5. **린트 정합**: Storybook이 만든 파일이 프로젝트 eslint에 걸리지 않게 한다.
   - 타입 인식 린트(parserOptions.project)를 쓰는 프로젝트면 eslint ignores에
     `.storybook/**` 와 `vitest.shims.d.ts`(addon-vitest 생성물) 추가
   - 스토리 export(PascalCase)가 naming-convention에 걸리면 `**/*.stories.{ts,tsx}` 오버라이드로
     해당 규칙을 끈다 (하네스 lint 모듈의 `eslint.harness.config.js` 에는 이미 포함)
   - init이 만든 예제(`src/stories/`)는 프로젝트 컨벤션에 안 맞으면 삭제한다

6. **checks에 등록**: `.harness/config.json` 의 `checks` 배열에서 `test` 항목 **앞**에 추가
   (addon-vitest 설치가 vitest workspace를 구성해준 경우):

```json
{ "id": "test-storybook", "command": "{{PM_EXEC}} vitest --project=storybook --run" }
```

   같은 파일에서 `storybook` 필드를 `"ready"` 로 올린다 (`off`/`pending` → `ready`).
   설치 전부터 있던 컴포넌트 중 스토리가 없는 것이 있으면
   `.harness/stories-baseline.json` 에 경로 목록을 스냅샷한다 (브라운필드 유예 —
   새 컴포넌트만 스토리 없음을 error로 취급할 때 기준점).

7. **계층 폴더 스켈레톤 생성**: Atomic 계층을 폴더로 고정한다
   (계층 정의는 `{{RULES_DIR}}/30-design-system`).

```
src/design-system/atoms/
src/design-system/molecules/
src/design-system/organisms/
src/components/layouts/        # template 계층
```

   Storybook 사이드바가 계층 순서대로 보이도록 `.storybook/preview.(ts|tsx)` 에
   `options.storySort` 를 넣는다:

```ts
options: {
    storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Layouts'] },
},
```

8. **참조 구현 생성**: 위 폴더에 이 프로젝트의 토큰만 쓰는 **한 줄기의 계층 예제**를 만든다 —
   `atoms/Button`, `molecules/FormField`(Button + 인풋 + 에러 메시지),
   `organisms/ExampleForm`(FormField 조합), `layouts/ExampleLayout`(슬롯 레이아웃).
   각각 스토리 포함, `title` 은 계층 그대로.
   흩어진 예제 3종보다 **한 화면이 atom에서 organism까지 쌓이는 과정**을 보여주는 편이
   모방 대상으로 낫다. 이 예제들은 컴파일되는 코드이므로 API가 바뀌면 깨진다 —
   그게 목적이다. 에이전트(자신 포함)가 산문 문서 대신 이 코드를 모방하게 된다.

9. **확인**: `{{PM_RUN}} storybook` 으로 기동 확인 후,
   `node .harness/gates/run-checks.mjs` 전체 통과 확인.
   계층 역방향 import가 lint error로 잡히는지 한 번 일부러 확인해 둔다.

## 완료 조건

- `.storybook/` 존재, a11y test = 'error', storySort 적용
- checks에 storybook 테스트 등록
- `.harness/config.json` 의 `storybook` 이 `"ready"`
- (해당 시) `.harness/stories-baseline.json` 스냅샷
- `atoms` / `molecules` / `organisms` / `layouts` 폴더와 계층 예제 + 스토리
