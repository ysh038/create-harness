import { execSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

/**
 * pre-write-gate.mjs 단위 테스트
 * 
 * Cursor preToolUse 입력 형식 검증:
 * { tool_name: "Write", tool_input: { path: "..." } }
 */

let testDir = ''
let gateScript = ''

beforeEach(() => {
    // 임시 테스트 프로젝트 디렉토리 생성
    testDir = mkdtempSync(path.join(tmpdir(), 'harness-gate-test-'))
    
    // .harness 디렉토리 및 config.json 생성
    mkdirSync(path.join(testDir, '.harness', 'gates'), { recursive: true })
    
    // gate 스크립트 복사
    const srcGate = path.join(process.cwd(), 'templates', 'core', 'gates', 'pre-write-gate.mjs')
    gateScript = path.join(testDir, '.harness', 'gates', 'pre-write-gate.mjs')
    execSync(`cp "${srcGate}" "${gateScript}"`)
    
    // 공유 체크 모듈 복사 (v0.5.5에서 추가)
    const srcCheck = path.join(process.cwd(), 'templates', 'core', 'gates', 'ui-prereq-check.mjs')
    const destCheck = path.join(testDir, '.harness', 'gates', 'ui-prereq-check.mjs')
    execSync(`cp "${srcCheck}" "${destCheck}"`)
})

afterEach(() => {
    if (testDir) {
        rmSync(testDir, { recursive: true, force: true })
    }
})

const runGate = (input: object, tool = 'cursor'): { permission: string; user_message?: string; agent_message?: string } => {
    // stdin 으로 직접 넘긴다 — 셸 echo 는 입력에 작은따옴표가 들어가면 깨진다
    try {
        const output = execSync(`node "${gateScript}" ${tool}`, {
            encoding: 'utf-8',
            cwd: testDir,
            input: JSON.stringify(input),
        })
        return JSON.parse(output.trim())
    } catch (error: any) {
        // exit 0이어도 stdout에 JSON이 있으면 성공
        if (error.stdout) {
            return JSON.parse(error.stdout.trim())
        }
        throw error
    }
}

describe('before-shell-gate.mjs — Shell bypass 차단', () => {
    let shellGateScript = ''

    beforeEach(() => {
        const srcShellGate = path.join(process.cwd(), 'templates', 'core', 'gates', 'before-shell-gate.mjs')
        shellGateScript = path.join(testDir, '.harness', 'gates', 'before-shell-gate.mjs')
        execSync(`cp "${srcShellGate}" "${shellGateScript}"`)
        
        // ui-prereq-check.mjs는 이미 beforeEach에서 복사됨
    })

    const runShellGate = (command: string, tool = 'cursor'): { permission: string; user_message?: string; agent_message?: string } => {
        const input = { tool_input: { command, cwd: testDir }, command, cwd: testDir }
        try {
            const output = execSync(`node "${shellGateScript}" ${tool}`, {
                encoding: 'utf-8',
                cwd: testDir,
                input: JSON.stringify(input),
            })
            return JSON.parse(output.trim())
        } catch (error: any) {
            if (error.stdout) {
                return JSON.parse(error.stdout.trim())
            }
            throw error
        }
    }

    it('npm install은 허용', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        const result = runShellGate('npm install')
        expect(result.permission).toBe('allow')
    })

    it('cat > src/pages/LoginPage.tsx는 storybook pending일 때 deny', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        // 상대 경로 사용 (cwd가 testDir로 설정됨)
        const result = runShellGate('cat > src/pages/LoginPage.tsx')
        
        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('/ds-init')
    })

    it('node -e writeFileSync(...pages/...)는 storybook pending일 때 deny', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        // JSON escaping을 위해 백슬래시 제거하고 간단한 형태로
        const result = runShellGate('node -e fs.writeFileSync src/pages/LoginPage.tsx content')
        
        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('Write/Edit')
    })

    it('git commit은 허용 (pre-commit-gate가 별도 실행)', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        const result = runShellGate('git commit -m "test"')
        expect(result.permission).toBe('allow')
    })

    it('node script.js (UI write 키워드 없음)는 허용', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        const result = runShellGate('node scripts/build.js')
        expect(result.permission).toBe('allow')
    })
})

describe('pre-write-gate.mjs — Cursor 입력 형식', () => {
    it('Cursor Write 도구 형식을 올바르게 파싱한다', () => {
        // config: storybook pending, .storybook 없음
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        // src/pages 디렉토리 생성
        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        // Cursor preToolUse 입력 형식
        const cursorInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'pages', 'LoginPage.tsx'),
                contents: 'export const LoginPage = () => <div>Login</div>'
            }
        }

        const result = runGate(cursorInput, 'cursor')
        
        // Storybook이 pending인데 .storybook이 없으므로 deny되어야 함
        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('/ds-init')
    })

    it('implement 모드에서 design-references.json 항목 없으면 deny', () => {
        // config: implement 모드
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'off', mode: 'implement' }, null, 2)
        )

        // 빈 design-references.json
        writeFileSync(
            path.join(testDir, '.harness', 'design-references.json'),
            JSON.stringify({ version: 1, mode: 'implement', entries: [] }, null, 2)
        )

        // src/pages 디렉토리 생성
        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        const cursorInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'pages', 'LoginPage.tsx'),
                contents: 'export const LoginPage = () => <div>Login</div>'
            }
        }

        const result = runGate(cursorInput, 'cursor')
        
        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('디자인 참조')
        expect(result.agent_message).toContain('물어보')
    })

    it('Shell 도구는 체크하지 않고 허용한다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        const shellInput = {
            tool_name: 'Shell',
            tool_input: {
                command: 'npm install'
            }
        }

        const result = runGate(shellInput, 'cursor')
        expect(result.permission).toBe('allow')
    })

    it('Read 도구는 체크하지 않고 허용한다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'implement' }, null, 2)
        )

        const readInput = {
            tool_name: 'Read',
            tool_input: {
                path: path.join(testDir, 'src', 'pages', 'LoginPage.tsx')
            }
        }

        const result = runGate(readInput, 'cursor')
        expect(result.permission).toBe('allow')
    })

    it('non-UI 파일은 허용한다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'implement' }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'utils'), { recursive: true })

        const utilInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'utils', 'helper.ts'),
                contents: 'export const helper = () => {}'
            }
        }

        const result = runGate(utilInput, 'cursor')
        expect(result.permission).toBe('allow')
    })

    it('.harness/ 파일은 항상 허용한다 (무한 루프 방지)', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'implement' }, null, 2)
        )

        const harnessInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, '.harness', 'design-references.json'),
                contents: '{}'
            }
        }

        const result = runGate(harnessInput, 'cursor')
        expect(result.permission).toBe('allow')
    })

    it('design-system 컴포넌트 작성 시 Storybook 체크', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'ready', mode: 'free' }, null, 2)
        )

        // .storybook 디렉토리 없음
        mkdirSync(path.join(testDir, 'src', 'design-system', 'atoms', 'Button'), { recursive: true })

        const dsInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'design-system', 'atoms', 'Button', 'Button.tsx'),
                contents: 'export const Button = () => <button />'
            }
        }

        const result = runGate(dsInput, 'cursor')
        expect(result.permission).toBe('deny')
        expect(result.agent_message).toContain('Storybook')
    })

    it('stories 파일은 체크하지 않는다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'design-system', 'atoms', 'Button'), { recursive: true })

        const storyInput = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'design-system', 'atoms', 'Button', 'Button.stories.tsx'),
                contents: 'export default { title: "Button" }'
            }
        }

        const result = runGate(storyInput, 'cursor')
        expect(result.permission).toBe('allow')
    })

    it('StrReplace 도구도 체크한다', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'pending', mode: 'free' }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        const replaceInput = {
            tool_name: 'StrReplace',
            tool_input: {
                path: path.join(testDir, 'src', 'pages', 'HomePage.tsx'),
                old_string: 'old',
                new_string: 'new'
            }
        }

        const result = runGate(replaceInput, 'cursor')
        expect(result.permission).toBe('deny')
    })

    it('waived 상태 페이지는 implement 모드에서 허용', () => {
        writeFileSync(
            path.join(testDir, '.harness', 'config.json'),
            JSON.stringify({ storybook: 'off', mode: 'implement' }, null, 2)
        )

        writeFileSync(
            path.join(testDir, '.harness', 'design-references.json'),
            JSON.stringify({
                version: 1,
                mode: 'implement',
                entries: [{
                    id: 'page-login',
                    kind: 'page',
                    codePath: 'src/pages/LoginPage.tsx',
                    status: 'waived',
                    notes: '디자인 없이 자유 구현'
                }]
            }, null, 2)
        )

        mkdirSync(path.join(testDir, 'src', 'pages'), { recursive: true })

        const input = {
            tool_name: 'Write',
            tool_input: {
                path: path.join(testDir, 'src', 'pages', 'LoginPage.tsx'),
                contents: 'export const LoginPage = () => <div>Login</div>'
            }
        }

        const result = runGate(input, 'cursor')
        expect(result.permission).toBe('allow')
    })
})
