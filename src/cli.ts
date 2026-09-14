#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import * as p from '@clack/prompts'
import pc from 'picocolors'

import { detect } from './detect.js'
import { writeActions, writeManifest } from './manifest.js'
import { runPrompts } from './prompts.js'
import { patchEslintIgnores } from './eslintPatch.js'
import { buildPonytailAction } from './ponytail.js'
import {
    buildPlan,
    hasAtomicBaseline,
    hasStylelintBaseline,
    requiredDevDeps,
} from './registry.js'
import { recommendedModules, suggestModules } from './suggest.js'
import type { IScaffoldOptions, TAgent, TModule } from './types.js'

const VALID_AGENTS: TAgent[] = ['cursor', 'claude']
const VALID_MODULES: TModule[] = [
    'design-system',
    'auth-http',
    'data-fetching',
    'lint',
]

const getOwnVersion = (): string => {
    const pkgPath = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '..',
        'package.json',
    )
    return (JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string })
        .version
}

const parseCsv = <T extends string>(
    raw: string | undefined,
    valid: readonly T[],
    label: string,
): T[] | undefined => {
    if (raw === undefined) return undefined
    const values = raw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    for (const value of values) {
        if (!valid.includes(value as T)) {
            console.error(
                `알 수 없는 ${label}: "${value}" (가능한 값: ${valid.join(', ')})`,
            )
            process.exit(1)
        }
    }
    return values as T[]
}

const main = async (): Promise<void> => {
    const { values, positionals } = parseArgs({
        options: {
            preset: { type: 'string', default: 'react-fe' },
            agents: { type: 'string' },
            modules: { type: 'string' },
            ponytail: { type: 'boolean', default: false },
            'dry-run': { type: 'boolean', default: false },
            yes: { type: 'boolean', short: 'y', default: false },
            install: { type: 'boolean', default: false },
            help: { type: 'boolean', short: 'h', default: false },
            version: { type: 'boolean', short: 'v', default: false },
        },
        allowPositionals: true,
    })

    if (values.version) {
        console.log(getOwnVersion())
        return
    }
    if (values.help) {
        console.log(`사용법: npx create-harness-cli [대상 디렉터리] [옵션]

옵션:
  --preset <name>     프리셋 (기본: react-fe)
  --agents <csv>      cursor,claude (기본: 둘 다)
  --modules <csv>     design-system,auth-http,data-fetching,lint
  --ponytail          서드파티 ponytail 규칙(YAGNI 사다리) 연동
  --dry-run           파일을 쓰지 않고 계획만 출력
  -y, --yes           질문 없이 기본값/옵션값으로 진행
  --install           필요한 devDependency 설치 명령까지 출력 후 실행 안내
  -h, --help          도움말
  -v, --version       버전`)
        return
    }

    if (values.preset !== 'react-fe') {
        console.error(`v0.1은 react-fe 프리셋만 지원합니다 (받은 값: ${values.preset})`)
        process.exit(1)
    }

    const targetDir = path.resolve(positionals[0] ?? '.')
    const detected = detect(targetDir)

    if (!detected.hasPackageJson) {
        console.error(
            `대상에 package.json이 없습니다: ${targetDir}\n` +
                'create-harness는 기존 프로젝트에 하네스를 얹는 도구입니다.',
        )
        process.exit(1)
    }

    const suggestions = suggestModules(detected)
    const explicitModules = parseCsv(values.modules, VALID_MODULES, 'module')

    const defaults: IScaffoldOptions = {
        targetDir,
        preset: 'react-fe',
        agents: parseCsv(values.agents, VALID_AGENTS, 'agent') ?? [
            'cursor',
            'claude',
        ],
        // --modules 를 주지 않으면 감지 결과가 기본값을 정한다
        modules: explicitModules ?? recommendedModules(detected),
        ponytail: values.ponytail ?? false,
        // --yes 경로에서는 design-system 선택 시 pending, 없으면 off
        storybook:
            (explicitModules ?? recommendedModules(detected)).includes(
                'design-system',
            )
                ? 'pending'
                : 'off',
        dryRun: values['dry-run'],
        yes: values.yes,
        install: values.install,
    }

    const options = await runPrompts(detected, defaults, suggestions)

    // 감지 때문에 빠진 모듈은 이유를 남긴다 (--yes 로 프롬프트를 건너뛴 경우 특히)
    const excluded = suggestions.filter(
        (suggestion) =>
            !suggestion.isRecommended &&
            !options.modules.includes(suggestion.module),
    )
    if (explicitModules === undefined && excluded.length > 0) {
        console.log(`\n${pc.dim('감지 결과로 제외된 모듈:')}`)
        for (const suggestion of excluded) {
            console.log(
                `  ${pc.dim('-')} ${suggestion.module} — ${pc.dim(suggestion.reason)}`,
            )
        }
        console.log(
            pc.dim(`  포함하려면: --modules ${VALID_MODULES.join(',')}`),
        )
    }

    // 이 하네스는 디자인시스템 모듈을 기본 전제로 삼는다 — 빠진 채로 넘어가지 않게 짚는다
    if (!options.modules.includes('design-system')) {
        const lines = [
            `\n${pc.yellow('권고')} — design-system 모듈 없이 진행합니다.`,
            pc.dim(
                '  이 하네스가 UI 드리프트를 막는 유일한 결정적 수단이 토큰 + stylelint 입니다.\n' +
                    '  규칙 문서만으로는 에이전트가 화면마다 다른 색·간격을 씁니다.',
            ),
        ]
        if (detected.hasTailwind) {
            lines.push(
                pc.dim(
                    '  Tailwind 는 값이 클래스 문자열 안에 있어 stylelint 가 닿지 못합니다.\n' +
                        '  새 프로젝트라면 CSS Modules + tokens.css 조합을 권장합니다.',
                ),
            )
        }
        console.log(lines.join('\n'))
    }

    const plan = buildPlan(detected, options)

    let ponytailTag: string | null = null
    let ponytailFetchFailed = false
    if (options.ponytail && options.agents.includes('cursor')) {
        const fetched = await buildPonytailAction()
        if (fetched) {
            plan.push(fetched.action)
            ponytailTag = fetched.tag
        } else {
            ponytailFetchFailed = true
        }
    }

    const results = writeActions(plan, targetDir, options.dryRun)
    writeManifest(results, options, getOwnVersion(), options.dryRun)

    const written = results.filter((result) => !result.placedInIncoming)
    const incoming = results.filter((result) => result.placedInIncoming)

    const header = options.dryRun
        ? pc.yellow('[dry-run] 실제로 쓰지 않은 계획입니다')
        : pc.green('생성 완료')
    console.log(`\n${header} — ${detected.projectName} (${options.preset})`)
    for (const result of written) {
        console.log(`  ${pc.green('+')} ${result.dest}`)
    }
    if (incoming.length > 0) {
        console.log(
            `\n${pc.yellow('충돌')} — 아래 파일은 이미 존재해 .harness/incoming/ 에 두었습니다:`,
        )
        for (const result of incoming) {
            console.log(`  ${pc.yellow('~')} ${result.dest}`)
            console.log(
                `    비교: diff ${result.dest} .harness/incoming/${result.dest}.incoming`,
            )
        }
    }

    const patch = patchEslintIgnores(detected, options.dryRun)
    if (patch.status === 'patched') {
        console.log(
            `\n${pc.green('패치')} — ${patch.file} 에 하네스 파일 ignores 를 추가했습니다:\n` +
                pc.dim(patch.snippet),
        )
    } else if (patch.status === 'unrecognized') {
        console.log(
            `\n${pc.yellow('수동 필요')} — ${patch.file} 의 export 형태를 알아보지 못했습니다.\n` +
                `  설정 배열 안에 아래를 직접 넣으세요 (없으면 eslint가 .harness/ 를 검사합니다):\n` +
                pc.dim(patch.snippet),
        )
    }

    if (hasStylelintBaseline(detected, options)) {
        console.log(
            `\n${pc.yellow('stylelint 유예')} — 색상 원시값을 쓰던 기존 CSS ` +
                `${detected.cssFilesWithRawColor.length}개를 .harness/stylelint-baseline.json 에 올렸습니다.\n` +
                pc.dim(
                    '  이 파일들만 warning 이고 새로 만드는 CSS는 error 입니다.\n' +
                        '  정리할 때마다 목록에서 경로를 지우세요. 비면 stylelint.config.js 의 overrides 를 삭제하면 됩니다.',
                ),
        )
    }

    if (hasAtomicBaseline(detected, options)) {
        console.log(
            `\n${pc.yellow('Atomic 유예')} — raw JSX를 쓰던 기존 페이지 ` +
                `${detected.pagesWithRawJsx.length}개를 .harness/atomic-baseline.json 에 올렸습니다.\n` +
                pc.dim(
                    '  이 파일들만 warning 이고 새로 만드는 페이지는 error 입니다.\n' +
                        '  페이지를 Atomic 계층(atom/molecule/organism)으로 리팩터링할 때마다 목록에서 경로를 지우세요.',
                ),
        )
    }

    if (ponytailTag) {
        console.log(
            `\n${pc.green('ponytail')} — Cursor 규칙을 릴리스 ${ponytailTag}에서 받아 설치했습니다 (.cursor/rules/ponytail.mdc).`,
        )
    } else if (ponytailFetchFailed) {
        console.log(
            `\n${pc.yellow('ponytail')} — 규칙 파일을 받아오지 못했습니다 (네트워크를 확인하세요).\n` +
                pc.dim(
                    '  수동 설치: https://github.com/DietrichGebert/ponytail 의 .cursor/rules/ponytail.mdc 를 프로젝트에 복사하세요.',
                ),
        )
    }

    const deps = requiredDevDeps(options)
    if (deps.length > 0) {
        console.log(
            `\n선택한 모듈이 요구하는 의존성 (자동 설치하지 않습니다):\n  ${pc.cyan(
                `${detected.packageManager} install -D ${deps.join(' ')}`,
            )}`,
        )
    }

    const steps = [
        'AGENTS.md 의 TODO와 docs/product-spec.md 를 프로젝트에 맞게 채우세요',
        '.harness/config.json 의 checks 를 확인하세요 (게이트·/verify 가 이 목록을 실행합니다)',
    ]
    if (options.modules.includes('design-system') && options.storybook === 'pending') {
        steps.push('UI 작업 전에 /ds-init 워크플로로 Storybook을 설치하세요')
    }
    if (options.ponytail && options.agents.includes('claude')) {
        steps.unshift(
            'ponytail(Claude Code) 설치 — 아래 두 명령을 각각 별도 메시지로 보내세요:\n' +
                '     /plugin marketplace add DietrichGebert/ponytail\n' +
                '     /plugin install ponytail@ponytail',
        )
    }
    console.log(
        `\n다음 단계:\n` +
            steps.map((step, index) => `  ${index + 1}. ${step}`).join('\n'),
    )
    p.outro('done')
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
