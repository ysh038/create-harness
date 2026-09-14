---
description: 레이어 구조, 단방향 의존, 공개 API 경계, 파일·명명 규칙
globs: src/**/*.{ts,tsx}
alwaysApply: false
---

# 아키텍처

## 레이어 (위에서 아래로만 의존)

```
routes / components   ← 페이지·UI. 조립만 한다 (내부는 Atomic 계층 — 30-design-system)
   ↓
hooks                 ← 화면 상태·데이터 오케스트레이션 (커스텀 훅)
   ↓
queries | stores      ← 서버 상태(TanStack Query) | 클라이언트 상태(Zustand)
   ↓
api / utils           ← 원시 HTTP 호출, axiosInstance
   ↓
mappers → types       ← 응답 → 도메인 타입 변환, 전역 타입
```

- **역방향 import 금지**: api 레이어가 hooks를 import하면 안 된다.
- **라우트 컴포넌트에 비즈니스 로직 금지**: fetch 호출·데이터 가공은 hooks/queries로 내린다.
  라우트는 훅을 호출하고 컴포넌트를 조립만 한다.

## 공개 API 경계

- 기능 폴더(`src/queries/{Domain}/`, `src/components/{Domain}/`)는 `index.ts` 로만 import한다.
- 폴더 내부 파일로의 deep import 금지 — ESLint `no-restricted-paths` 가 error 처리한다.

```ts
// 좋음
import { useExampleListQuery } from '../../queries/Example'
// 나쁨 — 내부 구현에 결합됨
import { fetchExampleList } from '../../queries/Example/exampleApi'
```

## 명명 규칙 (ESLint가 강제)

| 대상 | 규칙 | 예 |
|------|------|----|
| 인터페이스 | `I` 접두 + PascalCase | `IApiResponse`, `IUserInfo` |
| 타입 파라미터 | `T` 접두 | `<TData>`, `<TItem>` |
| boolean 변수·prop | `is/has/should/can/must/was/will` 접두 | `isLoading`, `hasError` |
| 컴포넌트 파일 | PascalCase | `ProtectedRoute.tsx` |
| 훅 | `use` 접두 camelCase | `useExampleListQuery` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT` |

## 폴더 구성

- 도메인별 하위 폴더: `components/Chat/`, `hooks/chat/`, `queries/Chat/`
- 공용은 `shared/`: `components/shared/`, `hooks/shared/`, `stores/shared/`
- 스타일은 컴포넌트 옆 `*.module.css` (CSS Modules)

### UI 계층 (Atomic)

`components` 레이어 안쪽은 Atomic 계층으로 다시 나뉜다. 상세 규칙·경계는
`30-design-system` 에 있고, 위치만 요약하면:

| 계층 | 위치 | 도메인 |
|------|------|--------|
| atom / molecule / 범용 organism | `src/design-system/{atoms,molecules,organisms}/` | 없음 |
| 도메인 organism | `src/components/{Domain}/` | 있음 |
| template(레이아웃) | `src/components/layouts/` | 없음 |
| page | 라우트 파일 | 있음 (훅 호출) |

- 계층은 아래에서 위로만 의존한다. atom이 molecule을 import하면 ESLint error다.
- 도메인 타입을 props로 받는 순간 `design-system/` 을 떠난다 —
  `design-system/` 안의 코드는 도메인 타입을 몰라야 한다.

### Atomic 계층과 도메인 폴더의 관계

혼동 방지를 위해 한 번 더 명시한다:

- **`components/{Domain}/`은 Atomic의 다음 계층이 *아니다.***
  Atomic 계층(atom → molecule → organism)은 모두 `design-system/` 안에 있다.
- `components/{Domain}/`은 **도메인별 organism 전용 위치**다.
  기존 10-architecture의 "기능 폴더" 구조에서 온 것이고, 도메인 타입을 props로
  받는 organism이 여기 들어간다.
- **pages/routes는 조립만 한다.** 페이지는 디자인시스템 폴더가 아니라 레이어 최상단으로,
  organism/template을 조립하고 훅을 호출하되 자체 마크업·스타일을 최소화한다.

```
routes / pages                             ← 조립 + 훅 호출
       ↑
components/layouts                         ← template (슬롯 기반 레이아웃)
       ↑
components/{Domain}                        ← 도메인 organism (예: ReviewCard)
       ↑
design-system/{atoms,molecules,organisms}  ← 도메인 비의존, 범용 재사용
```

도메인이 들어오면 `design-system/`을 떠나고, 데이터를 가져오면 컴포넌트가 아니라
page/hook이다 — 상세한 경계 규칙은 `30-design-system`을 본다.
