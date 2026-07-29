---
description: One-time on-demand Storybook setup with a11y-as-error and vitest integration.
---

# /ds-init — Storybook 온디맨드 설치 (최초 1회)

UI 작업이 처음 필요해진 시점에 실행한다. 이미 `.storybook/` 이 있으면 실행하지 않는다.

## 절차

1. **공식 CLI로 설치** (손으로 설정 파일을 쓰지 않는다 — 프레임워크·빌더 감지는 CLI가 한다):

```bash
{{PM_EXEC}} storybook@latest init --no-dev --yes
```

   Vite 프로젝트면 최신 Storybook init이 `addon-vitest`·`addon-a11y`까지 함께 설치한다.
   설치 후 `package.json` 에 없으면 그때만 수동 추가:

```bash
{{PM_EXEC}} storybook add @storybook/addon-vitest
{{PM_EXEC}} storybook add @storybook/addon-a11y
```

2. **접근성 위반을 검증 실패로**: `.storybook/preview.(ts|tsx)` 의 `parameters.a11y.test` 를
   `'todo'`(init 기본값)에서 `'error'` 로 바꾼다:

```ts
a11y: {
    test: 'error',
},
```

3. **린트 정합**: Storybook이 만든 파일이 프로젝트 eslint에 걸리지 않게 한다.
   - 타입 인식 린트(parserOptions.project)를 쓰는 프로젝트면 eslint ignores에
     `.storybook/**` 와 `vitest.shims.d.ts`(addon-vitest 생성물) 추가
   - 스토리 export(PascalCase)가 naming-convention에 걸리면 `**/*.stories.{ts,tsx}` 오버라이드로
     해당 규칙을 끈다 (하네스 lint 모듈의 `eslint.harness.config.js` 에는 이미 포함)
   - init이 만든 예제(`src/stories/`)는 프로젝트 컨벤션에 안 맞으면 삭제한다

4. **checks에 등록**: `.harness/config.json` 의 `checks` 배열에서 `test` 항목 **앞**에 추가
   (addon-vitest 설치가 vitest workspace를 구성해준 경우):

```json
{ "id": "test-storybook", "command": "{{PM_EXEC}} vitest --project=storybook --run" }
```

5. **참조 구현 생성**: `src/design-system/examples/` 아래에 이 프로젝트의 토큰과 컴포넌트만 쓰는
   예제 3종을 만든다 — 폼(`ExampleForm`), 데이터 테이블(`ExampleTable`), 상세 페이지(`ExampleDetail`).
   각각 스토리 포함. 이 예제들은 컴파일되는 코드이므로 API가 바뀌면 깨진다 —
   그게 목적이다. 에이전트(자신 포함)가 산문 문서 대신 이 코드를 모방하게 된다.
6. **확인**: `{{PM_RUN}} storybook` 으로 기동 확인 후,
   `node .harness/gates/run-checks.mjs` 전체 통과 확인.

## 완료 조건

- `.storybook/` 존재, a11y test = 'error'
- checks에 storybook 테스트 등록
- `src/design-system/examples/` 3종 + 스토리
