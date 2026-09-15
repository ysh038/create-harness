import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// 빌드 산출물을 테스트한다 (npm run check 가 build → test 순서를 보장)
import { patchEslintIgnores } from '../dist/eslintPatch.js'
import { writeActions } from '../dist/manifest.js'
import { buildChecks, buildPlan, requiredDevDeps } from '../dist/registry.js'
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
    pagesWithRawJsx: [],
    existingAgentFiles: [],
    ...overrides,
})

const fullOptions = (targetDir: string): IScaffoldOptions => ({
    targetDir,
    preset: 'react-fe',
    agents: ['cursor', 'claude'],
    modules: ['design-system', 'auth-http', 'data-fetching', 'lint'],
    ponytail: false,
    storybook: 'pending',
    mode: 'free',
    fidelity: null,
    style: {
        componentDeclaration: 'function',
        componentExport: 'default',
        styling: 'css-modules',
    },
    acceptDisclaimer: false,
    dryRun: false,
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

    it('AGENTS.md에 raw Mustache 조건문이 남지 않는다 (design-system ON)', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const agents = plan.find((action) => action.dest === 'AGENTS.md')!
        expect(agents.content).not.toContain('{{#if')
        expect(agents.content).not.toContain('{{/if}}')
        expect(agents.content).toContain('/ds-init')
        expect(agents.content).toContain('/ds-add')
    })

    it('AGENTS.md에 raw Mustache 조건문이 남지 않는다 (design-system OFF)', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            modules: ['auth-http', 'data-fetching', 'lint'],
        })
        const agents = plan.find((action) => action.dest === 'AGENTS.md')!
        expect(agents.content).not.toContain('{{#if')
        expect(agents.content).not.toContain('{{/if}}')
        expect(agents.content).not.toContain('/ds-init')
    })

    it('AGENTS.md에 raw Mustache 조건문이 남지 않는다 (free mode)', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            mode: 'free',
        })
        const agents = plan.find((action) => action.dest === 'AGENTS.md')!
        expect(agents.content).not.toContain('{{#if')
        expect(agents.content).not.toContain('{{/if}}')
        expect(agents.content).not.toContain('디자인 참조 맵')
    })

    it('AGENTS.md에 raw Mustache 조건문이 남지 않는다 (implement mode with fidelity)', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            mode: 'implement',
            fidelity: 'match',
        })
        const agents = plan.find((action) => action.dest === 'AGENTS.md')!
        expect(agents.content).not.toContain('{{#if')
        expect(agents.content).not.toContain('{{/if}}')
        expect(agents.content).toContain('(충실도: `match`)')
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

    it('디자인시스템 규칙·워크플로가 Atomic 계층을 명시한다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const rule = plan.find(
            (action) => action.dest === '.cursor/rules/30-design-system.mdc',
        )!
        for (const layer of [
            'src/design-system/atoms/',
            'src/design-system/molecules/',
            'src/design-system/organisms/',
        ]) {
            expect(rule.content, layer).toContain(layer)
        }
        const dsAdd = plan.find(
            (action) => action.dest === '.cursor/commands/ds-add.md',
        )!
        expect(dsAdd.content).toContain('atom')
        expect(dsAdd.content).toContain('molecule')
        expect(dsAdd.content).toContain('organism')
    })

    it('lint 조각이 계층 역방향 import를 error로 끊는다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const eslint = plan.find(
            (action) => action.dest === 'eslint.harness.config.js',
        )!
        // 계층마다 상위 계층·도메인·전역 상태 import 금지 블록이 걸린다
        for (const layer of ['atoms', 'molecules', 'organisms']) {
            expect(eslint.content, layer).toContain(`layerBoundary(
        '${layer}'`)
        }
        expect(eslint.content).toContain("'**/molecules/**'")
        expect(eslint.content).toContain("'**/organisms/**'")
        // 계층 내부의 상대 import 는 design-system/ 세그먼트를 포함하지 않는다.
        // 패턴에 그 세그먼트가 남아 있으면 정작 막아야 할 위반이 통과한다.
        expect(eslint.content).not.toMatch(/'!?\*\*\/design-system\//)
        // 계층 블록이 공개 API 경계를 덮어쓰지 않는다 (flat config 는 규칙을 병합하지 않는다)
        expect(eslint.content).toContain('PUBLIC_API_PATTERN, { group: forbidden')
    })

    it('naming-convention 이 화살표 함수 컴포넌트(PascalCase 변수)를 예외로 둔다', () => {
        // types: ['function'] 예외가 없으면 `const Button = () => ...` 같은 표준 React
        // 컴포넌트 선언 자체가 "변수는 camelCase" 규칙에 걸려 오탐이 난다 (실사용에서 확인)
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const eslint = plan.find(
            (action) => action.dest === 'eslint.harness.config.js',
        )!
        expect(eslint.content).toContain("types: ['function']")
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

describe('requiredDevDeps', () => {
    it('lint 모듈은 eslint.harness.config.js 가 import하는 패키지를 전부 포함한다', () => {
        // 실사용(--modules 로 lint 강제 포함, 호스트에 eslint 자체가 없던 경우)에서
        // eslint·typescript-eslint 가 안내 목록에 없어 설치가 안 되는 문제가 있었다.
        const deps = requiredDevDeps({
            ...fullOptions('/tmp/fake'),
            modules: ['lint'],
        })
        expect(deps).toContain('eslint')
        expect(deps).toContain('typescript-eslint')
        expect(deps).toContain('eslint-plugin-import')
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
        expect(dests).not.toContain('.cursor/commands/ux-review.md')
        expect(dests).not.toContain('.claude/skills/design-system/SKILL.md')
        expect(dests).not.toContain('.claude/skills/ux-review/SKILL.md')
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
        expect(agents.content).not.toContain('/ux-review')
        expect(agents.content).not.toContain('stylelint')
        expect(agents.content).toContain('/spec')
    })

    it('design-system 을 포함하면 다시 나타난다 (ux-review 포함)', () => {
        const dests = buildPlan(fakeDetect(), fullOptions('/tmp/fake')).map(
            (action) => action.dest,
        )
        expect(dests).toContain('.cursor/rules/30-design-system.mdc')
        expect(dests).toContain('.cursor/commands/ds-init.md')
        expect(dests).toContain('.cursor/commands/ux-review.md')
        expect(dests).toContain('.claude/skills/ux-review/SKILL.md')
    })
})

describe('/ux-review — design-system과 별개 스킬로 존재한다', () => {
    it('Claude 스킬로 fan-out 시 ds-init·ds-add와 합쳐지지 않는다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const uxReview = plan.find(
            (action) => action.dest === '.claude/skills/ux-review/SKILL.md',
        )
        const designSystem = plan.find(
            (action) => action.dest === '.claude/skills/design-system/SKILL.md',
        )
        expect(uxReview).toBeDefined()
        expect(uxReview!.content).not.toContain('ds-init')
        // design-system 스킬이 ds-add.md에서 /ux-review 를 짧게 참조하는 건 정상이다 —
        // 여기서 확인하는 건 ux-review 워크플로 "본문"(체크리스트)이 통째로 합쳐지지 않는다는 것
        expect(designSystem!.content).not.toContain('직접 고쳐도 되는 범위')
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

describe('Atomic 유예 목록(baseline)', () => {
    const legacy = ['src/pages/Home.tsx', 'src/App.tsx']

    it('기존 페이지에 raw JSX가 있으면 baseline 파일과 warning 오버라이드를 만든다', () => {
        const plan = buildPlan(
            fakeDetect({ pagesWithRawJsx: legacy }),
            fullOptions('/tmp/fake'),
        )
        const baseline = plan.find(
            (action) => action.dest === '.harness/atomic-baseline.json',
        )
        expect(JSON.parse(baseline!.content)).toEqual(legacy)

        const eslint = plan.find(
            (action) => action.dest === 'eslint.harness.config.js',
        )!
        expect(eslint.content).toContain('atomic-baseline.json')
        expect(eslint.content).toContain("'no-restricted-syntax': ['warn']")
    })

    it('raw JSX가 없으면 baseline을 만들지 않고 error 규칙만 남는다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        expect(
            plan.some(
                (action) => action.dest === '.harness/atomic-baseline.json',
            ),
        ).toBe(false)

        const eslint = plan.find(
            (action) => action.dest === 'eslint.harness.config.js',
        )!
        expect(eslint.content).not.toContain('atomic-baseline.json')
        expect(eslint.content).toContain('페이지는 조립만 한다')
    })

    it('design-system 없이 lint만 켜면 페이지 raw JSX 규칙이 안 걸린다', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            modules: ['lint'],
        })
        const eslint = plan.find(
            (action) => action.dest === 'eslint.harness.config.js',
        )!
        expect(eslint.content).not.toContain('페이지는 조립만 한다')
    })
})

describe('Storybook 상태 저장', () => {
    it('config.json에 storybook 상태가 기록된다', () => {
        const plan = buildPlan(fakeDetect(), fullOptions('/tmp/fake'))
        const config = plan.find(
            (action) => action.dest === '.harness/config.json',
        )!
        const parsed = JSON.parse(config.content)
        expect(parsed.storybook).toBe('pending')
    })

    it('storybook: off 일 때도 config에 기록된다', () => {
        const plan = buildPlan(fakeDetect(), {
            ...fullOptions('/tmp/fake'),
            storybook: 'off',
        })
        const config = plan.find(
            (action) => action.dest === '.harness/config.json',
        )!
        const parsed = JSON.parse(config.content)
        expect(parsed.storybook).toBe('off')
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

describe('non-TTY 필수 답변 검증', () => {
    let tmp: string

    afterEach(() => {
        if (tmp) rmSync(tmp, { recursive: true, force: true })
    })

    it('non-TTY에서 --agents 누락 시 에러 (modules/mode는 제공됨)', () => {
        tmp = mkdtempSync(path.join(tmpdir(), 'harness-test-'))
        writeFileSync(
            path.join(tmp, 'package.json'),
            JSON.stringify({ name: 'test-app' }),
        )

        // non-TTY 환경 시뮬레이션: stdin을 닫음
        let stderr = ''
        try {
            execSync(
                `node ${path.resolve(__dirname, '../dist/cli.js')} ${tmp} --mode free --modules lint --dry-run`,
                {
                    encoding: 'utf-8',
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, CI: '1' },
                },
            )
        } catch (err: unknown) {
            stderr = (err as { stderr?: string }).stderr ?? ''
        }

        expect(stderr).toContain('--agents')
        expect(stderr).toContain('Missing required answers')
    })

    it('non-TTY에서 모든 필수 답변 제공 시 성공', () => {
        tmp = mkdtempSync(path.join(tmpdir(), 'harness-test-'))
        writeFileSync(
            path.join(tmp, 'package.json'),
            JSON.stringify({ name: 'test-app' }),
        )

        const output = execSync(
            `node ${path.resolve(__dirname, '../dist/cli.js')} ${tmp} --lang ko --mode free --agents cursor --modules lint --styling css --dry-run`,
            {
                encoding: 'utf-8',
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, CI: '1' },
            },
        )

        expect(output).toContain('done')
    })
})
