---
description: Run all checks from .harness/config.json sequentially and fix failures in a loop.
---

# /verify — 전체 검증 실행

`.harness/config.json` 의 `checks` 를 순서대로 전부 실행하고, 실패를 고친다.

## 절차

1. 실행:

```bash
node .harness/gates/run-checks.mjs
```

2. 실패한 체크가 있으면:
   - 출력을 읽고 **원인을 고친다** (에러를 숨기거나 체크를 비활성화하지 않는다)
   - 다시 1부터. 모든 체크가 통과할 때까지 반복한다.
3. 반복해도 못 고치는 실패는 상황을 정리해 사용자에게 보고한다:
   - 어떤 체크가, 어떤 에러로, 무엇을 시도했는지

## 금지

- 체크를 통과시키기 위한 `eslint-disable`·`@ts-ignore`·`it.skip` 남발.
  정말 필요하면 이유 주석과 함께 최소 범위로만.
- `.harness/config.json` 에서 실패하는 체크를 삭제하는 것 — 체크 목록 변경은 사용자 승인 사항이다.
