#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * pre-write-gate.mjs — Write/StrReplace/Edit 도구 사용 시점 검증
 *
 * Cursor의 preToolUse 훅으로 실행되어 UI 파일 쓰기 전에 다음을 체크한다:
 * 1. Storybook: pending/ready 상태인데 .storybook/ 없으면 deny
 * 2. Design ref: inspire/implement 모드에서 페이지 쓸 때 design-references.json 항목 필요
 *
 * 사용: pre-write-gate.mjs <cursor|claude>  (훅 입력 JSON은 stdin)
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tool = process.argv[2] === 'claude' ? 'claude' : 'cursor'
const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const harnessRoot = path.resolve(gatesDir, '..')

const respond = (decision, userMsg, agentMsg) => {
    if (tool === 'claude') {
        console.log(
            JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: decision,
                    permissionDecisionReason: userMsg ?? agentMsg ?? '',
                },
            }),
        )
    } else {
        console.log(
            JSON.stringify(
                decision === 'deny'
                    ? { permission: 'deny', user_message: userMsg, agent_message: agentMsg }
                    : { permission: 'allow' },
            ),
        )
    }
    process.exit(0)
}

// stdin에서 훅 입력 읽기
let input = {}
try {
    const raw = readFileSync(0, 'utf-8')
    input = raw.trim() ? JSON.parse(raw) : {}
} catch {
    // 입력을 못 읽으면 판단 불가 — 무관한 도구 호출을 막지 않도록 허용
    respond('allow')
}

// 프로젝트 루트 찾기
const findProjectRoot = (startPath) => {
    let current = startPath
    while (current !== path.dirname(current)) {
        if (existsSync(path.join(current, '.harness', 'config.json'))) {
            return current
        }
        current = path.dirname(current)
    }
    return null
}

// 파일 경로 추출 (도구마다 다른 필드명 대응)
const extractFilePath = (input) => {
    const toolInput = tool === 'claude' ? input.tool_input : input
    if (!toolInput) return null
    
    // Write: path 또는 file_path
    // StrReplace: path
    // Edit: path 또는 file_path
    return toolInput.path || toolInput.file_path || null
}

const filePath = extractFilePath(input)
if (!filePath) {
    // 파일 경로를 추출할 수 없으면 판단 불가 — 허용
    respond('allow')
}

// 프로젝트 루트 확인
const projectRoot = findProjectRoot(path.dirname(path.resolve(filePath)))
if (!projectRoot) {
    // .harness/config.json 이 없으면 하네스가 설치되지 않은 프로젝트 — 허용
    respond('allow')
}

const configPath = path.join(projectRoot, '.harness', 'config.json')
const designRefsPath = path.join(projectRoot, '.harness', 'design-references.json')
const storybookDir = path.join(projectRoot, '.storybook')

// config.json 읽기
let config = {}
try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
} catch {
    respond('allow')
}

// 상대 경로로 정규화
const relPath = path.relative(projectRoot, path.resolve(filePath))

// .harness/ 관련 파일은 항상 허용 (무한 루프 방지)
if (relPath.startsWith('.harness/')) {
    respond('allow')
}

// UI 파일인지 판단
const UI_PATTERNS = [
    // 페이지/라우트
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
    // 디자인시스템 컴포넌트 (stories/tokens/_story-template 제외)
    /^src\/design-system\/(atoms|molecules|organisms)\/.*\.tsx?$/,
]

const isUiFile = UI_PATTERNS.some((pattern) => pattern.test(relPath))
if (!isUiFile) {
    // UI 파일이 아니면 허용
    respond('allow')
}

// stories/tokens/_story-template 제외
if (
    relPath.includes('.stories.') ||
    relPath.includes('_story-template') ||
    relPath.includes('/tokens.')
) {
    respond('allow')
}

// 1. Storybook 체크
const storybookState = config.storybook
if (storybookState === 'pending' || storybookState === 'ready') {
    if (!existsSync(storybookDir)) {
        respond(
            'deny',
            'Storybook이 설치되지 않았습니다. /ds-init 워크플로를 먼저 실행하거나 .harness/config.json에서 storybook을 "off"로 변경하세요.',
            '⚠️ UI 파일을 작성하기 전에 /ds-init을 실행하여 Storybook을 설치하거나, 사용자에게 Storybook을 사용하지 않을지 확인하세요. (config.storybook: "pending|ready" 이지만 .storybook/ 폴더가 없습니다.)',
        )
    }
}

// 2. Design ref 체크 (페이지 파일만)
const mode = config.mode
if (mode === 'inspire' || mode === 'implement') {
    const PAGE_PATTERNS = [
        /^src\/pages\/.*\.(tsx?|jsx?)$/,
        /^src\/routes\/.*\.(tsx?|jsx?)$/,
        /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
        /^src\/.*Page\.(tsx?|jsx?)$/,
    ]

    const isPageFile = PAGE_PATTERNS.some((pattern) => pattern.test(relPath))
    if (isPageFile) {
        // design-references.json 존재 확인
        if (!existsSync(designRefsPath)) {
            respond(
                'deny',
                `디자인 참조 맵이 없습니다. 모드가 '${mode}'이므로 .harness/design-references.json이 필요합니다.`,
                `⚠️ 모드가 '${mode}'인데 design-references.json이 없습니다. 하네스 설정을 다시 실행하세요.`,
            )
        }

        // design-references.json 읽기
        let designRefs = {}
        try {
            designRefs = JSON.parse(readFileSync(designRefsPath, 'utf-8'))
        } catch {
            respond(
                'deny',
                'design-references.json을 읽을 수 없습니다.',
                '⚠️ design-references.json 파일이 손상되었습니다.',
            )
        }

        const entries = designRefs.entries || []
        
        // 현재 파일에 대한 항목 찾기
        const entry = entries.find((e) => {
            if (e.codePath === relPath) return true
            const entryFileName = path.basename(e.codePath)
            const pageFileName = path.basename(relPath)
            return entryFileName === pageFileName
        })

        if (!entry) {
            // 항목이 없음
            respond(
                'deny',
                `이 화면(${relPath})의 디자인 참조가 design-references.json에 없습니다. 먼저 사용자에게 물어보세요: "이 화면에 참고할 피그마 디자인이나 스크린샷이 있나요?"`,
                `⚠️ 페이지/화면 파일을 작성하기 전에 디자인 참조를 먼저 물어보고 design-references.json에 기록해야 합니다.\n\n질문: "이 화면(${path.basename(relPath)})에 참고할 피그마 디자인이나 스크린샷이 있나요? (있음 / 없음 / 나중에)"\n\n- 있음: URL/이미지를 받아 즉시 읽기 시도 → 성공 시 linked 저장, 실패 시 다른 참조 요청\n- 없음: waived로 기록하고 진행 OK\n- 나중에: needed로 기록 (inspire: 진행 OK, implement: waived 또는 링크 필요)`,
            )
        }

        // inspire 모드: linked / waived / needed 허용, 단 linked는 lastReadOk 체크
        if (mode === 'inspire') {
            if (entry.status === 'linked' && entry.lastReadOk === false) {
                respond(
                    'deny',
                    `${relPath}의 디자인 참조 읽기가 실패했습니다 (lastReadOk: false). 다른 Figma 노드 URL이나 스크린샷을 제공하거나, 명시적으로 waived로 변경하세요.`,
                    `⚠️ 디자인 참조(${entry.ref?.url || entry.figma?.url || '?'})를 읽을 수 없습니다.\n에러: ${entry.readError || '없음'}\n\n다른 Figma 노드 URL이나 스크린샷을 사용자에게 요청하거나, 사용자가 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
                )
            }
            // linked(성공) / waived / needed 모두 통과
        }

        // implement 모드: linked(성공) 또는 waived만 허용
        if (mode === 'implement') {
            if (entry.status === 'waived') {
                // 명시적 waived는 허용
            } else if (entry.status === 'linked') {
                // lastReadOk 체크
                if (entry.lastReadOk === false) {
                    respond(
                        'deny',
                        `${relPath}의 디자인 참조 읽기가 실패했습니다. implement 모드에서는 읽기 성공한 참조 또는 명시적 waived만 허용됩니다.`,
                        `⚠️ implement 모드: 디자인 참조(${entry.ref?.url || entry.figma?.url || '?'})를 읽을 수 없습니다.\n에러: ${entry.readError || '없음'}\n\n다른 Figma 노드 URL이나 스크린샷을 사용자에게 요청하거나, 사용자가 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
                    )
                }
                // lastReadOk가 true 또는 undefined면 통과 (하위 호환)
            } else if (entry.status === 'needed') {
                // needed는 불충분
                respond(
                    'deny',
                    `${relPath}는 needed 상태입니다. implement 모드에서는 디자인 참조를 지금 제공하거나 명시적으로 waived를 선택해야 합니다.`,
                    `⚠️ implement 모드: 페이지가 'needed' 상태입니다. 사용자에게 디자인 참조를 지금 제공하도록 요청하거나, 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
                )
            } else {
                // 기타 상태는 불허
                respond(
                    'deny',
                    `${relPath}의 디자인 참조 상태(${entry.status})가 부적절합니다. implement 모드는 linked(읽기 성공) 또는 waived가 필요합니다.`,
                    `⚠️ implement 모드: 디자인 참조 상태가 '${entry.status}'입니다. linked(lastReadOk: true) 또는 waived가 필요합니다.`,
                )
            }
        }
    }
}

// 모든 체크 통과
respond('allow')
