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

### B. 컴포넌트 링크 등록

사용자가 "Button 컴포넌트에 Figma 링크를 붙이고 싶다"고 할 때:

1. 코드 경로를 물어본다 (예: `src/design-system/atoms/Button/Button.tsx`)
2. Figma URL을 물어본다 (전체 URL 또는 노드 ID만)
3. `entries` 배열에 항목 추가 또는 업데이트:
   ```json
   {
     "id": "atom-button",
     "kind": "atom",
     "codePath": "src/design-system/atoms/Button/Button.tsx",
     "figma": {
       "url": "https://www.figma.com/file/abc123?node-id=456",
       "nodeId": "456",
       "label": "Primary Button"
     },
     "status": "linked"
   }
   ```

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
- `status`: 
  - `linked` — Figma 링크 있고 코드 존재
  - `needed` — 링크는 있지만 코드 아직 없음 (작업 예정)
  - `inspire-only` — 영감용 (정확히 따르지 않음)
  - `waived` — 링크 없이 진행하기로 함
  - `broken` — 링크가 깨짐 (파일 삭제·권한 변경 등)

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
