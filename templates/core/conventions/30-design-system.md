---
description: 디자인 토큰 강제, 컴포넌트 선행 추가 규칙, Storybook 온디맨드 설치
globs: src/**/*.{tsx,css}
alwaysApply: false
---

# 디자인시스템

## 토큰은 닫힌 집합이다

- 색상은 **반드시** `src/design-system/tokens.css` 의 CSS 변수만 쓴다.
  원시값(`#hex`, `rgb()`, 색상 키워드)은 stylelint가 error 처리한다.
- **존재하지 않는 토큰 이름을 발명하지 않는다.** 필요한 토큰이 없으면
  먼저 `tokens.css` 와 `tokens.ts` 양쪽에 추가하고 나서 쓴다.
- TS/JSX에서 토큰 값이 필요하면 `tokens.ts` 의 타입드 상수를 import한다 (문자열 하드코딩 금지).

```css
/* 좋음 */
.card { background: var(--color-surface); border-radius: var(--radius-md); }
/* 나쁨 — stylelint error */
.card { background: #ffffff; border-radius: 8px; }
```

- v0.1 기준 stylelint는 **색상만** error다. 간격·타이포 토큰이 채워지면
  `stylelint.config.js` 의 주석 처리된 속성을 켠다.

## UI 작업 절차 — 컴포넌트가 레이아웃보다 먼저

페이지·레이아웃 작업 지시를 받으면:

1. `src/design-system/components/` 에 필요한 컴포넌트가 이미 있는지 확인
2. 없으면 **레이아웃 착수 전에** 컴포넌트 + `*.stories.tsx`(play 함수 포함)를 먼저 추가 — `/ds-add` 워크플로
3. Storybook이 아직 설치되지 않았다면 `/ds-init` 부터 실행

이 순서를 건너뛰고 페이지 안에 일회성 스타일을 쌓으면 UI가 화면마다 어긋난다(드리프트).

## 기존 컴포넌트 우선

- 새 버튼·입력·모달을 만들기 전에 `src/design-system/components/` 와
  `src/components/shared/` 를 먼저 조회한다. 비슷한 것이 있으면 variant를 추가하지 새로 만들지 않는다.
- 스토리 작성 형식은 `src/design-system/_story-template.tsx` 를 따른다.
