#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * storybook-check.mjs — Storybook 온디맨드 설치 전 UI 작업 차단 + Stories pairing 강제
 *
 * Part 1: Storybook pending 상태에서 .storybook/ 없이 UI 작업 차단
 * Part 2: Storybook ready 상태에서 새 DS 컴포넌트는 stories 필수
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
const storybookState = config.storybook

// 2. storybook이 off이거나 필드가 없으면 체크하지 않음
if (!storybookState || storybookState === 'off') {
    process.exit(0)
}

const storybookExists = existsSync(storybookDir)

// 3. .storybook/ 없음 — Part 1 (pending/ready 분기)
if (!storybookExists) {
    // ready인데 .storybook/ 없음 → 설정 불일치
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

    // pending 상태: staged된 새 UI 파일이 있는지 확인
    let stagedFiles = []
    try {
        const output = execSync('git diff --cached --name-only --diff-filter=A', {
            cwd: projectRoot,
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
        stagedFiles = output ? output.split('\n') : []
    } catch {
        // git이 없거나 초기 커밋 전이면 통과
        process.exit(0)
    }

    // UI 페이지 파일 패턴
    const PAGE_PATTERNS = [
        /^src\/pages\/.*\.(tsx?|jsx?)$/,
        /^src\/routes\/.*\.(tsx?|jsx?)$/,
        /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
        /^src\/.*Page\.(tsx?|jsx?)$/,
    ]

    const newPageFiles = stagedFiles.filter((file) =>
        PAGE_PATTERNS.some((pattern) => pattern.test(file))
    )

    // 디자인시스템 컴포넌트 패턴 (스토리 파일 제외)
    const DS_COMPONENT_PATTERN = /^src\/design-system\/.*\.(tsx?|jsx?)$/
    const STORY_PATTERN = /\.stories\.(tsx?|jsx?)$/

    const newDsComponents = stagedFiles.filter(
        (file) => DS_COMPONENT_PATTERN.test(file) && !STORY_PATTERN.test(file)
    )

    // 새 UI 파일이 있으면 실패
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

    // pending + .storybook/ 없음 + 새 UI 없음 → 통과
    console.log(`✓ storybook-check 통과 (storybook: ${storybookState}, .storybook/ 없음, 새 UI 파일 없음)`)
    process.exit(0)
}

// ===== Part 2: .storybook/ 존재 + ready 상태 → Stories Pairing 강제 =====

// 4. .storybook/ 있지만 ready가 아니면 통과 (pending에서 막 설치한 경우)
if (storybookState !== 'ready') {
    console.log(`✓ storybook-check 통과 (storybook: ${storybookState}, .storybook/ 있음)`)
    process.exit(0)
}

// 5. ready 상태: staged된 새 DS 컴포넌트는 stories 파일 필요
let stagedFiles = []
try {
    const output = execSync('git diff --cached --name-only --diff-filter=A', {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    stagedFiles = output ? output.split('\n') : []
} catch {
    // git이 없거나 초기 커밋 전이면 통과
    process.exit(0)
}

// 6. 새 DS layer 컴포넌트 필터링 (stories/tokens/Example* 제외)
const DS_LAYER_PATTERN = /^src\/design-system\/(atoms|molecules|organisms)\/.*\.tsx?$/
const EXCLUDE_PATTERNS = [
    /\.stories\./,
    /_story-template/,
    /\/tokens\./,
    /\/Example[A-Z]/,
    /\/index\.ts/,
]

const newDsLayerComponents = stagedFiles.filter((file) => {
    if (!DS_LAYER_PATTERN.test(file)) return false
    if (EXCLUDE_PATTERNS.some((p) => p.test(file))) return false
    return true
})

if (newDsLayerComponents.length === 0) {
    // 새 DS 컴포넌트 없음 → 통과
    console.log(`✓ storybook-check 통과 (storybook: ready, .storybook/ 있음, 새 DS 컴포넌트 없음)`)
    process.exit(0)
}

// 7. 각 새 컴포넌트에 대해 stories 파일 존재 확인
const missingStories = []

for (const componentFile of newDsLayerComponents) {
    const dir = path.dirname(componentFile)
    const ext = path.extname(componentFile)
    const base = path.basename(componentFile, ext)
    const storiesPath = path.join(projectRoot, dir, `${base}.stories.tsx`)
    
    if (!existsSync(storiesPath)) {
        missingStories.push({ componentFile, storiesPath: `${dir}/${base}.stories.tsx` })
    }
}

// 8. Stories 누락 시 실패
if (missingStories.length > 0) {
    let errorMsg = `✗ storybook-check 실패 (Stories pairing)

Storybook ready 상태: 새 design-system 컴포넌트는 반드시 stories 파일과 함께 커밋해야 합니다.

누락된 stories 파일:\n`

    for (const { componentFile, storiesPath } of missingStories) {
        errorMsg += `\n  컴포넌트: ${componentFile}\n`
        errorMsg += `  필요한 stories: ${storiesPath}\n`
    }

    errorMsg += `\n해결 방법:
1. /ds-add 워크플로에서 컴포넌트와 stories를 함께 작성하세요
2. 각 컴포넌트 옆에 <Name>.stories.tsx 파일을 추가하세요
   (src/design-system/_story-template.tsx 참고)

이 게이트는 Storybook ready 상태에서 stories 없는 컴포넌트가 누적되는 것을 방지합니다.
`

    console.error(errorMsg)
    process.exit(1)
}

// 9. 모든 체크 통과
console.log(`✓ storybook-check 통과 (stories pairing OK, ${newDsLayerComponents.length}개 컴포넌트)`)
process.exit(0)
