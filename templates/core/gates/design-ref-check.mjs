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

// 5. 각 새 페이지 파일이 적절한 디자인 참조 상태를 가지는지 확인
const missingEntries = []
const invalidEntries = [] // implement 모드에서 needed-only 또는 lastReadOk false

for (const pageFile of newPageFiles) {
    // codePath가 정확히 일치하거나, 파일명 기반으로 매칭 시도
    const entry = entries.find((e) => {
        if (e.codePath === pageFile) return true
        const entryFileName = path.basename(e.codePath)
        const pageFileName = path.basename(pageFile)
        return entryFileName === pageFileName
    })

    if (!entry) {
        missingEntries.push(pageFile)
        continue
    }

    // inspire 모드: linked / waived / needed 중 하나면 통과
    if (mode === 'inspire') {
        const validStatuses = ['linked', 'waived', 'needed']
        if (!validStatuses.includes(entry.status)) {
            invalidEntries.push({ file: pageFile, reason: `상태가 '${entry.status}'임 (inspire 모드는 linked/waived/needed 필요)` })
        }
        continue
    }

    // implement 모드: 더 엄격한 검증
    if (mode === 'implement') {
        // waived는 명시적 선택이므로 항상 허용
        if (entry.status === 'waived') {
            continue
        }

        // linked 상태는 lastReadOk 확인
        if (entry.status === 'linked') {
            // lastReadOk 필드가 있고 false면 실패
            if (entry.lastReadOk === false) {
                invalidEntries.push({ 
                    file: pageFile, 
                    reason: `linked이지만 lastReadOk: false (읽기 실패). 다른 참조 제공 또는 waive 필요. 에러: ${entry.readError || '없음'}` 
                })
            }
            // lastReadOk가 true 또는 undefined(하위 호환)면 통과
            continue
        }

        // needed는 불충분 — 지금 제공하거나 waive 필요
        if (entry.status === 'needed') {
            invalidEntries.push({ 
                file: pageFile, 
                reason: `needed 상태 (구현 전 디자인 참조 필요). 참조를 지금 제공하거나 명시적으로 waive 선택` 
            })
            continue
        }

        // 기타 상태는 불허
        invalidEntries.push({ file: pageFile, reason: `상태가 '${entry.status}'임 (implement 모드는 linked+성공 또는 waived 필요)` })
    }
}

// 6. 실패 시 명확한 메시지 출력
const hasMissing = missingEntries.length > 0
const hasInvalid = invalidEntries.length > 0

if (hasMissing || hasInvalid) {
    const modeKo = mode === 'implement' ? '구현' : '영감'
    let errorMsg = `✗ design-ref-check 실패 (${mode} 모드)\n`

    if (hasMissing) {
        errorMsg += `\n다음 새 페이지 파일이 .harness/design-references.json 에 없습니다:\n\n`
        errorMsg += missingEntries.map((f) => `  - ${f}`).join('\n') + '\n'
    }

    if (hasInvalid) {
        errorMsg += `\n다음 페이지 파일의 디자인 참조 상태가 부적절합니다:\n\n`
        errorMsg += invalidEntries.map((e) => `  - ${e.file}\n    이유: ${e.reason}`).join('\n') + '\n'
    }

    errorMsg += `\n'${mode}' 모드 정책:\n`
    if (mode === 'inspire') {
        errorMsg += `- 새 화면/페이지는 linked (성공적으로 읽음) / waived (명시적 skip) / needed (나중에) 중 하나 필요\n`
        errorMsg += `- 읽기 실패 시 다른 참조 제공 또는 waive 허용\n`
    } else if (mode === 'implement') {
        errorMsg += `- 새 화면/페이지는 linked (성공적으로 읽음, lastReadOk: true) 또는 waived (명시적 skip) 필요\n`
        errorMsg += `- needed 만으로는 불충분 — 참조를 지금 제공하거나 waive\n`
        errorMsg += `- 읽기 실패 (lastReadOk: false) 시 UI 작업 불가 — 다른 참조 또는 waive\n`
    }

    errorMsg += `\n해결 방법:\n`
    errorMsg += `1. /ds-add 워크플로에서 화면 시작 시 디자인 참조 물어봄 → 즉시 읽기 시도 → 성공 시 linked 기록\n`
    errorMsg += `2. /ds-ref 워크플로로 수동 등록 및 읽기 probe\n`
    errorMsg += `3. 디자인 참조 없이 진행하려면 status: 'waived' 명시\n`
    errorMsg += `\n예시 (waived):\n`
    errorMsg += `{\n`
    errorMsg += `  "id": "page-login",\n`
    errorMsg += `  "kind": "page",\n`
    errorMsg += `  "codePath": "src/pages/LoginPage.tsx",\n`
    errorMsg += `  "status": "waived",\n`
    errorMsg += `  "notes": "디자인 없이 자유 구현"\n`
    errorMsg += `}\n`
    errorMsg += `\n예시 (linked, 성공):\n`
    errorMsg += `{\n`
    errorMsg += `  "id": "page-login",\n`
    errorMsg += `  "kind": "page",\n`
    errorMsg += `  "codePath": "src/pages/LoginPage.tsx",\n`
    errorMsg += `  "ref": { "kind": "figma", "url": "https://figma.com/...", "nodeId": "123" },\n`
    errorMsg += `  "status": "linked",\n`
    errorMsg += `  "lastReadAt": "2026-09-16T02:49:00Z",\n`
    errorMsg += `  "lastReadOk": true\n`
    errorMsg += `}\n`

    console.error(errorMsg)
    process.exit(1)
}

// 모두 통과
console.log(`✓ design-ref-check 통과 (${newPageFiles.length}개 페이지 파일 확인됨, ${mode} 모드)`)
process.exit(0)
