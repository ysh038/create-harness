---
description: axios 단일 인스턴스, 토큰 처리, 401 처리, ProtectedRoute 가드
globs: src/utils/**/*.ts,src/**/auth/**/*.{ts,tsx},src/components/shared/ProtectedRoute.tsx
alwaysApply: false
---

# 인증과 HTTP

## 단일 axios 인스턴스

- 모든 HTTP 호출은 `src/utils/axiosInstance.ts` 의 `axiosInstance` 를 쓴다.
  `axios.get(...)` 이나 새 인스턴스 생성 금지 — 인터셉터를 우회하게 된다.
- (예외: SSE 스트리밍은 `fetch` 기반 별도 레이어를 쓴다)

## 토큰 규칙

- access token은 **메모리에만** 둔다 (`setAccessToken`/`getAccessToken`).
  `localStorage`·`sessionStorage` 저장 금지 — XSS에 그대로 노출된다.
- refresh token은 HttpOnly 쿠키. 클라이언트 코드가 읽을 수 없고, 읽으려 하지 않는다.
- 요청 인터셉터가 `Authorization: Bearer` 를 자동 첨부한다. 개별 호출에서 헤더 수동 설정 금지.

## 401 처리

- refresh 요청은 `refreshPromise` 로 중복 제거한다 — 동시에 만료된 요청 10개가
  refresh를 10번 부르면 안 된다.
- refresh 까지 실패하면 `window.dispatchEvent(new CustomEvent('auth:logout'))` 로
  이벤트만 발행한다. 인터셉터가 라우터를 직접 조작하지 않는다 (레이어 역전 금지).
  로그아웃 처리와 리다이렉트는 이 이벤트를 구독하는 인증 훅의 책임이다.

## 라우트 보호

- 로그인 필요 페이지는 `ProtectedRoute` 로 감싼다. 페이지 컴포넌트 안에서
  `if (!user) navigate('/login')` 하지 않는다.
- 역할 제한은 `requiredRoles` prop으로:

```tsx
<ProtectedRoute requiredRoles={['ROLE_ADMIN']}>
    <Admin />
</ProtectedRoute>
```

## 환경 변수

- API 주소 등은 `import.meta.env.VITE_*` 로만 접근하고 `.env.example` 에 항목을 유지한다.
- 시크릿(키·비밀번호)은 프론트엔드 번들에 절대 넣지 않는다. `VITE_` 접두가 붙는 순간 공개다.
