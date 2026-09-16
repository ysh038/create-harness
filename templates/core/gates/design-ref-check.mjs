#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * design-ref-check.mjs — 디자인 참조 맵 강제 검증
 *
 * inspire/implement 모드에서 새로운 페이지/화면 파일이 추가될 때,
 * .harness/design-references.json 에 해당 화면의 항목이 있는지 확인한다.
 * (linked / waived / needed 상태 중 하나면 통과)
 *
 * 커밋 게이트에서 실행되어 에이전트가 디자인 참조를 묻지 않고
 * 바로 UI를 만드는 것을 방지한다.
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(gatesDir, '..', '..')
const configPath = path.resolve(gatesDir, '..', 'config.json')
const designRefsPath = path.resolve(gatesDir, '..', 'design-references.json')

// 1. config.json에서 mode 확인
if (!existsSync(configPath)) {
    console.log('⊘ .harness/config.json 없음 — design-ref-check 건너뜀')
    process.exit(0)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const mode = config.mode

// free 모드는 체크하지 않음
if (mode === 'free') {
    process.exit(0)
}

// 2. design-references.json 파일이 있는지 확인
if (!existsSync(designRefsPath)) {
    console.error(`
✗ design-ref-check 실패

모드가 '${mode}' 인데 .harness/design-references.json 파일이 없습니다.
하네스 설정을 다시 실행하거나 빈 design-references.json 을 생성하세요.
`)
    process.exit(1)
}

// 3. staged 또는 새로 추가된 페이지/라우트 파일 감지
let stagedFiles = []
try {
    // git이 없거나 커밋이 없는 경우를 대비
    const output = execSync('git diff --cached --name-only --diff-filter=A', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    stagedFiles = output ? output.split('\n') : []
} catch {
    // git이 없거나 초기 커밋 전이면 체크 건너뜀
    process.exit(0)
}

// 페이지/라우트로 보이는 파일만 필터 (src/pages, src/routes, 또는 page.tsx 같은 Next.js 패턴)
const PAGE_PATTERNS = [
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
]

const newPageFiles = stagedFiles.filter((file) =>
    PAGE_PATTERNS.some((pattern) => pattern.test(file))
)

if (newPageFiles.length === 0) {
    // 새 페이지 파일이 없으면 통과
    process.exit(0)
}

// 4. design-references.json 읽기
const designRefs = JSON.parse(readFileSync(designRefsPath, 'utf-8'))
const entries = designRefs.entries || []

// 5. 각 새 페이지 파일이 design-references.json 에 있는지 확인
const missingEntries = []

for (const pageFile of newPageFiles) {
    // codePath가 정확히 일치하거나, 파일명 기반으로 매칭 시도
    const hasEntry = entries.some((entry) => {
        if (entry.codePath === pageFile) return true
        // 파일명만으로 매칭 (경로가 다를 수 있으므로)
        const entryFileName = path.basename(entry.codePath)
        const pageFileName = path.basename(pageFile)
        return entryFileName === pageFileName
    })

    if (!hasEntry) {
        missingEntries.push(pageFile)
    }
}

// 6. 실패 시 명확한 메시지 출력
if (missingEntries.length > 0) {
    const modeKo = mode === 'implement' ? '구현' : '영감'
    console.error(`
✗ design-ref-check 실패 (${mode} 모드)

다음 새 페이지 파일이 .harness/design-references.json 에 없습니다:

${missingEntries.map((f) => `  - ${f}`).join('\n')}

'${mode}' 모드에서는 새 화면/페이지를 만들기 전에 디자인 참조를 기록해야 합니다.

해결 방법:
1. /ds-ref 워크플로를 실행하여 디자인 링크를 등록하거나
2. design-references.json 에 수동으로 항목 추가 (status: linked/waived/needed)
3. 또는 디자인 참조 없이 진행하려면 status: 'waived' 로 기록

예시:
{
  "id": "page-login",
  "kind": "page",
  "codePath": "src/pages/LoginPage.tsx",
  "status": "waived",
  "notes": "디자인 없이 자유 구현"
}
`)
    process.exit(1)
}

// 모두 통과
console.log(`✓ design-ref-check 통과 (${newPageFiles.length}개 페이지 파일 확인됨)`)
process.exit(0)
