---
description: 상태 4분류, TanStack Query 3계층 패턴, queryKey 규칙
globs: src/{queries,hooks,api,stores}/**/*.{ts,tsx}
alwaysApply: false
---

# 데이터와 상태

## 상태 4분류 — 저장 위치를 먼저 정한다

| 종류 | 저장소 | 예 |
|------|--------|----|
| 서버 캐시 | TanStack Query | 목록·상세 응답, 유저 정보 |
| 애플리케이션 상태 | Zustand (`stores/`) | 전역 모달 열림, 토스트 |
| UI 상태 | `useState` (컴포넌트 로컬) | 입력값, 아코디언 펼침 |
| URL 상태 | 라우터 (searchParams) | 필터, 페이지네이션, 탭 |

- **서버 캐시를 전역 스토어에 복사 금지.** Query 캐시가 정본이다. 복사하는 순간 동기화 버그가 시작된다.
- **필터·페이지네이션은 URL에.** 새로고침·공유·뒤로가기가 공짜로 동작한다.

## 3계층 데이터 패턴

```
queries/{Domain}/
├── exampleApi.ts        # 1) 원시 호출: axiosInstance 사용, IApiResponse<T> 반환
├── exampleQueryKeys.ts  # 2) queryKey 팩토리: 계층적 키
└── index.ts             # 3) 공개 API: useQuery 훅만 export
```

- 컴포넌트는 `queries/{Domain}` 의 훅만 쓴다. `axiosInstance` 직접 호출 금지.
- 화면 조합 로직(여러 쿼리 결합, 파생 상태)은 `hooks/{domain}/use*.ts` 에 둔다.

## queryKey 규칙

```ts
export const exampleQueryKeys = {
    all: ['example'] as const,
    lists: () => [...exampleQueryKeys.all, 'list'] as const,
    list: (filters: IExampleFilters) =>
        [...exampleQueryKeys.lists(), filters] as const,
    detail: (id: string) => [...exampleQueryKeys.all, 'detail', id] as const,
}
```

- 무효화는 상위 키로: `invalidateQueries({ queryKey: exampleQueryKeys.lists() })`
- 키에 들어가는 객체는 직렬화 가능해야 한다 (함수·클래스 인스턴스 금지)

## 응답 래퍼

모든 API 응답은 `IApiResponse<T>` (`src/types/api.ts`)를 통과한다.
컴포넌트에 백엔드 원시 응답 형태가 새어나가지 않게 mappers에서 도메인 타입으로 변환한다.
