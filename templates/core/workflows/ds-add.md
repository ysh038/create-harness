---
description: Add a design-system component with story and play function BEFORE layout work.
---

# /ds-add — 레이아웃 전에 컴포넌트부터

UI 작업 지시를 받았을 때, 페이지 레이아웃에 착수하기 **전에** 실행하는 절차다.

## 절차

1. **재고 조사**: `src/design-system/components/` 와 `src/components/shared/` 를 조회한다.
   - 필요한 컴포넌트가 이미 있으면 그대로 쓴다. 끝.
   - 비슷한 것이 있으면 variant/prop 추가를 우선 검토한다. 복제 금지.
2. **Storybook 확인**: `.storybook/` 이 없으면 먼저 `/ds-init` 을 실행한다.
3. **컴포넌트 작성**: `src/design-system/components/<Name>/` 에:
   - `<Name>.tsx` — 토큰만 사용 (`tokens.css` 변수·`tokens.ts` 상수), 원시 색상값 금지
   - `<Name>.module.css`
   - `<Name>.stories.tsx` — `src/design-system/_story-template.tsx` 형식을 따르고 **play 함수 필수**:
     주요 상호작용(클릭·입력)과 포커스·aria 상태를 단정한다
   - `index.ts` — 공개 API
4. **검증**: 스토리 테스트와 stylelint 통과 확인.
5. 이제 페이지 레이아웃 작업에 착수한다. 페이지에서는 방금 만든 컴포넌트를 조립만 한다.

## 금지

- 페이지 파일 안에 일회성 버튼·인풋 스타일 작성 (드리프트의 시작)
- 스토리 없는 디자인시스템 컴포넌트
- 토큰에 없는 색·간격을 쓰기 위해 인라인 style로 우회
