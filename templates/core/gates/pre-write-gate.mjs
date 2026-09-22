#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * pre-write-gate.mjs — Write/StrReplace/Edit/ApplyPatch 도구 사용 시점 검증
 *
 * Cursor의 preToolUse 훅으로 실행되어 UI 파일 쓰기 전에 다음을 체크한다:
 * 1. Storybook: pending/ready 상태인데 .storybook/ 없으면 deny
 * 2. Design ref: inspire/implement 모드에서 페이지 쓸 때 design-references.json 항목 필요
 * 3. Layout-first: implement 모드에서 뼈대(data-slot) 없는 페이지에 알맹이 쓰기 차단 (0.6.0)
 * 4. 페이지 인라인 스타일: design-system이 있으면 페이지에 style={{}} 추가 차단 (0.7.0)
 * 5. Stories pair: Storybook ready 시 새 DS 컴포넌트는 stories 필요
 *
 * 사용: pre-write-gate.mjs <cursor|claude>  (훅 입력 JSON은 stdin)
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
    isUiFile,
    isDesignSystemComponent,
    findProjectRoot,
    checkStorybookPrereq,
    checkDesignRefPrereq,
    checkStoriesPair,
    checkLayoutScaffold,
    checkPageInlineStyle,
} from './ui-prereq-check.mjs'

const tool = process.argv[2] === 'claude' ? 'claude' : 'cursor'
const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const harnessRoot = path.resolve(gatesDir, '..')

const respond = (decision, userMsg, agentMsg) => {
    if (tool === 'claude') {
        // 통과 시에는 아무것도 출력하지 않는다 — 명시적 'allow'는 사용자의 권한 확인을
        // 건너뛰게 만든다. 출력이 없으면 Claude Code의 원래 권한 흐름을 그대로 따른다. (0.7.0)
        if (decision === 'allow') process.exit(0)
        console.log(
            JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: decision,
                    // Claude Code는 이 문자열을 에이전트에게 전달한다 — 다음 행동 안내가 담긴
                    // agentMsg를 우선한다. 없을 때만 사용자용 짧은 사유로 대체한다.
                    permissionDecisionReason: agentMsg ?? userMsg ?? '',
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

// tool_name이 있으면 Write/StrReplace/Edit/ApplyPatch만 체크
if (input.tool_name) {
    const writeTools = ['Write', 'StrReplace', 'Edit', 'MultiEdit', 'ApplyPatch']
    if (!writeTools.includes(input.tool_name)) {
        // Shell, Read 등 다른 도구는 허용
        respond('allow')
    }
}

// 파일 경로 추출 (도구마다 다른 필드명 대응)
// Cursor: { tool_name: "Write", tool_input: { path: "..." } }
// Claude: { tool_input: { command: "..." } } (for Bash) or tool_input with path
const extractFilePath = (input) => {
    // tool_input이 있으면 우선 사용 (Cursor와 Claude 공통)
    const toolInput = input.tool_input ?? input
    if (!toolInput) return null
    
    // Write: path 또는 file_path
    // StrReplace: path
    // Edit: path 또는 file_path 또는 target_file
    return toolInput.path || toolInput.file_path || toolInput.target_file || null
}

// 이번 쓰기로 들어갈 텍스트 추출 (layout-first 판정용)
// Write: content(Claude) / contents(Cursor), Edit·StrReplace: new_string, MultiEdit: edits[].new_string
const extractIncomingText = (input) => {
    const toolInput = input.tool_input ?? input
    if (!toolInput) return ''
    if (typeof toolInput.content === 'string') return toolInput.content
    if (typeof toolInput.contents === 'string') return toolInput.contents
    if (typeof toolInput.new_string === 'string') return toolInput.new_string
    if (Array.isArray(toolInput.edits)) {
        return toolInput.edits.map((e) => e?.new_string ?? '').join('\n')
    }
    // 알 수 없는 형식 (ApplyPatch 등) — 전체를 보수적으로 검사
    return JSON.stringify(toolInput)
}

// 이번 쓰기로 사라질 텍스트 추출 (인라인 스타일 증감 판정용, 0.7.0)
// Edit·StrReplace: old_string, MultiEdit: edits[].old_string, Write: 기존 파일 전체
const extractReplacedText = (input, absPath) => {
    const toolInput = input.tool_input ?? input
    if (typeof toolInput?.old_string === 'string') return toolInput.old_string
    if (Array.isArray(toolInput?.edits)) {
        return toolInput.edits.map((e) => e?.old_string ?? '').join('\n')
    }
    return existsSync(absPath) ? readFileSync(absPath, 'utf-8') : ''
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
if (!isUiFile(relPath)) {
    respond('allow')
}

// 1. Storybook 체크
const storybookCheck = checkStorybookPrereq(projectRoot, config)
if (storybookCheck.deny) {
    respond('deny', storybookCheck.userMsg, storybookCheck.agentMsg)
}

// 2. Design ref 체크 (페이지 파일만)
const designRefCheck = checkDesignRefPrereq(projectRoot, config, relPath)
if (designRefCheck.deny) {
    respond('deny', designRefCheck.userMsg, designRefCheck.agentMsg)
}

// 3. Layout-first 체크 (implement 모드 페이지만)
const layoutCheck = checkLayoutScaffold(projectRoot, config, relPath, extractIncomingText(input))
if (layoutCheck.deny) {
    respond('deny', layoutCheck.userMsg, layoutCheck.agentMsg)
}

// 4. 페이지 인라인 스타일 체크 (0.7.0)
const inlineStyleCheck = checkPageInlineStyle(
    projectRoot,
    relPath,
    extractIncomingText(input),
    extractReplacedText(input, path.resolve(filePath)),
)
if (inlineStyleCheck.deny) {
    respond('deny', inlineStyleCheck.userMsg, inlineStyleCheck.agentMsg)
}

// 5. Stories pair 체크 (Storybook ready + 새 DS 컴포넌트)
if (isDesignSystemComponent(relPath)) {
    // Write로 새 파일 생성 중 (기존 파일 없음 → 새 파일)
    const absPath = path.resolve(filePath)
    const isNewFile = !existsSync(absPath)
    
    const storiesCheck = checkStoriesPair(projectRoot, config, relPath, isNewFile)
    if (storiesCheck.deny) {
        respond('deny', storiesCheck.userMsg, storiesCheck.agentMsg)
    }
}

// 모든 체크 통과
respond('allow')
