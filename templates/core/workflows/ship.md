---
description: Verify, review test integrity, commit with conventional message, log to task-log.
---

# /ship — 검증하고 커밋

작업을 마무리해 커밋한다. 게이트가 있지만, 게이트에 걸리기 전에 스스로 검증한다.

## 절차

1. **검증**: `node .harness/gates/run-checks.mjs` 전체 통과 확인. 실패하면 `/verify` 루프.
2. **테스트 무결성 검토**: 이번 변경에서 수정된 테스트 파일을 diff로 확인한다.
   - 단정문이 약해진 곳(`toBe` → `toBeTruthy`, 삭제된 expect, 추가된 skip)이 있으면
     커밋을 멈추고 사용자에게 보고한다.
3. **스테이징 검토**: `git status` 와 `git diff --cached` 로 의도한 파일만 올라갔는지 확인.
   - `.env*`, 디버깅 로그, 무관한 파일이 섞여 있으면 뺀다.
4. **커밋**: Conventional Commits 형식으로. 본문에는 "왜"를 적는다.

```bash
git add <의도한 파일들>
git commit -m "feat: <무엇> — <왜>"
```

5. **기록**: `docs/task-log.md` 맨 위에 한 줄 추가:
   `- YYYY-MM-DD <커밋 해시 앞 7자> <요약>`
6. push는 사용자가 요청했을 때만 한다. `--force` 금지.

## 금지

- `git commit --no-verify` — 게이트 우회 금지
- 검증 실패 상태에서 "일단 커밋" — 없다
