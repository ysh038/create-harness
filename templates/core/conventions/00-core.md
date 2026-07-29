---
description: 항상 적용되는 핵심 규칙 — 검증 게이트, 금지 사항, TODO 정책
alwaysApply: true
---

# 핵심 규칙

## 작업 순서

1. 새 기능은 `/spec` 으로 명세부터 쓴다. 수용 기준 없는 구현 착수 금지.
2. 구현은 실패하는 테스트부터 (Red → Green → Refactor).
3. 커밋 전 `node .harness/gates/run-checks.mjs` 통과 필수. 게이트가 강제한다.

## 절대 금지

- `any` 타입 — `unknown` + 타입 좁히기를 쓴다
- `git commit --no-verify`, `git push --force`
- `.env*` 파일 커밋
- 테스트를 통과시키기 위한 단정문 약화 — 실패하면 코드를 고친다
- `console.log` 를 커밋에 포함 (디버깅 후 제거)

## TODO 정책 (남발 금지)

새 TODO를 `docs/product-spec.md` 에 추가하는 것은 다음을 **모두** 만족할 때만:

1. 사용자가 명시적으로 요청했거나, 현재 작업의 직접적인 후속 조치다
2. 지금 하지 않으면 버그·보안 문제로 이어진다
3. 기존 TODO와 중복되지 않는다

"나중에 개선하면 좋을 것 같은" 아이디어는 TODO가 아니다. 필요하면 `docs/decisions.md` 의
논의 섹션에 적고 사용자 판단에 맡긴다.

## 커밋

- Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`)
- 하나의 커밋은 하나의 논리적 변경만
