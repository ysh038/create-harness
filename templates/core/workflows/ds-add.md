---
description: Break a screen into Atomic layers and build components bottom-up (atom → molecule → organism) BEFORE writing the page.
---

# /ds-add — 페이지 전에 계층부터

UI 작업 지시를 받았을 때, 페이지 레이아웃에 착수하기 **전에** 실행하는 절차다.
계층 정의와 경계 규칙은 `{{RULES_DIR}}/30-design-system` 에 있다.

## 절차

1. **화면 분해**: 만들 화면을 계층으로 쪼개 목록을 먼저 적는다.

   ```
   OfficeDetailPage (page)
     └ DetailLayout (template)
         ├ OfficeSummary (organism, 도메인 → src/components/Office/)
         │   ├ RatingStars (molecule)
         │   │   └ Icon (atom)
         │   └ Badge (atom)
         └ ReviewList (organism, 도메인 → src/components/Review/)
             └ ReviewCard (molecule, 도메인)
                 └ Avatar (atom)
   ```

   목록 없이 코드를 시작하지 않는다. 이 목록이 곧 작업 순서다.

2. **재고 조사**: 목록의 각 항목이 `src/design-system/atoms|molecules|organisms/` 와
   `src/components/` 에 이미 있는지 조회한다.
   - 있으면 그대로 쓴다. 비슷한 것이 있으면 variant/prop 추가를 우선 검토한다. 복제 금지.
3. **Storybook 확인**: `.storybook/` 이 없으면 먼저 `/ds-init` 을 실행한다.
4. **계층 판정**: 없는 것마다 위치를 정한다.
   - 더 못 쪼개면 atom / atom 2~3개 조합이면 molecule / 의미 있는 블록이면 organism
   - 도메인 타입을 props로 받으면 `design-system/` 이 아니라 `src/components/{Domain}/`
   - 쿼리 훅·전역 스토어를 부르고 싶어지면 컴포넌트가 아니다 — 그 호출은 page로 올린다
5. **아래에서 위로 작성**: atom을 전부 끝내고 molecule, 그 다음 organism.
   각 컴포넌트 폴더에:
   - `<Name>.tsx` — 토큰만 사용 (`tokens.css` 변수·`tokens.ts` 상수), 원시 색상값 금지.
     자기보다 위 계층 import 금지 (ESLint error)
   - `<Name>.module.css`
   - `<Name>.stories.tsx` — `src/design-system/_story-template.tsx` 형식을 따르고
     `title` 은 계층 그대로(`Atoms/Button`), **play 함수 필수**:
     주요 상호작용(클릭·입력)과 포커스·aria 상태를 단정한다
   - `index.ts` — 공개 API
6. **검증**: 스토리 테스트와 stylelint, lint(계층 위반 검사) 통과 확인.
7. 이제 페이지를 쓴다. 페이지에는 훅 호출과 조립만 남는다 —
   새 마크업·스타일이 필요해지면 5번으로 돌아간다.

## 금지

- 페이지 파일 안에 일회성 버튼·인풋 스타일 작성 (드리프트의 시작)
- 계층 건너뛰기 — atom 없이 organism부터 만들기
- atom/molecule 안에서 도메인 타입·쿼리 훅·전역 스토어 사용
- 스토리 없는 컴포넌트
- 토큰에 없는 색·간격을 쓰기 위해 인라인 style로 우회
