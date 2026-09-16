#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * storybook-check.mjs — Storybook 온디맨드 설치 전 UI 작업 차단
 *
 * design-system 모듈이 활성화되고 storybook이 `pending` 또는 `ready` 상태일 때,
 * `.storybook/` 디렉터리가 없으면서 새로운 UI 페이지나 디자인시스템 컴포넌트를
 * 추가하려는 경우 커밋을 차단한다.
 *
 * 목적: 에이전트가 `/ds-init` 없이 UI 작업을 시작하는 것을 방지
 */
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(gatesDir, '..', '..')
const configPath = path.resolve(gatesDir, '..', 'config.json')
const storybookDir = path.resolve(projectRoot, '.storybook')

// 1. config.json 확인
if (!existsSync(configPath)) {
    console.log('⊘ .harness/config.json 없음 — storybook-check 건너뜀')
    process.exit(0)
}

const config = JSON.parse(readFileSync(configPath, 'utf-8'))

// 2. design-system 모듈이 없으면 체크하지 않음
// (config에는 modules 배열이 직접 없고, checks만 있을 수 있으므로 storybook 필드로 판단)
const storybookState = config.storybook

// storybook이 off이거나 필드가 없으면 체크하지 않음
if (!storybookState || storybookState === 'off') {
    process.exit(0)
}

// 3. .storybook/ 디렉터리 존재 확인
if (existsSync(storybookDir)) {
    // 이미 설치되어 있으면 통과
    process.exit(0)
}

// 4. storybook이 pending 또는 ready인데 .storybook/이 없는 상태
// ready인데 없으면 깨진 상태
if (storybookState === 'ready') {
    console.error(`
✗ storybook-check 실패

.harness/config.json 에 storybook: "ready" 로 되어 있지만 .storybook/ 디렉터리가 없습니다.
이는 설정 불일치입니다.

해결 방법:
1. /ds-init 워크플로를 실행해 Storybook을 설치하거나
2. .harness/config.json 의 storybook 을 "pending" 또는 "off" 로 변경하세요
`)
    process.exit(1)
}

// 5. pending 상태: staged된 새 UI 파일이 있는지 확인
let stagedFiles = []
try {
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

// 6. UI 페이지 파일 패턴
const PAGE_PATTERNS = [
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
]

const newPageFiles = stagedFiles.filter((file) =>
    PAGE_PATTERNS.some((pattern) => pattern.test(file))
)

// 7. 디자인시스템 컴포넌트 패턴 (스토리 파일 제외)
const DS_COMPONENT_PATTERN = /^src\/design-system\/.*\.(tsx?|jsx?)$/
const STORY_PATTERN = /\.stories\.(tsx?|jsx?)$/

const newDsComponents = stagedFiles.filter(
    (file) => DS_COMPONENT_PATTERN.test(file) && !STORY_PATTERN.test(file)
)

// 8. 새 UI 파일이 있으면 실패
if (newPageFiles.length > 0 || newDsComponents.length > 0) {
    let errorMsg = `✗ storybook-check 실패

Storybook 상태가 'pending' (설치 예정)인데 .storybook/ 디렉터리가 없습니다.
새로운 UI 작업을 시작하기 전에 먼저 Storybook을 설치해야 합니다.

`

    if (newPageFiles.length > 0) {
        errorMsg += `새 페이지 파일:\n`
        errorMsg += newPageFiles.map((f) => `  - ${f}`).join('\n') + '\n\n'
    }

    if (newDsComponents.length > 0) {
        errorMsg += `새 디자인시스템 컴포넌트:\n`
        errorMsg += newDsComponents.map((f) => `  - ${f}`).join('\n') + '\n\n'
    }

    errorMsg += `해결 방법:
1. /ds-init 워크플로를 먼저 실행해 Storybook을 설치하세요
   → 설치 후 .harness/config.json 의 storybook 이 "ready" 로 변경됩니다
2. Storybook을 사용하지 않으려면 .harness/config.json 의 storybook 을 "off" 로 변경하세요

이 게이트는 에이전트가 Storybook 없이 UI 컴포넌트를 만드는 것을 방지합니다.
`

    console.error(errorMsg)
    process.exit(1)
}

// 모두 통과
console.log(`✓ storybook-check 통과 (storybook: ${storybookState}, .storybook/ 없음, 새 UI 파일 없음)`)
process.exit(0)
