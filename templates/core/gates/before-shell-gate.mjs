#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * before-shell-gate.mjs — Shell 명령 실행 전 검증 (Shell bypass 차단)
 *
 * Cursor의 beforeShellExecution 훅으로 실행되어 shell 리다이렉트/heredoc을 통한
 * UI 파일 쓰기를 차단한다.
 *
 * 감지 대상:
 * - `> path` / `>> path` — 리다이렉트
 * - `tee path` — tee 명령
 * - `cat << EOF > path` / `printf "..." > path` — heredoc/printf 리다이렉트
 *
 * 허용:
 * - npm install / npm ci / package manager 명령
 * - git 명령
 * - 일반 빌드/테스트 명령
 * - non-UI 경로 쓰기
 *
 * 사용: before-shell-gate.mjs <cursor|claude>  (훅 입력 JSON은 stdin)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    isUiFile,
    isDesignSystemComponent,
    findProjectRoot,
    checkStorybookPrereq,
    checkDesignRefPrereq,
    checkStoriesPair,
} from './ui-prereq-check.mjs'

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
    // 입력을 못 읽으면 판단 불가 — 조용히 허용
    respond('allow')
}

// 명령 추출
const command = input.tool_input?.command || input.command || ''
if (!command) {
    respond('allow')
}

// 안전 명령 패턴 — package manager, git, 기본 shell 명령 (리다이렉트 없을 때만)
const SAFE_COMMANDS_NO_CHECK = [
    /^npm\s+(install|ci|run|test|start|build)/,
    /^pnpm\s+(install|run|test|start|build)/,
    /^yarn\s+(install|run|test|start|build)/,
    /^bun\s+(install|run|test|start|build)/,
    /^git\s+/,
    /^cd\s+/,
    /^ls\s+/,
    /^mkdir\s+/,
]

// node/npx/bunx는 UI write 패턴이 없을 때만 허용 (writeFileSync 우회 차단)
const UI_WRITE_KEYWORDS = [
    'writeFileSync',
    'outputFileSync',
    'src/pages/',
    'src/routes/',
    'src/app/',
    'Page.tsx',
    'Page.jsx',
    'design-system/atoms',
    'design-system/molecules',
    'design-system/organisms',
    'src/components/',
]

// 안전 명령은 리다이렉트 검사 없이 바로 허용
if (SAFE_COMMANDS_NO_CHECK.some((p) => p.test(command))) {
    respond('allow')
}

// node/npx/pnpx/bunx는 UI write 패턴이 있으면 deny (코드 안의 writeFileSync 등은 파싱 불가)
if (/^(node|npx|pnpx|bunx)\s+/.test(command)) {
    const hasUiWriteKeyword = UI_WRITE_KEYWORDS.some((kw) => command.includes(kw))
    if (hasUiWriteKeyword) {
        // writeFileSync 등 UI write 키워드가 명령에 포함되어 있으면 deny
        // (실제 파일 경로를 정확히 파싱할 수 없으므로 보수적으로 차단)
        respond(
            'deny',
            'Shell 명령에서 UI 파일 쓰기를 감지했습니다. Write/StrReplace 도구를 사용하세요.',
            '⚠️ node/npx 명령에 writeFileSync 또는 UI 경로 키워드가 포함되어 있어 차단되었습니다. UI 파일은 Write/StrReplace 도구를 사용하여 작성하세요.',
        )
    }
    respond('allow')
}

// 리다이렉트/heredoc/tee 패턴 감지
const WRITE_PATTERNS = [
    // > file / >> file
    /(?:^|\s)(>|>>)\s*([^\s;|&]+)/g,
    // tee file
    /\btee\s+([^\s;|&]+)/g,
    // cat << EOF > file / printf "..." > file
    /(?:cat\s*<<|printf\s+[^>]+)\s*>\s*([^\s;|&]+)/g,
]

const extractPaths = (cmd) => {
    const paths = []
    for (const pattern of WRITE_PATTERNS) {
        let match
        while ((match = pattern.exec(cmd)) !== null) {
            // match[1]이 리다이렉트 연산자(>/>>) 또는 path, match[2]는 path (있으면)
            const pathArg = match[2] || match[1]
            if (pathArg && !pathArg.match(/^[>&|]/)) {
                paths.push(pathArg)
            }
        }
    }
    return paths
}

const targetPaths = extractPaths(command)
if (targetPaths.length === 0) {
    // 쓰기 명령 없음 — 허용
    respond('allow')
}

// 프로젝트 루트 찾기 (현재 작업 디렉토리 기준)
const cwd = input.tool_input?.cwd || input.cwd || process.cwd()
const projectRoot = findProjectRoot(cwd)
if (!projectRoot) {
    // 하네스 없는 프로젝트 — 허용
    respond('allow')
}

const configPath = path.join(projectRoot, '.harness', 'config.json')
let config = {}
try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'))
} catch {
    respond('allow')
}

// 각 쓰기 대상 경로가 UI 파일인지 체크
for (const targetPath of targetPaths) {
    const absPath = path.resolve(cwd, targetPath)
    const relPath = path.relative(projectRoot, absPath)

    // .harness/ 경로는 허용
    if (relPath.startsWith('.harness/')) {
        continue
    }

    // UI 파일인지 체크
    if (!isUiFile(relPath)) {
        continue
    }

    // UI 파일로 쓰려고 함 — Storybook + Design ref + Stories pair 체크
    const storybookCheck = checkStorybookPrereq(projectRoot, config)
    if (storybookCheck.deny) {
        respond('deny', storybookCheck.userMsg, storybookCheck.agentMsg)
    }

    const designRefCheck = checkDesignRefPrereq(projectRoot, config, relPath)
    if (designRefCheck.deny) {
        respond('deny', designRefCheck.userMsg, designRefCheck.agentMsg)
    }

    // Stories pair 체크 (DS 컴포넌트만, shell로 새 파일 쓰는 경우)
    if (isDesignSystemComponent(relPath)) {
        const absPath = path.resolve(cwd, targetPath)
        const isNewFile = !existsSync(absPath)
        
        const storiesCheck = checkStoriesPair(projectRoot, config, relPath, isNewFile)
        if (storiesCheck.deny) {
            respond('deny', storiesCheck.userMsg, storiesCheck.agentMsg)
        }
    }
}

// 모든 체크 통과
respond('allow')
