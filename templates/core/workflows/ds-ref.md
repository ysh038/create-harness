---
description: Register design sources and manage the design reference map for Figma links.
---

# /ds-ref — 디자인 참조 맵 관리

`.harness/design-references.json` 에 디자인 소스(Figma 파일)와 컴포넌트별 링크를 등록·관리한다.
이 워크플로는 `inspire` / `implement` 모드에서만 활성화된다.

## 용도

1. **디자인 소스 추가**: 새 Figma 파일을 sources 목록에 등록
2. **컴포넌트 링크 등록**: 이미 만든 컴포넌트에 나중에 Figma 링크 붙이기
3. **페이지 URL에서 일괄 등록**: Figma 페이지 URL을 주면 그 안의 컴포넌트들을 `needed` 상태로 시드

**페이지 참조 단위**: 복잡한 페이지를 구현할 때 **하나의 페이지 URL**로 충분하다. 섹션별로 여러 개의 
URL을 등록할 필요는 없다 — 같은 페이지에서 다른 node-id로 특정 섹션을 재읽기할 수 있다. 
섹션별 깊은 읽기는 선택사항이며, 시각적 충실도를 높이는 데 도움이 된다.

## 절차

### A. 디자인 소스 추가

사용자가 새 Figma 파일 URL을 줄 때:

1. `.harness/design-references.json` 을 읽는다
2. `sources` 배열에 새 항목 추가:
   ```json
   {
     "id": "secondary-flow",
     "label": "사용자가 준 설명",
     "fileUrl": "https://www.figma.com/file/...",
     "role": "secondary"
   }
   ```
3. 파일 저장

### B. 컴포넌트 링크 등록 및 읽기 probe

사용자가 "Button 컴포넌트에 Figma 링크를 붙이고 싶다"고 할 때:

1. 코드 경로를 물어본다 (예: `src/design-system/atoms/Button/Button.tsx`)
2. 디자인 참조 URL 또는 이미지를 물어본다
3. **즉시 읽기 시도** (ds-add.md의 "c) 참조 읽기 시도"와 동일):
   - **Figma URL** → 사용자 MCP로 design context/screenshot
   - **이미지** → fetch/open 확인
   - **기타 URL** → 지원 불가 알림, Figma 노드 또는 스크린샷 요청
4. **읽기 결과에 따라 기록**:
   - **성공** → `ref` (또는 `figma`) + `status: 'linked'` + `lastReadAt` + `lastReadOk: true`
   - **실패** → `status: 'needed'` (또는 `'waived'` 사용자 선택 시) + `lastReadAt` + `lastReadOk: false` + `readError`
   
   예시 (성공):
   ```json
   {
     "id": "atom-button",
     "kind": "atom",
     "codePath": "src/design-system/atoms/Button/Button.tsx",
     "ref": {
       "kind": "figma",
       "url": "https://www.figma.com/file/abc123?node-id=456",
       "nodeId": "456",
       "label": "Primary Button"
     },
     "status": "linked",
     "lastReadAt": "2026-09-16T02:49:00Z",
     "lastReadOk": true
   }
   ```
   
   **올바른 노드 필요**: `implement` 모드에서 정확한 구현을 위해 **올바른 화면/컴포넌트 노드**가
   필요하다. 잘못된 노드(상위 페이지, 다른 variant)를 링크하면 구현이 어긋난다.
   이미 잘못 링크한 경우 `status: 'waived'` 로 변경하거나 올바른 URL로 재링크한다.

### C. 페이지 URL에서 일괄 시드 (선택)

사용자가 Figma 페이지 전체 URL을 주고 "이 화면을 만들 거야"라고 하면:

1. 화면을 보고 필요한 컴포넌트 목록을 추정한다 (사용자 확인 필요)
2. 각 컴포넌트를 `entries`에 `status: needed` 로 추가:
   ```json
   {
     "id": "page-login",
     "kind": "page",
     "codePath": "src/pages/LoginPage.tsx",
     "figma": {
       "url": "주어진 페이지 URL"
     },
     "status": "needed",
     "notes": "작업 예정"
   }
   ```
3. `/ds-add` 실행 시 이 목록을 보고 미리 준비할 수 있다

## 규칙

- `id`는 유니크해야 함 (중복 시 기존 항목 업데이트)
- `kind`: atom, molecule, organism, layout, page, flow, token 중 하나
- `ref.kind`: 
  - `figma` — Figma/FigJam URL, MCP로 읽기 가능
  - `image` — 이미지 파일 (png/jpg/webp/gif), fetch/open 가능
  - `unsupported` — 기타 URL (Notion, Drive 등), 믿을 수 있는 match 불가
- `status`: 
  - `linked` — **성공적으로 읽은** 참조 있음 (`lastReadOk: true`). `implement` 모드 UI 작업 허용.
  - `needed` — 링크는 있지만 아직 읽지 않았거나 읽기 실패 (작업 예정). `inspire`는 허용, `implement`는 불가.
  - `inspire-only` — 영감용 (정확히 따르지 않음)
  - `waived` — 참조 없이 진행하기로 명시적 선택. `inspire`/`implement` 모두 허용.
  - `broken` — 링크가 깨짐 (파일 삭제·권한 변경 등)
- `lastReadOk`: 
  - `true` — 마지막 읽기 성공, `linked` 상태와 함께
  - `false` — 마지막 읽기 실패, `readError` 참조
  - `undefined` — 아직 읽기 시도 안 함
- **성공 후에만** `status: 'linked'` + `lastReadOk: true`. 실패한 시도는 fake `linked`로 남기지 않음.
- `layoutStatus` (선택, page 항목만): 진행 상황 메모용 — `scaffolded` / `filled`.
  **사람이 진행 상황을 보기 위한 기록일 뿐이며, 어떤 체크도 이 필드를 근거로 판단하지 않는다.**
  layout-first 판정은 항상 페이지 파일 안의 `data-slot` 유무로 한다 — 파일이 정본이고,
  이 필드는 갱신을 잊으면 실제와 어긋날 수 있기 때문이다.

## 출력

변경 후 반드시:
1. `.harness/design-references.json` 파일을 저장한다
2. 변경 내역을 사용자에게 요약해 보여준다

## 에이전트 재질문 (dual entry)

만약 `.harness/design-references.json` 이 없거나, `mode`가 설정되지 않았다면:
- "이 프로젝트는 어떤 작업을 하나요? (free/inspire/implement)"
- "디자인 참조 파일(Figma URL)이 있나요?"
- 면책 조항 확인

CLI 프롬프트와 동일한 질문을 에이전트 채팅에서 다시 물어 설정을 완성한다.
