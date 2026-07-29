---
description: 테스트 우선 개발, 단정문 약화 금지, 스토리 play 함수 규칙
globs: **/*.{test,spec,stories}.{ts,tsx}
alwaysApply: false
---

# 테스트

## 순서가 규칙이다

- 구현 전에 **실패하는 테스트**를 먼저 쓴다 (Red → Green → Refactor).
- 명세(`docs/specs/*.md`)의 수용 기준 하나 = 테스트 하나. 매핑이 안 되는 수용 기준은 명세가 모호한 것이다.

## 단정문 약화 금지

테스트가 실패할 때 허용되는 행동은 두 가지뿐이다:

1. 코드를 고친다 (대부분 이쪽)
2. 요구사항이 바뀌었음을 확인하고 테스트를 **의도적으로** 수정한다 — 커밋 메시지에 이유를 남긴다

`expect(x).toBe(3)` 이 실패한다고 `expect(x).toBeGreaterThan(0)` 으로 바꾸는 것,
`it.skip`, 빈 catch로 감싸기는 모두 금지다. `/ship` 단계에서 단정문 약화 여부를 검토한다.

## 무엇을 테스트하나

| 대상 | 도구 | 기준 |
|------|------|------|
| 유틸·mapper·순수 로직 | Vitest 단위 테스트 | 경계값·에러 케이스 포함 |
| 훅 | Vitest + Testing Library `renderHook` | 로딩·성공·실패 상태 |
| 디자인시스템 컴포넌트 | 스토리 + `play` 함수 | 상호작용·포커스 관리 |
| 컴포넌트 동작 | Testing Library | 사용자 관점 쿼리 (`getByRole` 우선) |

- 구현 세부(내부 state, 호출 횟수)가 아니라 **동작**을 테스트한다.
- 스냅샷 테스트는 의도적으로 검토 가능한 작은 단위에만 쓴다.

## 스토리 play 함수

스크린샷·시각 검증으로 못 잡는 것(포커스 이동, 키보드 조작, aria 상태)을 play 함수로 잡는다.

```tsx
play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: '저장' })
    await userEvent.click(button)
    await expect(canvas.getByRole('status')).toHaveTextContent('저장됨')
}
```
