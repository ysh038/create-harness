@AGENTS.md

<!-- 정본은 AGENTS.md 하나다. 이 파일에는 Claude Code 전용 보충만 적는다. -->

## Claude Code 보충

- 상세 컨벤션은 `{{RULES_DIR}}/` 아래 파일을 해당 영역 작업 전에 읽는다:
  - `00-core` 항상 / `10-architecture` src 전반 / `20-data-fetching` queries·hooks·api
  - `30-design-system` tsx·css / `40-testing` 테스트·스토리 / `50-auth-http` 인증·HTTP
- 워크플로는 `.claude/skills/` 의 spec / impl / verify / ship / design-system 스킬로 제공된다.
- 커밋 게이트는 `.claude/settings.json` 의 PreToolUse 훅으로 걸려 있다. 우회하지 않는다.
