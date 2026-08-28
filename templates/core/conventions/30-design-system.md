---
description: 디자인 토큰 강제, Atomic 계층 구조, 컴포넌트 선행 조립 규칙, Storybook 온디맨드 설치
globs: src/**/*.{tsx,css}
alwaysApply: false
---

# 디자인시스템

## 토큰은 닫힌 집합이다

- 색상은 **반드시** `src/design-system/tokens.css` 의 CSS 변수만 쓴다.
  원시값(`#hex`, `rgb()`, 색상 키워드)은 stylelint가 error 처리한다.
{{#if STYLELINT_BASELINE}}- 하네스 도입 전부터 원시값을 쓰던 CSS {{CSS_RAW_COLOR_FILES}}개는
  `.harness/stylelint-baseline.json` 에 유예 목록으로 올라가 warning 으로만 뜬다.
  **새로 만드는 파일은 유예 대상이 아니며 error다.** 유예 파일을 손볼 일이 생기면
  그 김에 원시값을 토큰으로 바꾸고 목록에서 경로를 지운다.
{{/if}}
- **존재하지 않는 토큰 이름을 발명하지 않는다.** 필요한 토큰이 없으면
  먼저 `tokens.css` 와 `tokens.ts` 양쪽에 추가하고 나서 쓴다.
- TS/JSX에서 토큰 값이 필요하면 `tokens.ts` 의 타입드 상수를 import한다 (문자열 하드코딩 금지).

```css
/* 좋음 */
.card { background: var(--color-surface); border-radius: var(--radius-md); }
/* 나쁨 — stylelint error */
.card { background: #ffffff; border-radius: 8px; }
```

- stylelint는 **색상만** 검사한다. 간격·타이포 토큰이 채워지면
  `stylelint.config.js` 의 주석 처리된 속성을 켠다.

## Atomic 계층 — 페이지는 조립의 결과지 출발점이 아니다

UI는 아래에서 위로 쌓는다. 각 계층은 **자기보다 아래 계층만** import한다.

```
page (라우트)          ← 훅 호출 + template/organism 조립만. 마크업·스타일 최소
   ↑
template (레이아웃)    ← 화면 골격. 슬롯(children/props)으로 내용을 받는다. 도메인 데이터 모름
   ↑
organism              ← molecule/atom 조합. 의미 있는 UI 블록 (카드, 목록, 폼 전체)
   ↑
molecule              ← atom 2~3개 조합. 단일 목적 (레이블+인풋+에러 = FormField)
   ↑
atom                  ← 더 못 쪼개는 최소 단위. 토큰만 사용 (Button, Input, Badge, Icon)
```

| 계층 | 위치 | 도메인 지식 | 데이터 |
|------|------|------------|--------|
| atom | `src/design-system/atoms/<Name>/` | 없음 | props |
| molecule | `src/design-system/molecules/<Name>/` | 없음 | props |
| organism (범용) | `src/design-system/organisms/<Name>/` | 없음 | props |
| organism (도메인) | `src/components/{Domain}/<Name>/` | 있음 | props (훅은 상위에서) |
| template | `src/components/layouts/<Name>/` | 없음 | slot |
| page | 라우트 파일 | 있음 | 훅 호출 |

### 경계 두 가지만 기억한다

1. **도메인이 들어오는 순간 `design-system/` 을 떠난다.**
   `ReviewCard`처럼 도메인 타입(`IReview`)을 props로 받으면 `src/components/{Domain}/` 이다.
   `design-system/` 안의 것은 어느 프로젝트에 옮겨도 컴파일돼야 한다.
2. **데이터를 가져오는 순간 컴포넌트가 아니라 page/hook이다.**
   organism 이하에서는 쿼리 훅·전역 스토어를 호출하지 않는다. props로 받는다
   (그래야 스토리로 모든 상태를 렌더할 수 있다).

### 역방향·횡단 import 금지

- atom → molecule/organism import 금지. molecule → organism 금지. **ESLint가 error 처리한다.**
- 같은 계층끼리의 import도 하지 않는다 (atom이 다른 atom을 쓰면 그건 molecule이다).
- 계층 폴더는 `index.ts` 공개 API로만 import한다. 내부 파일 deep import 금지.

```ts
// 좋음
import { Button } from '../../design-system/atoms/Button'
// 나쁨 — 내부 구현 deep import (ESLint error)
import { Button } from '../../design-system/atoms/Button/Button'
// 나쁨 — atom 안에서 molecule import (ESLint error)
```

### 계층 승격

molecule이 커져 organism이 되는 일은 정상이다. 폴더를 옮기고 스토리 `title` 을 바꾼다.
**애매하면 낮은 계층에 두지 않는다** — 잘못 올린 것은 내리기 쉽지만,
atom에 도메인이 섞이면 그 atom을 쓰는 화면 전부가 오염된다.

## UI 작업 절차 — 컴포넌트가 페이지보다 먼저

페이지·레이아웃 작업 지시를 받으면:

1. 화면을 계층으로 쪼갠다 — 이 페이지에 필요한 organism / molecule / atom 목록을 먼저 적는다
2. `src/design-system/` 과 `src/components/` 에 이미 있는지 확인 (있으면 그대로 쓴다)
3. 없는 것은 **낮은 계층부터** 만든다: atom → molecule → organism. 각각 `*.stories.tsx` 포함 — `/ds-add` 워크플로
4. Storybook이 아직 설치되지 않았다면 `/ds-init` 부터 실행
5. 마지막에 페이지를 쓴다. 페이지는 훅 호출 + 조립뿐이다

이 순서를 건너뛰고 페이지 안에 일회성 마크업·스타일을 쌓으면 UI가 화면마다 어긋난다(드리프트).
페이지 파일에 `<button className=...>` 이 등장하면 그건 빠뜨린 atom이다.

## 기존 컴포넌트 우선

- 새 버튼·입력·모달을 만들기 전에 `src/design-system/atoms|molecules|organisms/` 와
  `src/components/shared/` 를 먼저 조회한다. 비슷한 것이 있으면 variant를 추가하지 새로 만들지 않는다.
- 스토리 작성 형식은 `src/design-system/_story-template.tsx` 를 따른다.
  `title` 은 계층을 그대로 반영한다: `Atoms/Button`, `Molecules/FormField`, `Organisms/ReviewList`.
