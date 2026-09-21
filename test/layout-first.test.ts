import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * Layout-first 체크 테스트 (0.6.0)
 *
 * implement 모드 + linked 참조 페이지는 data-slot 뼈대를 먼저 저장한 뒤
 * 컴포넌트로 채워야 한다. 뼈대 없이 알맹이를 쓰면 deny.
 */

let testDir = ''
let writeGateScript = ''
let shellGateScript = ''

const copyGate = (name: string): string => {
    const src = path.join(process.cwd(), 'templates', 'core', 'gates', name)
    const dest = path.join(testDir, '.harness', 'gates', name)
    execSync(`cp "${src}" "${dest}"`)
    return dest
}

beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), 'harness-layout-test-'))
    mkdirSync(path.join(testDir, '.harness', 'gates'), { recursive: true })
    mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

    copyGate('ui-prereq-check.mjs')
    writeGateScript = copyGate('pre-write-gate.mjs')
    shellGateScript = copyGate('before-shell-gate.mjs')
})

afterEach(() => {
    if (testDir) {
        rmSync(testDir, { recursive: true, force: true })
    }
})

interface ICursorResult {
    permission: string
    user_message?: string
    agent_message?: string
}

interface IClaudeResult {
    hookSpecificOutput: {
        permissionDecision: string
        permissionDecisionReason: string
    }
}

const runScript = <T>(script: string, input: object, tool: string): T => {
    const inputJson = JSON.stringify(input)
    try {
        const output = execSync(`node "${script}" ${tool}`, {
            encoding: 'utf-8',
            cwd: testDir,
            input: inputJson,
        })
        return JSON.parse(output.trim()) as T
    } catch (error: any) {
        if (error.stdout) {
            return JSON.parse(error.stdout.trim()) as T
        }
        throw error
    }
}

const runGate = (input: object): ICursorResult =>
    runScript<ICursorResult>(writeGateScript, input, 'cursor')

const runGateClaude = (input: object): IClaudeResult =>
    runScript<IClaudeResult>(writeGateScript, input, 'claude')

const runShellGate = (command: string): ICursorResult =>
    runScript<ICursorResult>(
        shellGateScript,
        { tool_input: { command, cwd: testDir }, command, cwd: testDir },
        'cursor',
    )

/** implement + linked 참조 + Storybook off 로 기본 세팅 */
const setupImplementProject = (
    overrides: { mode?: string; status?: string } = {},
): void => {
    writeFileSync(
        path.join(testDir, '.harness', 'config.json'),
        JSON.stringify({ storybook: 'off', mode: overrides.mode ?? 'implement' }),
    )
    writeFileSync(
        path.join(testDir, '.harness', 'design-references.json'),
        JSON.stringify({
            version: 1,
            mode: overrides.mode ?? 'implement',
            entries: [
                {
                    id: 'page-office-detail',
                    kind: 'page',
                    codePath: 'src/pages/OfficeDetailPage.tsx',
                    ref: { kind: 'figma', url: 'https://figma.com/file/abc?node-id=1' },
                    status: overrides.status ?? 'linked',
                    lastReadOk: true,
                },
            ],
        }),
    )
}

const pagePath = (): string => path.join(testDir, 'src', 'pages', 'OfficeDetailPage.tsx')

const writePage = (contents: string): void => {
    writeFileSync(pagePath(), contents)
}

const SCAFFOLD = [
    'import styles from "./OfficeDetailPage.module.css"',
    'export function OfficeDetailPage() {',
    '    return (',
    '        <main className={styles.page}>',
    '            <section data-slot="header" className={styles.header} />',
    '            <section data-slot="reviews" className={styles.reviews} />',
    '        </main>',
    '    )',
    '}',
].join('\n')

const FILLED = [
    'import { ReviewList } from "../components/Review/ReviewList"',
    'export function OfficeDetailPage() {',
    '    return <main><ReviewList /></main>',
    '}',
].join('\n')

describe('checkLayoutScaffold — 차단', () => {
    it('뼈대 없는 페이지에 도메인 컴포넌트를 쓰면 deny', () => {
        setupImplementProject()

        const result = runGate({
            tool_name: 'Write',
            tool_input: { path: pagePath(), contents: FILLED },
        })

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('data-slot')
    })

    it('design-system molecule import도 알맹이로 본다', () => {
        setupImplementProject()

        const result = runGate({
            tool_name: 'Write',
            tool_input: {
                path: pagePath(),
                contents: 'import { SearchField } from "../design-system/molecules/SearchField"',
            },
        })

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('data-slot')
    })

    it('Edit(new_string)로 알맹이를 채워도 deny', () => {
        setupImplementProject()
        writePage('export function OfficeDetailPage() { return <main /> }')

        const result = runGate({
            tool_name: 'Edit',
            tool_input: {
                file_path: pagePath(),
                old_string: '<main />',
                new_string: 'import { ReviewList } from "../components/Review/ReviewList"',
            },
        })

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('data-slot')
    })

    it('MultiEdit(edits[])도 deny', () => {
        setupImplementProject()
        writePage('export function OfficeDetailPage() { return <main /> }')

        const result = runGate({
            tool_name: 'MultiEdit',
            tool_input: {
                file_path: pagePath(),
                edits: [
                    { old_string: 'a', new_string: 'const a = 1' },
                    {
                        old_string: 'b',
                        new_string: 'import { ReviewList } from "../components/Review/ReviewList"',
                    },
                ],
            },
        })

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('data-slot')
    })

    it('shell heredoc으로 페이지를 써도 deny', () => {
        setupImplementProject()

        const result = runShellGate(
            'cat > src/pages/OfficeDetailPage.tsx << EOF\nimport { ReviewList } from "../components/Review/ReviewList"\nEOF',
        )

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('data-slot')
    })

    it('Claude 형식에서는 에이전트용 안내 메시지가 전달된다', () => {
        setupImplementProject()

        const result = runGateClaude({
            tool_name: 'Write',
            tool_input: { file_path: pagePath(), content: FILLED },
        })

        expect(result.hookSpecificOutput.permissionDecision).toBe('deny')
        // 사용자용 짧은 사유가 아니라 다음 행동이 담긴 안내가 와야 한다
        expect(result.hookSpecificOutput.permissionDecisionReason).toContain('Layout scaffold')
    })
})

describe('checkLayoutScaffold — 통과', () => {
    it('뼈대만 쓰는 것은 허용', () => {
        setupImplementProject()

        const result = runGate({
            tool_name: 'Write',
            tool_input: { path: pagePath(), contents: SCAFFOLD },
        })

        expect(result.permission).toBe('allow')
    })

    it('레이아웃 atom import는 뼈대 단계에서도 허용', () => {
        setupImplementProject()

        const result = runGate({
            tool_name: 'Write',
            tool_input: {
                path: pagePath(),
                contents: `import { Stack } from "../design-system/atoms/Stack"\n${SCAFFOLD}`,
            },
        })

        expect(result.permission).toBe('allow')
    })

    it('뼈대가 저장된 페이지는 채우기 허용', () => {
        setupImplementProject()
        writePage(SCAFFOLD)

        const result = runGate({
            tool_name: 'Edit',
            tool_input: {
                file_path: pagePath(),
                old_string: '<section data-slot="reviews" className={styles.reviews} />',
                new_string:
                    'import { ReviewList } from "../components/Review/ReviewList"\n<section data-slot="reviews"><ReviewList /></section>',
            },
        })

        expect(result.permission).toBe('allow')
    })

    it('이미 알맹이가 들어 있는 기존 페이지는 허용 (brownfield)', () => {
        setupImplementProject()
        writePage(FILLED)

        const result = runGate({
            tool_name: 'Edit',
            tool_input: {
                file_path: pagePath(),
                old_string: '<ReviewList />',
                new_string: 'import { ReviewCard } from "../components/Review/ReviewCard"',
            },
        })

        expect(result.permission).toBe('allow')
    })

    it('inspire 모드는 대상이 아니다', () => {
        setupImplementProject({ mode: 'inspire' })

        const result = runGate({
            tool_name: 'Write',
            tool_input: { path: pagePath(), contents: FILLED },
        })

        expect(result.permission).toBe('allow')
    })

    it('free 모드는 대상이 아니다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'off', mode: 'free' }),
        )

        const result = runGate({
            tool_name: 'Write',
            tool_input: { path: pagePath(), contents: FILLED },
        })

        expect(result.permission).toBe('allow')
    })

    it('waived 참조 페이지는 대상이 아니다', () => {
        setupImplementProject({ status: 'waived' })

        const result = runGate({
            tool_name: 'Write',
            tool_input: { path: pagePath(), contents: FILLED },
        })

        expect(result.permission).toBe('allow')
    })

    it('페이지가 아닌 파일(atom)은 대상이 아니다', () => {
        setupImplementProject()
        mkdirSync(path.join(testDir, 'src', 'design-system', 'atoms', 'Badge'), {
            recursive: true,
        })

        const result = runGate({
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'design-system', 'atoms', 'Badge', 'Badge.tsx'),
                contents: 'import { Icon } from "../../../components/Icon"',
            },
        })

        expect(result.permission).toBe('allow')
    })
})

describe('before-shell-gate.mjs — existsSync 회귀 (0.6.0)', () => {
    it('shell로 design-system 컴포넌트를 쓸 때 ReferenceError가 나지 않는다', () => {
        // stories pair 체크가 existsSync를 호출하는 경로 — 0.5.x에서는 import 누락으로 터졌다
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'ready', mode: 'free' }),
        )
        mkdirSync(path.join(testDir, '.storybook'), { recursive: true })
        mkdirSync(path.join(testDir, 'src', 'design-system', 'atoms', 'Button'), {
            recursive: true,
        })

        const result = runShellGate('cat > src/design-system/atoms/Button/Button.tsx')

        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('stories')
    })
})
