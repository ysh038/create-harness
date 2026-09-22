import { execFileSync, execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
// @ts-expect-error — 템플릿 .mjs 는 타입 선언이 없다
import * as structure from '../templates/core/gates/structure-check.mjs'
// @ts-expect-error — 템플릿 .mjs 는 타입 선언이 없다
import { countInlineStyles } from '../templates/core/gates/ui-prereq-check.mjs'

/**
 * 구조 흐트러짐 점검 테스트 (0.7.0)
 *  - 쓰기 시점: 페이지 인라인 스타일 추가 거부
 *  - 커밋 시점: 페이지 비대화·atom 비대화·부품 중복 경고
 *  - 훅 출력 형식: Claude 통과 시 무출력, 경고는 additionalContext/systemMessage, Cursor는 ask
 */

const OPTIONS = structure.DEFAULT_STRUCTURE_OPTIONS

let testDir = ''
const gatesSrc = path.join(process.cwd(), 'templates', 'core', 'gates')

const copyGate = (name: string): string => {
    const dest = path.join(testDir, '.harness', 'gates', name)
    execSync(`cp "${path.join(gatesSrc, name)}" "${dest}"`)
    return dest
}

const write = (relPath: string, contents: string): void => {
    const abs = path.join(testDir, relPath)
    mkdirSync(path.dirname(abs), { recursive: true })
    writeFileSync(abs, contents)
}

const runHook = (script: string, input: object, tool: string): string =>
    execSync(`node "${script}" ${tool}`, {
        encoding: 'utf-8',
        cwd: testDir,
        input: JSON.stringify(input),
    }).trim()

beforeEach(() => {
    testDir = mkdtempSync(path.join(tmpdir(), 'harness-structure-test-'))
    mkdirSync(path.join(testDir, '.harness', 'gates'), { recursive: true })
    mkdirSync(path.join(testDir, 'src', 'design-system', 'atoms'), { recursive: true })
    write('.harness/config.json', JSON.stringify({ storybook: 'off', mode: 'free', checks: [] }))
})

afterEach(() => {
    if (testDir) rmSync(testDir, { recursive: true, force: true })
})

// ─── 쓰기 시점: 페이지 인라인 스타일 ─────────────────────────────

describe('countInlineStyles', () => {
    it('style={{...}} 를 센다', () => {
        expect(countInlineStyles('<div style={{ color: "red" }} /><p style={{ margin: 0 }} />')).toBe(2)
    })

    it('CSS 변수만 넘기는 경우는 세지 않는다', () => {
        expect(countInlineStyles(`<div style={{ '--progress': value }} />`)).toBe(0)
    })

    it('className 이나 style={변수} 는 세지 않는다', () => {
        expect(countInlineStyles('<div className={styles.box} style={computed} />')).toBe(0)
    })
})

describe('pre-write-gate.mjs — 페이지 인라인 스타일', () => {
    let gate = ''
    beforeEach(() => {
        copyGate('ui-prereq-check.mjs')
        gate = copyGate('pre-write-gate.mjs')
    })

    const pagePath = (): string => path.join(testDir, 'src', 'pages', 'HomePage.tsx')

    it('design-system이 있는 프로젝트에서 페이지에 인라인 스타일을 추가하면 deny', () => {
        write('src/pages/HomePage.tsx', 'export function HomePage() { return <main /> }')

        const out = JSON.parse(
            runHook(gate, {
                tool_name: 'Edit',
                tool_input: {
                    path: pagePath(),
                    old_string: '<main />',
                    new_string: '<main><div style={{ color: "red" }}>안내</div></main>',
                },
            }, 'cursor'),
        )

        expect(out.permission).toBe('deny')
        expect(out.agent_message).toContain('인라인 스타일')
    })

    it('기존 인라인 스타일을 유지하는 수정은 허용 (개수가 늘지 않음)', () => {
        write('src/pages/HomePage.tsx', '<div style={{ color: "red" }}>a</div>')

        const out = JSON.parse(
            runHook(gate, {
                tool_name: 'Edit',
                tool_input: {
                    path: pagePath(),
                    old_string: '<div style={{ color: "red" }}>a</div>',
                    new_string: '<div style={{ color: "red" }}>b</div>',
                },
            }, 'cursor'),
        )

        expect(out.permission).toBe('allow')
    })

    it('design-system이 없는 프로젝트는 대상이 아니다', () => {
        rmSync(path.join(testDir, 'src', 'design-system'), { recursive: true })
        write('src/pages/HomePage.tsx', '')

        const out = JSON.parse(
            runHook(gate, {
                tool_name: 'Write',
                tool_input: { path: pagePath(), contents: '<div style={{ color: "red" }} />' },
            }, 'cursor'),
        )

        expect(out.permission).toBe('allow')
    })

    it('Claude 형식에서 통과 시 아무것도 출력하지 않는다 (권한 확인을 건너뛰지 않음)', () => {
        const out = runHook(gate, {
            tool_name: 'Write',
            tool_input: { file_path: path.join(testDir, 'src', 'utils', 'a.ts'), content: 'x' },
        }, 'claude')

        expect(out).toBe('')
    })
})

describe('before-shell-gate.mjs — 페이지 인라인 스타일', () => {
    it('셸 heredoc으로 인라인 스타일이 든 페이지를 쓰면 deny', () => {
        copyGate('ui-prereq-check.mjs')
        const gate = copyGate('before-shell-gate.mjs')
        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })
        const command = 'cat > src/pages/HomePage.tsx << EOF\n<div style={{ color: "red" }} />\nEOF'

        const out = JSON.parse(runHook(gate, { command, cwd: testDir }, 'cursor'))

        expect(out.permission).toBe('deny')
        expect(out.agent_message).toContain('인라인 스타일')
    })

    it('Claude 형식에서 무관한 명령은 아무것도 출력하지 않는다', () => {
        copyGate('ui-prereq-check.mjs')
        const gate = copyGate('before-shell-gate.mjs')

        expect(runHook(gate, { tool_input: { command: 'ls -la' } }, 'claude')).toBe('')
    })
})

// ─── 커밋 시점 분석 함수 ──────────────────────────────────────────

describe('analyzePageDrift', () => {
    it('원시 컨트롤이 하나라도 늘면 경고', () => {
        const warnings = structure.analyzePageDrift('src/pages/A.tsx', '<main />', '<main><button>x</button></main>', OPTIONS)
        expect(warnings.join()).toContain('원시 컨트롤')
    })

    it('기본 태그가 기준 이상 늘면 경고', () => {
        const after = '<main><div><p>a</p><span>b</span></div></main>'
        const warnings = structure.analyzePageDrift('src/pages/A.tsx', '<main />', after, OPTIONS)
        expect(warnings.join()).toContain('기본 태그')
    })

    it('레이아웃 시맨틱 태그나 부품 추가는 경고하지 않는다', () => {
        const after = '<main><section data-slot="a"><ReviewList /></section><header /></main>'
        expect(structure.analyzePageDrift('src/pages/A.tsx', '<main />', after, OPTIONS)).toEqual([])
    })

    it('기존에 있던 태그는 세지 않는다 (증가분만)', () => {
        const before = '<div><p>a</p><button /></div>'
        const after = '<div><p>b</p><button /></div>'
        expect(structure.analyzePageDrift('src/pages/A.tsx', before, after, OPTIONS)).toEqual([])
    })
})

describe('analyzePageStyleLines', () => {
    it('꾸밈 속성 추가는 경고', () => {
        const warnings = structure.analyzePageStyleLines('src/pages/A.module.css', ['  color: red;', '  box-shadow: none;'])
        expect(warnings.join()).toContain('color')
        expect(warnings.join()).toContain('box-shadow')
    })

    it('배치 속성만 추가하면 경고 없음', () => {
        expect(structure.analyzePageStyleLines('src/pages/A.module.css', ['  display: grid;', '  gap: var(--space-4);'])).toEqual([])
    })
})

describe('analyzeAtom', () => {
    it('다른 atom을 조합하면 경고', () => {
        const content = 'import { Icon } from "../Icon"\nimport styles from "./Button.module.css"\nexport function Button() {}'
        expect(structure.analyzeAtom('src/design-system/atoms/Button/Button.tsx', content, OPTIONS).join()).toContain('Icon')
    })

    it('props가 기준을 넘으면 경고 (상속·중첩 객체는 하나로)', () => {
        const members = Array.from({ length: 9 }, (_, i) => `    p${i}?: string`).join('\n')
        const content = `interface ButtonProps extends HTMLAttributes {\n${members}\n    meta: { a: string; b: number }\n}`
        expect(structure.countProps(content)).toBe(10)
        expect(structure.analyzeAtom('src/design-system/atoms/Button/Button.tsx', content, OPTIONS).join()).toContain('props가 10개')
    })

    it('작은 atom은 경고 없음', () => {
        const content = 'import styles from "./Badge.module.css"\ninterface BadgeProps {\n    label: string\n}\nexport function Badge() {}'
        expect(structure.analyzeAtom('src/design-system/atoms/Badge/Badge.tsx', content, OPTIONS)).toEqual([])
    })
})

describe('isSimilarComponent', () => {
    const ds = (name: string) => ({ name, relPath: `src/design-system/atoms/${name}/${name}.tsx`, isDesignSystem: true })
    const domain = (name: string) => ({ name, relPath: `src/components/X/${name}.tsx`, isDesignSystem: false })

    it('끝단어가 같은 DS 부품', () => {
        expect(structure.isSimilarComponent('StatusBadge', ds('Badge'))).toBe(true)
    })

    it('끝단어가 동의어인 DS 부품 (StatusTag ↔ Badge)', () => {
        expect(structure.isSimilarComponent('StatusTag', ds('Badge'))).toBe(true)
    })

    it('오타 수준 차이', () => {
        expect(structure.isSimilarComponent('Buton', domain('Button'))).toBe(true)
    })

    it('도메인 부품끼리 끝단어만 같으면 정상 (LoginForm ↔ SignupForm)', () => {
        expect(structure.isSimilarComponent('LoginForm', domain('SignupForm'))).toBe(false)
    })

    it('관계없는 이름', () => {
        expect(structure.isSimilarComponent('Avatar', ds('Badge'))).toBe(false)
    })
})

// ─── 커밋 시점 end-to-end (git + gate.mjs) ───────────────────────

describe('gate.mjs — 커밋 시 구조 경고 전달', () => {
    let gate = ''

    const git = (...args: string[]): void => {
        execFileSync('git', args, { cwd: testDir, stdio: 'ignore' })
    }

    beforeEach(() => {
        gate = copyGate('gate.mjs')
        copyGate('run-checks.mjs')
        copyGate('structure-check.mjs')
        git('init', '-q')
        git('config', 'user.email', 't@t')
        git('config', 'user.name', 't')
        write('src/design-system/atoms/Badge/Badge.tsx', 'export function Badge() {}')
        git('add', '-A')
        git('commit', '-q', '-m', 'init')
    })

    const commitInput = { tool_input: { command: 'git commit -m x' }, command: 'git commit -m x' }

    it('Claude: 경고는 additionalContext + systemMessage, 권한 결정은 비워둔다', () => {
        write('src/components/Order/StatusTag.tsx', 'export function StatusTag() {}')
        git('add', '-A')

        const out = JSON.parse(runHook(gate, commitInput, 'claude'))

        expect(out.hookSpecificOutput.permissionDecision).toBeUndefined()
        expect(out.hookSpecificOutput.additionalContext).toContain('StatusTag')
        expect(out.hookSpecificOutput.additionalContext).toContain('Badge')
        expect(out.systemMessage).toContain('StatusTag')
    })

    it('Cursor: 경고가 있으면 ask 로 사용자에게 보여준다', () => {
        write('src/pages/HomePage.tsx', '<main><button>x</button></main>')
        git('add', '-A')

        const out = JSON.parse(runHook(gate, commitInput, 'cursor'))

        expect(out.permission).toBe('ask')
        expect(out.user_message).toContain('원시 컨트롤')
    })

    it('경고가 없으면 Claude는 무출력, Cursor는 allow', () => {
        write('src/design-system/atoms/Avatar/Avatar.tsx', 'export function Avatar() {}')
        git('add', '-A')

        expect(runHook(gate, commitInput, 'claude')).toBe('')
        expect(JSON.parse(runHook(gate, commitInput, 'cursor')).permission).toBe('allow')
    })

    it('구조 점검 모듈이 없는 설치에서도 커밋 검사가 깨지지 않는다', () => {
        rmSync(path.join(testDir, '.harness', 'gates', 'structure-check.mjs'))
        write('src/components/Order/StatusTag.tsx', 'export function StatusTag() {}')
        git('add', '-A')

        expect(runHook(gate, commitInput, 'claude')).toBe('')
    })

    it('Cursor 거절 메시지는 문서 규격(snake_case) 필드로 보낸다', () => {
        const out = JSON.parse(
            runHook(gate, { command: 'git commit --no-verify -m x' }, 'cursor'),
        )
        expect(out.permission).toBe('deny')
        expect(out.agent_message).toContain('--no-verify')
    })
})

describe('structure-check.mjs — 직접 실행 리포트', () => {
    it('프로젝트 전체를 점검해 세 섹션을 출력한다', () => {
        const script = copyGate('structure-check.mjs')
        write('src/design-system/atoms/Badge/Badge.tsx', 'export function Badge() {}')
        write('src/components/Order/StatusTag.tsx', 'export function StatusTag() {}')
        write('src/pages/HomePage.tsx', '<main><button>x</button></main>')

        const out = execFileSync('node', [script], { cwd: testDir, encoding: 'utf-8' })

        expect(out).toContain('# 구조 점검 리포트')
        expect(out).toContain('StatusTag')
        expect(out).toContain('src/pages/HomePage.tsx: 원시 컨트롤 1개')
    })
})
