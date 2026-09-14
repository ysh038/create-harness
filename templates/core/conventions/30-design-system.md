---
description: 디자인 토큰 강제, 장식·모션 사용 기준, Atomic 계층 구조, 컴포넌트 선행 조립 규칙, Storybook 온디맨드 설치
globs: src/**/*.{tsx,css}
alwaysApply: false
---

# 디자인시스템

## 토큰은 닫힌 집합이다, 그리고 2계층이다

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

`tokens.css` 는 `--primitive-*`(색상 램프)와 그 위의 semantic 별칭 2계층이다.
**컴포넌트는 semantic 토큰만 쓴다 — `--primitive-*` 를 컴포넌트 CSS에서 직접 참조하지 않는다.**
브랜드를 바꿀 땐 primitive 램프만 교체하면 그걸 참조하는 모든 semantic 별칭이 따라온다.

```css
/* 좋음 — semantic 토큰. hover·pressed·subtle 이 이미 상태별로 준비돼 있다 */
.button {
    background: var(--color-primary);
    color: var(--color-on-primary);
    border-radius: var(--radius-md);
}
.button:hover { background: var(--color-primary-hover); }
.button:active { background: var(--color-primary-pressed); }
.button:focus-visible {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
}

/* 나쁨 — primitive 직접 참조. semantic 계층을 두는 의미가 없어진다 */
.button { background: var(--primitive-primary-600); }
/* 나쁨 — stylelint error */
.button { background: #4f46e5; }
```

- **인터랙션 요소(atom 중 클릭 가능한 것)는 최소 hover·focus-visible 두 상태를 다룬다.**
  기본 상태 하나만 스타일링하고 끝내지 않는다 — `--color-primary-hover`/`-pressed`,
  상태 색상의 `-subtle`(배경)/`-strong`(강조 텍스트) 세트가 이미 준비되어 있다.
- **`:focus-visible` 에 `--focus-ring-*` 토큰으로 포커스 링을 반드시 그린다.**
  `outline: none` 으로 지우기만 하고 대체 표시를 안 하는 것은 접근성 위반이다.
- stylelint는 **색상만** 검사한다. 간격·타이포 토큰이 채워지면
  `stylelint.config.js` 의 주석 처리된 속성을 켠다.

## 장식·모션 — 그림자·트랜지션은 언제 쓰는가

색상 토큰만 강제하면 "일관되지만 밋밋한" 결과가 나온다. 인터랙션 요소·뜬 요소는
아래 기준에 해당할 때 그림자·트랜지션을 **생략하지 않는다** — 근거 없이 아무 데나
장식을 넣으라는 뜻은 아니다.

| 상황 | 토큰 | 예 |
|------|------|----|
| 문서 표면 위에 살짝 뜬 요소 | `--shadow-sm` | 인풋 포커스, 툴팁 |
| 문서 흐름과 분리된 플로팅 요소 | `--shadow-md` | 드롭다운, 팝오버, sticky 헤더 |
| 배경을 덮는 오버레이 요소 | `--shadow-lg` | 모달, 다이얼로그 |
| 값이 바뀌는 인터랙션(hover·active·열림/닫힘) | `--duration-*` + `--easing-*` | 버튼 hover, 아코디언 펼침 |

```css
/* 좋음 — 상태 전환에 트랜지션 토큰. 클릭 가능함이 느껴진다 */
.card {
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--duration-base) var(--easing-standard);
}
.card:hover { box-shadow: var(--shadow-md); }

/* 나쁨 — 값은 토큰인데 전환이 순간적이다 */
.card:hover { box-shadow: var(--shadow-md); } /* transition 없음 */
```

- `transition`은 **바뀌는 속성만 지정**한다. `transition: all`은 의도치 않은 속성까지
  전환시켜 버벅임의 원인이 되므로 금지.
- 모달·팝오버처럼 화면에 들어오고 나가는 요소는 들어올 때 `--easing-decelerate`,
  나갈 때 `--easing-accelerate`를 쓴다. 그 외 상태 전환은 `--easing-standard`.
- `prefers-reduced-motion: reduce` 사용자에겐 전환·애니메이션을 끈다:

```css
@media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

- **이 절은 stylelint가 아니라 `/ux-review`로 확인한다.** "그림자가 있어야 하는
  자리에 있는가"는 정적 분석보다 시각적 판단이 더 정확하다 — 그래서 게이트가 아니라
  리뷰 워크플로가 담당한다.

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

#### `components/{Domain}` vs Atomic 계층

`components/{Domain}/` 을 "organism보다 위의 계층"으로 혼동하는 일이 잦다. 명확히 한다:

- **`components/{Domain}`은 Atomic 계층의 *다음 단계가 아니다.***
  Atomic 계층(atom → molecule → organism)은 모두 `design-system/` 안에서 닫힌다.
- `components/{Domain}`은 **도메인 organism의 위치**다. `design-system/organisms/`가
  도메인 비의존 범용 organism을 담는다면, `components/{Domain}`은 특정 도메인
  타입을 props로 받는 organism이 들어간다 (예: `IReview` → `components/Review/ReviewCard.tsx`).
- **pages/routes는 디자인시스템 폴더가 아니다.** 10-architecture의 레이어 최상단으로,
  organism/template을 조립하고 훅을 호출하는 자리다. 마크업·스타일을 여기에 쓰지 않는다.

```
routes / pages            ← 조립 + 훅 호출만
       ↑
components/layouts/       ← template (슬롯 기반 레이아웃)
       ↑
components/{Domain}/      ← 도메인 organism (ReviewCard, UserProfile 등)
       ↑
design-system/organisms/  ← 범용 organism (CardList, Modal, FormGroup 등)
```

도메인 타입이 props로 들어오는 순간 그 컴포넌트는 `design-system/`을 떠난다.
`design-system/` 은 프로젝트 간 이식 가능해야 한다.

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
