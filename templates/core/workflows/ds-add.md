---
description: Break a screen into Atomic layers and build components bottom-up (atom → molecule → organism) BEFORE writing the page.
---

# /ds-add — 페이지 전에 계층부터

UI 작업 지시를 받았을 때, 페이지 레이아웃에 착수하기 **전에** 실행하는 절차다.
계층 정의와 경계 규칙은 `{{RULES_DIR}}/30-design-system` 에 있다.

## 절차

{{#if HAS_DESIGN_REFS}}
0. **디자인 참조 확인**: `.harness/design-references.json` 을 읽어 현재 작업의 디자인 링크가 있는지 확인한다.
   - `implement` 모드에서 링크가 있으면: 해당 Figma 노드를 사용자 MCP를 통해 읽는다 (가능한 경우)
   - 링크가 없으면: 나중에 컴포넌트별로 링크를 물어본다

{{/if}}
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
   - 스타일 파일 (`.harness/config.json` 의 `style.styling` 에 따라):
     - `css-modules`: `<Name>.module.css` + `import styles from './Name.module.css'`
     - `css` (plain): `<Name>.css` (또는 colocated plain CSS) + `import './Name.css'`
     - `tailwind`: 최소한의 CSS 모듈 파일 또는 없음, 유틸리티 클래스 사용
     - `detected` (CSS-in-JS 등): 짧은 가이드만, module.css 강제 안 함
   - 어떤 스타일 방식이든 클릭 가능한 요소는 최소 `:hover`·`:focus-visible` 두 상태 포함
     (`30-design-system` 필수 규칙). 뜬 요소는 계층에 맞는 `--shadow-*`, 상태 전환에는
     `--duration-*`/`--easing-*` — 언제 쓰는지는 `30-design-system` 표 참고
   - `<Name>.stories.tsx` — `src/design-system/_story-template.tsx` 형식을 따르고
     `title` 은 계층 그대로(`Atoms/Button`), **play 함수 필수**:
     주요 상호작용(클릭·입력)과 포커스·aria 상태를 단정한다
     
     **제품 컴포넌트 스토리는 실제 사용 변형을 포함해야 한다:**
     - Example* 참조 구현과 달리, 제품 컴포넌트(Button, TextField 등)의 스토리는
       실제 화면에서 쓰이는 조합을 보여준다(예: Login 화면에서 fullWidth Button + size="large")
     - "기본 예제만 있고 실제 쓰이는 조합은 스토리에 없다"면 변형 검증이 안 된다
     - 새 화면을 만들 때 기존 컴포넌트의 variant/prop이 충분한지 스토리를 먼저 확인한다
   - `index.ts` — 공개 API
{{#if HAS_DESIGN_REFS}}
   - **디자인 링크 물어보기** (`implement` 모드에서): 컴포넌트를 만든 후 Figma 링크가 있는지 물어본다.
     - "이 컴포넌트의 Figma 링크가 있나요? (있음/없음/나중에)"
     - 있음 → URL만 붙여넣으면 됨, `.harness/design-references.json` 에 자동 기록
     - 없음 → `status: waived` 로 기록 (이 컴포넌트는 링크 없이 진행)
     - 나중에 → `status: needed` 로 기록 (나중에 `/ds-ref` 로 추가 가능)
{{/if}}
6. **검증**: 스토리 테스트와 stylelint, lint(계층 위반 검사) 통과 확인. UI 완성도(인터랙션
   상태·트랜지션·그림자)는 정적 분석으로 못 잡으므로 `/ux-review`로 별도 확인한다.
7. 이제 페이지를 쓴다. 페이지에는 훅 호출과 조립만 남는다 —
   새 마크업·스타일이 필요해지면 5번으로 돌아간다.

## 금지

- 페이지 파일 안에 일회성 버튼·인풋 스타일 작성 (드리프트의 시작)
- 계층 건너뛰기 — atom 없이 organism부터 만들기
- atom/molecule 안에서 도메인 타입·쿼리 훅·전역 스토어 사용
- 스토리 없는 컴포넌트
- 토큰에 없는 색·간격을 쓰기 위해 인라인 style로 우회
