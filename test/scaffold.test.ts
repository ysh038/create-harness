import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// 빌드 산출물을 테스트한다 (npm run check 가 build → test 순서를 보장)
import { patchEslintIgnores } from '../dist/eslintPatch.js'
import { writeActions } from '../dist/manifest.js'
import { buildChecks, buildPlan } from '../dist/registry.js'
import { recommendedModules, suggestModules } from '../dist/suggest.js'
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
    hasAxios: true,
    hasReactRouter: true,
    hasTanstackQuery: true,
    hasZustand: true,
    hasTailwind: false,
    hasCssInJs: false,
    hasEslintFlatConfig: true,
    eslintConfigFile: 'eslint.config.js',
    cssFilesWithRawColor: [],
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

describe('suggestModules — 감지 기반 기본 선택값', () => {
    const reasonOf = (detected: IDetectResult, module: string) =>
        suggestModules(detected).find(
            (suggestion) => suggestion.module === module,
        )!

    it('스택이 모두 갖춰지면 4개 모듈 전부 추천한다', () => {
        expect(recommendedModules(fakeDetect())).toEqual([
            'design-system',
            'auth-http',
            'data-fetching',
            'lint',
        ])
    })

    it('Tailwind 프로젝트는 design-system 을 기본에서 뺀다', () => {
        const detected = fakeDetect({ hasTailwind: true })
        expect(recommendedModules(detected)).not.toContain('design-system')
        expect(reasonOf(detected, 'design-system').reason).toContain('Tailwind')
    })

    it('CSS-in-JS 프로젝트도 design-system 을 기본에서 뺀다', () => {
        expect(
            recommendedModules(fakeDetect({ hasCssInJs: true })),
        ).not.toContain('design-system')
    })

    it('axios 가 없으면 auth-http·data-fetching 둘 다 뺀다', () => {
        const detected = fakeDetect({ hasAxios: false })
        const recommended = recommendedModules(detected)
        expect(recommended).not.toContain('auth-http')
        expect(recommended).not.toContain('data-fetching')
        expect(reasonOf(detected, 'auth-http').reason).toContain('axios')
    })

    it('Vite 가 아니면 auth-http 를 뺀다 (import.meta.env 전제)', () => {
        const detected = fakeDetect({ isVite: false })
        expect(recommendedModules(detected)).not.toContain('auth-http')
        expect(reasonOf(detected, 'auth-http').reason).toContain('Vite')
    })

    it('TanStack Query 가 없으면 data-fetching 을 뺀다', () => {
        const detected = fakeDetect({ hasTanstackQuery: false })
        expect(recommendedModules(detected)).not.toContain('data-fetching')
    })

    it('flat config 가 없으면 lint 를 뺀다', () => {
        const detected = fakeDetect({ hasEslintFlatConfig: false })
        expect(recommendedModules(detected)).not.toContain('lint')
        expect(reasonOf(detected, 'lint').reason).toContain('flat config')
    })

    it('비추천이어도 모든 모듈에 판단 근거가 붙는다', () => {
        for (const suggestion of suggestModules(fakeDetect({ hasAxios: false }))) {
            expect(suggestion.reason.length).toBeGreaterThan(0)
        }
    })
})

describe('design-system 모듈을 빼면 관련 산출물이 전부 빠진다', () => {
    const withoutDs = (targetDir: string): IScaffoldOptions => ({
        ...fullOptions(targetDir),
        modules: ['auth-http', 'data-fetching', 'lint'],
    })

    it('규칙·워크플로·스킬·토큰 파일이 하나도 남지 않는다', () => {
        const dests = buildPlan(fakeDetect(), withoutDs('/tmp/fake')).map(
            (action) => action.dest,
        )
        expect(dests).not.toContain('.cursor/rules/30-design-system.mdc')
        expect(dests).not.toContain('.cursor/commands/ds-init.md')
        expect(dests).not.toContain('.cursor/commands/ds-add.md')
        expect(dests).not.toContain('.claude/skills/design-system/SKILL.md')
        expect(dests).not.toContain('src/design-system/tokens.css')
        expect(dests).not.toContain('stylelint.config.js')
        // 나머지 코어는 그대로 있어야 한다
        expect(dests).toContain('.cursor/rules/00-core.mdc')
        expect(dests).toContain('.cursor/commands/spec.md')
    })

    it('AGENTS.md 에 존재하지 않는 커맨드·규칙을 남기지 않는다', () => {
        const plan = buildPlan(fakeDetect(), withoutDs('/tmp/fake'))
        const agents = plan.find((action) => action.dest === 'AGENTS.md')!
        expect(agents.content).not.toContain('/ds-init')
        expect(agents.content).not.toContain('/ds-add')
        expect(agents.content).not.toContain('stylelint')
        expect(agents.content).toContain('/spec')
    })

    it('design-system 을 포함하면 다시 나타난다', () => {
        const dests = buildPlan(fakeDetect(), fullOptions('/tmp/fake')).map(
            (action) => action.dest,
        )
        expect(dests).toContain('.cursor/rules/30-design-system.mdc')
        expect(dests).toContain('.cursor/commands/ds-init.md')
    })
})

describe('stylelint 유예 목록(baseline)', () => {
    const legacy = ['src/a.module.css', 'src/b.module.css']

    it('기존 CSS에 원시값이 있으면 baseline 파일과 overrides 를 만든다', () => {
        const plan = buildPlan(
            fakeDetect({ cssFilesWithRawColor: legacy }),
            fullOptions('/tmp/fake'),
        )
        const baseline = plan.find(
            (action) => action.dest === '.harness/stylelint-baseline.json',
        )
        expect(JSON.parse(baseline!.content)).toEqual(legacy)

        const config = plan.find((action) => action.dest === 'stylelint.config.js')!
        expect(config.content).toContain('overrides')
        expect(config.content).toContain("rules('warning')")
    })

    it('원시값이 없으면 baseline 도 overrides 도 만들지 않는다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        expect(
            plan.some(
                (action) => action.dest === '.harness/stylelint-baseline.json',
            ),
        ).toBe(false)

        const config = plan.find((action) => action.dest === 'stylelint.config.js')!
        expect(config.content).not.toContain('overrides')
        expect(config.content).not.toContain('readFileSync')
    })
})

describe('eslint ignores 자동 패치', () => {
    let tmp: string

    afterEach(() => {
        if (tmp) rmSync(tmp, { recursive: true, force: true })
    })

    const setup = (configSource: string, file = 'eslint.config.js') => {
        tmp = mkdtempSync(path.join(tmpdir(), 'harness-eslint-'))
        writeFileSync(path.join(tmp, file), configSource)
        return fakeDetect({ targetDir: tmp, eslintConfigFile: file })
    }

    it('배열 리터럴 형태에 ignores 를 끼워 넣는다', () => {
        const detected = setup("export default [\n    base,\n]\n")
        expect(patchEslintIgnores(detected, false).status).toBe('patched')

        const patched = readFileSync(path.join(tmp, 'eslint.config.js'), 'utf-8')
        expect(patched).toContain("{ ignores: ['.harness/**'] },")
        // 원래 내용은 그대로 남는다
        expect(patched).toContain('base,')
    })

    it('tseslint.config( 호출 형태도 인식한다', () => {
        const detected = setup('export default tseslint.config(\n    base,\n)\n')
        expect(patchEslintIgnores(detected, false).status).toBe('patched')
        expect(
            readFileSync(path.join(tmp, 'eslint.config.js'), 'utf-8'),
        ).toContain("{ ignores: ['.harness/**'] },")
    })

    it('두 번 돌려도 한 번만 들어간다 (멱등)', () => {
        const detected = setup('export default [\n    base,\n]\n')
        patchEslintIgnores(detected, false)
        expect(patchEslintIgnores(detected, false).status).toBe('already-present')

        const patched = readFileSync(path.join(tmp, 'eslint.config.js'), 'utf-8')
        expect(patched.match(/\.harness\/\*\*/g)).toHaveLength(1)
    })

    it('이미 손으로 넣어둔 경우도 건드리지 않는다', () => {
        const detected = setup(
            "export default [\n    { ignores: ['.harness/**', 'dist'] },\n]\n",
        )
        expect(patchEslintIgnores(detected, false).status).toBe('already-present')
    })

    it('알아볼 수 없는 형태면 파일을 고치지 않고 조각만 돌려준다', () => {
        const source = 'const config = [base]\nexport { config as default }\n'
        const detected = setup(source)
        const result = patchEslintIgnores(detected, false)

        expect(result.status).toBe('unrecognized')
        expect(result.snippet).toContain('.harness/**')
        expect(readFileSync(path.join(tmp, 'eslint.config.js'), 'utf-8')).toBe(source)
    })

    it('dry-run 은 파일을 쓰지 않는다', () => {
        const source = 'export default [\n    base,\n]\n'
        const detected = setup(source)
        expect(patchEslintIgnores(detected, true).status).toBe('patched')
        expect(readFileSync(path.join(tmp, 'eslint.config.js'), 'utf-8')).toBe(source)
    })

    it('flat config 가 없으면 아무 일도 하지 않는다', () => {
        expect(
            patchEslintIgnores(fakeDetect({ eslintConfigFile: undefined }), false)
                .status,
        ).toBe('no-config')
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
