import { readdirSync } from 'node:fs'
import path from 'node:path'

import {
    getTemplatesRoot,
    loadTemplate,
    parseFrontmatter,
    serializeFrontmatter,
} from './render.js'
import type {
    ICheck,
    IDetectResult,
    IFileAction,
    IHarnessConfig,
    IScaffoldOptions,
    TPackageManager,
} from './types.js'

const PM_RUN: Record<TPackageManager, string> = {
    npm: 'npm run',
    pnpm: 'pnpm run',
    yarn: 'yarn',
    bun: 'bun run',
}

const PM_EXEC: Record<TPackageManager, string> = {
    npm: 'npx',
    pnpm: 'pnpm exec',
    yarn: 'yarn',
    bun: 'bunx',
}

export const buildVars = (
    detected: IDetectResult,
    options: IScaffoldOptions,
): Record<string, string> => ({
    PROJECT_NAME: detected.projectName,
    PM: detected.packageManager,
    PM_RUN: PM_RUN[detected.packageManager],
    PM_EXEC: PM_EXEC[detected.packageManager],
    RULES_DIR: options.agents.includes('cursor')
        ? '.cursor/rules'
        : 'docs/conventions',
})

/**
 * 대상 프로젝트의 package.json scripts를 보고 실제 존재하는 체크만 담는다.
 * 없는 스크립트를 참조해 게이트가 즉시 깨지는 일을 막기 위함이다.
 * 빠른 실패 순서: typecheck → lint → stylelint → test → build
 */
export const buildChecks = (
    detected: IDetectResult,
    options: IScaffoldOptions,
): ICheck[] => {
    const run = PM_RUN[detected.packageManager]
    const exec = PM_EXEC[detected.packageManager]
    const checks: ICheck[] = []

    if (detected.scripts['typecheck']) {
        checks.push({ id: 'typecheck', command: `${run} typecheck` })
    } else if (detected.isTypeScript) {
        checks.push({ id: 'typecheck', command: `${exec} tsc --noEmit` })
    }

    if (detected.scripts['lint']) {
        checks.push({ id: 'lint', command: `${run} lint` })
    }

    if (options.modules.includes('design-system')) {
        checks.push({
            id: 'stylelint',
            command: `${exec} stylelint "src/**/*.css"`,
        })
    }

    const testScript = detected.scripts['test']
    if (testScript) {
        const isWatchByDefault =
            testScript.includes('vitest') && !/\b(run|--run)\b/.test(testScript)
        checks.push({
            id: 'test',
            command: isWatchByDefault ? `${run} test -- --run` : `${run} test`,
        })
    }

    if (detected.scripts['build']) {
        checks.push({ id: 'build', command: `${run} build` })
    }

    return checks
}

const listTemplates = (relDir: string): string[] =>
    readdirSync(path.join(getTemplatesRoot(), relDir))
        .filter((name) => !name.startsWith('.'))
        .sort()

/** templates/core/conventions/*.md → .cursor/rules/*.mdc (또는 docs/conventions/*.md) */
const buildRuleActions = (
    options: IScaffoldOptions,
    vars: Record<string, string>,
): IFileAction[] =>
    listTemplates('core/conventions').map((file) => {
        const raw = loadTemplate(`core/conventions/${file}`, vars)
        if (options.agents.includes('cursor')) {
            const { meta, body } = parseFrontmatter(raw)
            return {
                dest: `.cursor/rules/${file.replace(/\.md$/, '.mdc')}`,
                content: serializeFrontmatter(meta) + body,
                module: 'core',
            }
        }
        // Cursor 미선택 시에는 규칙을 docs/conventions/ 아래 일반 문서로 둔다
        return {
            dest: `docs/conventions/${file}`,
            content: raw,
            module: 'core',
        }
    })

const WORKFLOWS = ['spec', 'impl', 'verify', 'ship', 'ds-init', 'ds-add']

/** templates/core/workflows → .cursor/commands + .claude/skills(SKILL.md) fan-out */
const buildWorkflowActions = (
    options: IScaffoldOptions,
    vars: Record<string, string>,
): IFileAction[] => {
    const actions: IFileAction[] = []
    const parsed = new Map<string, { meta: Record<string, string>; body: string }>()

    for (const name of WORKFLOWS) {
        parsed.set(name, parseFrontmatter(loadTemplate(`core/workflows/${name}.md`, vars)))
    }

    if (options.agents.includes('cursor')) {
        for (const name of WORKFLOWS) {
            const { body } = parsed.get(name)!
            actions.push({
                dest: `.cursor/commands/${name}.md`,
                content: body,
                module: 'core',
            })
        }
    }

    if (options.agents.includes('claude')) {
        // spec / impl / verify / ship 은 1:1 스킬
        for (const name of ['spec', 'impl', 'verify', 'ship']) {
            const { meta, body } = parsed.get(name)!
            actions.push({
                dest: `.claude/skills/${name}/SKILL.md`,
                content:
                    serializeFrontmatter({
                        name,
                        description: meta['description'] ?? '',
                    }) + body,
                module: 'core',
            })
        }
        // design-system 스킬 하나가 ds-init·ds-add 두 흐름을 포함한다
        const dsInit = parsed.get('ds-init')!
        const dsAdd = parsed.get('ds-add')!
        actions.push({
            dest: '.claude/skills/design-system/SKILL.md',
            content:
                serializeFrontmatter({
                    name: 'design-system',
                    description:
                        'Design system workflows: one-time Storybook setup (ds-init) and adding components before layout work (ds-add).',
                }) +
                `# Design System\n\n## Part 1 — ds-init (최초 1회 설정)\n\n${dsInit.body}\n\n---\n\n## Part 2 — ds-add (UI 작업마다)\n\n${dsAdd.body}`,
            module: 'core',
        })
    }

    return actions
}

const buildGateActions = (
    options: IScaffoldOptions,
    vars: Record<string, string>,
): IFileAction[] => {
    const actions: IFileAction[] = [
        {
            dest: '.harness/gates/pre-commit-gate.sh',
            content: loadTemplate('core/gates/pre-commit-gate.sh', vars),
            module: 'core',
            executable: true,
        },
        {
            dest: '.harness/gates/gate.mjs',
            content: loadTemplate('core/gates/gate.mjs', vars),
            module: 'core',
        },
        {
            dest: '.harness/gates/run-checks.mjs',
            content: loadTemplate('core/gates/run-checks.mjs', vars),
            module: 'core',
        },
    ]

    if (options.agents.includes('cursor')) {
        actions.push({
            dest: '.cursor/hooks.json',
            content: loadTemplate('core/gates/cursor-hooks.json', vars),
            module: 'core',
        })
    }
    if (options.agents.includes('claude')) {
        actions.push({
            dest: '.claude/settings.json',
            content: loadTemplate('core/gates/claude-settings.json', vars),
            module: 'core',
        })
    }
    return actions
}

const buildDocActions = (vars: Record<string, string>): IFileAction[] => [
    ...['architecture.md', 'decisions.md', 'product-spec.md', 'task-log.md'].map(
        (file) => ({
            dest: `docs/${file}`,
            content: loadTemplate(`core/docs/${file}`, vars),
            module: 'core',
        }),
    ),
    {
        dest: 'docs/specs/_template.md',
        content: loadTemplate('core/docs/specs/_template.md', vars),
        module: 'core',
    },
]

const buildModuleActions = (
    options: IScaffoldOptions,
    vars: Record<string, string>,
): IFileAction[] => {
    const actions: IFileAction[] = []
    const preset = `presets/${options.preset}`

    if (options.modules.includes('design-system')) {
        actions.push(
            {
                dest: 'src/design-system/tokens.css',
                content: loadTemplate(`${preset}/design-system/tokens.css`, vars),
                module: 'design-system',
            },
            {
                dest: 'src/design-system/tokens.ts',
                content: loadTemplate(`${preset}/design-system/tokens.ts`, vars),
                module: 'design-system',
            },
            {
                // .stories. 를 파일명에 넣지 않는다 — Storybook 테스트 러너의
                // *.stories.* glob이 참고용 템플릿을 실제로 실행하려 든다
                dest: 'src/design-system/_story-template.tsx',
                content: loadTemplate(
                    `${preset}/design-system/_story-template.tsx`,
                    vars,
                ),
                module: 'design-system',
            },
            {
                dest: 'stylelint.config.js',
                content: loadTemplate(
                    `${preset}/design-system/stylelint.config.js`,
                    vars,
                ),
                module: 'design-system',
            },
        )
    }

    if (options.modules.includes('auth-http')) {
        actions.push(
            {
                dest: 'src/utils/axiosInstance.ts',
                content: loadTemplate(
                    `${preset}/reference/auth-http/axiosInstance.ts`,
                    vars,
                ),
                module: 'auth-http',
            },
            {
                dest: 'src/components/shared/ProtectedRoute.tsx',
                content: loadTemplate(
                    `${preset}/reference/auth-http/ProtectedRoute.tsx`,
                    vars,
                ),
                module: 'auth-http',
            },
        )
    }

    if (options.modules.includes('data-fetching')) {
        actions.push(
            {
                dest: 'src/types/api.ts',
                content: loadTemplate(
                    `${preset}/reference/data-fetching/api.ts`,
                    vars,
                ),
                module: 'data-fetching',
            },
            {
                dest: 'src/queries/Example/exampleApi.ts',
                content: loadTemplate(
                    `${preset}/reference/data-fetching/exampleApi.ts`,
                    vars,
                ),
                module: 'data-fetching',
            },
            {
                dest: 'src/queries/Example/exampleQueryKeys.ts',
                content: loadTemplate(
                    `${preset}/reference/data-fetching/exampleQueryKeys.ts`,
                    vars,
                ),
                module: 'data-fetching',
            },
            {
                dest: 'src/queries/Example/index.ts',
                content: loadTemplate(
                    `${preset}/reference/data-fetching/index.ts`,
                    vars,
                ),
                module: 'data-fetching',
            },
            {
                dest: 'src/stores/shared/alertDialogStore.ts',
                content: loadTemplate(
                    `${preset}/reference/data-fetching/alertDialogStore.ts`,
                    vars,
                ),
                module: 'data-fetching',
            },
        )
    }

    if (options.modules.includes('lint')) {
        actions.push(
            {
                dest: 'eslint.harness.config.js',
                content: loadTemplate(`${preset}/configs/eslint.harness.config.js`, vars),
                module: 'lint',
            },
            {
                dest: 'commitlint.config.js',
                content: loadTemplate(`${preset}/configs/commitlint.config.js`, vars),
                module: 'lint',
            },
            {
                dest: 'prettier.config.js',
                content: loadTemplate(`${preset}/configs/prettier.config.js`, vars),
                module: 'lint',
            },
        )
    }

    return actions
}

/** 스캐폴딩으로 생성할 전체 파일 목록을 만든다 (manifest.json 제외 — 마지막에 별도 기록) */
export const buildPlan = (
    detected: IDetectResult,
    options: IScaffoldOptions,
): IFileAction[] => {
    const vars = buildVars(detected, options)
    const config: IHarnessConfig = {
        packageManager: detected.packageManager,
        checks: buildChecks(detected, options),
    }

    const actions: IFileAction[] = [
        {
            dest: 'AGENTS.md',
            content: loadTemplate('core/AGENTS.md', vars),
            module: 'core',
        },
        {
            dest: '.harness/config.json',
            content: JSON.stringify(config, null, 4) + '\n',
            module: 'core',
        },
        ...buildRuleActions(options, vars),
        ...buildWorkflowActions(options, vars),
        ...buildGateActions(options, vars),
        ...buildDocActions(vars),
        ...buildModuleActions(options, vars),
    ]

    if (options.agents.includes('claude')) {
        actions.splice(1, 0, {
            dest: 'CLAUDE.md',
            content: loadTemplate('core/CLAUDE.md', vars),
            module: 'core',
        })
    }

    return actions
}

/** 선택 모듈이 요구하는 devDependencies (자동 설치하지 않고 안내 출력용) */
export const requiredDevDeps = (options: IScaffoldOptions): string[] => {
    const deps: string[] = []
    if (options.modules.includes('design-system')) {
        deps.push('stylelint', 'stylelint-declaration-strict-value')
    }
    if (options.modules.includes('lint')) {
        deps.push(
            'eslint-plugin-import',
            '@commitlint/cli',
            '@commitlint/config-conventional',
            'prettier',
        )
    }
    if (options.modules.includes('data-fetching')) {
        deps.push('@tanstack/react-query', 'zustand')
    }
    if (options.modules.includes('auth-http')) {
        deps.push('axios', 'react-router-dom')
    }
    return [...new Set(deps)]
}
