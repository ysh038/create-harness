import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// 빌드 산출물을 테스트한다 (npm run check 가 build → test 순서를 보장)
import { writeActions } from '../dist/manifest.js'
import { buildChecks, buildPlan } from '../dist/registry.js'
import type { IDetectResult, IScaffoldOptions } from '../src/types.js'

const fakeDetect = (overrides: Partial<IDetectResult> = {}): IDetectResult => ({
    targetDir: '/tmp/fake',
    hasPackageJson: true,
    projectName: 'sample-app',
    packageManager: 'npm',
    isReact: true,
    isVite: true,
    isTypeScript: true,
    scripts: {
        dev: 'vite',
        build: 'tsc -b && vite build',
        lint: 'eslint .',
        test: 'vitest',
    },
    existingAgentFiles: [],
    ...overrides,
})

const fullOptions = (targetDir: string): IScaffoldOptions => ({
    targetDir,
    preset: 'react-fe',
    agents: ['cursor', 'claude'],
    modules: ['design-system', 'auth-http', 'data-fetching', 'lint'],
    dryRun: false,
    yes: true,
    install: false,
})

describe('buildPlan', () => {
    it('생성 트리가 스냅샷과 일치한다 (전체 모듈, cursor+claude)', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        expect(plan.map((action) => action.dest).sort()).toMatchSnapshot()
    })

    it('모든 산출물에 미치환 템플릿 변수({{...}})가 남지 않는다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        for (const action of plan) {
            expect(action.content, action.dest).not.toMatch(/\{\{[A-Z0-9_]+\}\}/)
        }
    })

    it('cursor 규칙 mdc는 frontmatter(globs)를 유지한다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const arch = plan.find(
            (action) => action.dest === '.cursor/rules/10-architecture.mdc',
        )
        expect(arch).toBeDefined()
        expect(arch!.content).toMatch(/^---\n[\s\S]*globs: src\/\*\*/)
    })

    it('claude 스킬 design-system 은 ds-init과 ds-add 두 흐름을 포함한다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const skill = plan.find(
            (action) => action.dest === '.claude/skills/design-system/SKILL.md',
        )
        expect(skill!.content).toContain('ds-init')
        expect(skill!.content).toContain('ds-add')
    })

    it('cursor 미선택 시 규칙은 docs/conventions/ 로 간다', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            agents: ['claude'],
        })
        const dests = plan.map((action) => action.dest)
        expect(dests).toContain('docs/conventions/10-architecture.md')
        expect(dests.some((dest) => dest.startsWith('.cursor/'))).toBe(false)
    })
})

describe('buildChecks', () => {
    it('대상 scripts에 실제 존재하는 체크만, 빠른 실패 순서로 담는다', () => {
        const checks = buildChecks(fakeDetect(), fullOptions('/tmp/fake'))
        expect(checks.map((check) => check.id)).toEqual([
            'typecheck',
            'lint',
            'stylelint',
            'test',
            'build',
        ])
        // typecheck 스크립트가 없으면 tsc 직접 실행으로 폴백
        expect(checks[0].command).toBe('npx tsc --noEmit')
        // vitest watch 기본값이면 --run 을 붙인다
        expect(checks.find((check) => check.id === 'test')!.command).toBe(
            'npm run test -- --run',
        )
    })

    it('스크립트가 없으면 해당 체크를 넣지 않는다', () => {
        const checks = buildChecks(
            fakeDetect({ scripts: {}, isTypeScript: false }),
            { ...fullOptions('/tmp/fake'), modules: [] },
        )
        expect(checks).toEqual([])
    })
})

describe('writeActions 충돌 처리', () => {
    let tmp: string

    afterEach(() => {
        if (tmp) rmSync(tmp, { recursive: true, force: true })
    })

    it('내용이 다른 기존 파일은 덮어쓰지 않고 .harness/incoming/ 에 둔다', () => {
        tmp = mkdtempSync(path.join(tmpdir(), 'harness-test-'))
        writeFileSync(path.join(tmp, 'AGENTS.md'), '# 기존 내용\n')

        const plan = buildPlan(fakeDetect(), fullOptions(tmp))
        const results = writeActions(plan, tmp, false)

        const agents = results.find((result) => result.dest === 'AGENTS.md')
        expect(agents!.placedInIncoming).toBe(true)
        expect(readFileSync(path.join(tmp, 'AGENTS.md'), 'utf-8')).toBe(
            '# 기존 내용\n',
        )
        // .incoming 접미사 — 대상 프로젝트의 tsc·eslint가 집어들지 않는다
        expect(
            existsSync(path.join(tmp, '.harness/incoming/AGENTS.md.incoming')),
        ).toBe(true)
    })

    it('재실행 시 동일 내용 파일은 충돌로 처리하지 않는다 (멱등성)', () => {
        tmp = mkdtempSync(path.join(tmpdir(), 'harness-test-'))
        const plan = buildPlan(fakeDetect(), fullOptions(tmp))
        writeActions(plan, tmp, false)
        const second = writeActions(plan, tmp, false)
        expect(second.every((result) => !result.placedInIncoming)).toBe(true)
    })
})

describe('npm 패키지 경계', () => {
    it('tarball에 하네스 내부 기록(TODO.md·DECISIONS.md)과 test/ 가 새지 않는다', () => {
        const raw = execSync('npm pack --dry-run --json', {
            cwd: path.resolve(__dirname, '..'),
            encoding: 'utf-8',
            // npm이 stderr에 진행 로그를 찍어도 JSON(stdout)만 취한다
            stdio: ['ignore', 'pipe', 'ignore'],
        })
        const [info] = JSON.parse(raw) as [{ files: { path: string }[] }]
        const paths = info.files.map((file) => file.path)

        expect(paths).not.toContain('TODO.md')
        expect(paths).not.toContain('DECISIONS.md')
        expect(paths.some((filePath) => filePath.startsWith('test/'))).toBe(false)
        expect(paths.some((filePath) => filePath.startsWith('src/'))).toBe(false)

        // 있어야 하는 것
        expect(paths.some((filePath) => filePath.startsWith('dist/'))).toBe(true)
        expect(
            paths.some((filePath) => filePath.startsWith('templates/')),
        ).toBe(true)
    }, 30000)
})
