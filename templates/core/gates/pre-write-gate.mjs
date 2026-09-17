#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * pre-write-gate.mjs — Write/StrReplace/Edit/ApplyPatch 도구 사용 시점 검증
 *
 * Cursor의 preToolUse 훅으로 실행되어 UI 파일 쓰기 전에 다음을 체크한다:
 * 1. Storybook: pending/ready 상태인데 .storybook/ 없으면 deny
 * 2. Design ref: inspire/implement 모드에서 페이지 쓸 때 design-references.json 항목 필요
 *
 * 사용: pre-write-gate.mjs <cursor|claude>  (훅 입력 JSON은 stdin)
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
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
    // 입력을 못 읽으면 판단 불가 — 무관한 도구 호출을 막지 않도록 허용
    respond('allow')
}

// tool_name이 있으면 Write/StrReplace/Edit/ApplyPatch만 체크
if (input.tool_name) {
    const writeTools = ['Write', 'StrReplace', 'Edit', 'ApplyPatch']
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

// 3. Stories pair 체크 (Storybook ready + 새 DS 컴포넌트)
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
