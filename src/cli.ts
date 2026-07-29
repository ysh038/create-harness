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
import { buildPlan, requiredDevDeps } from './registry.js'
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
        console.log(`사용법: npx create-harness [대상 디렉터리] [옵션]

옵션:
  --preset <name>     프리셋 (기본: react-fe)
  --agents <csv>      cursor,claude (기본: 둘 다)
  --modules <csv>     design-system,auth-http,data-fetching,lint
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

    const defaults: IScaffoldOptions = {
        targetDir,
        preset: 'react-fe',
        agents: parseCsv(values.agents, VALID_AGENTS, 'agent') ?? [
            'cursor',
            'claude',
        ],
        modules: parseCsv(values.modules, VALID_MODULES, 'module') ?? [
            'design-system',
            'auth-http',
            'data-fetching',
            'lint',
        ],
        dryRun: values['dry-run'],
        yes: values.yes,
        install: values.install,
    }

    if (!detected.hasPackageJson) {
        console.error(
            `대상에 package.json이 없습니다: ${targetDir}\n` +
                'create-harness는 기존 프로젝트에 하네스를 얹는 도구입니다.',
        )
        process.exit(1)
    }

    const options = await runPrompts(detected, defaults)
    const plan = buildPlan(detected, options)
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

    const deps = requiredDevDeps(options)
    if (deps.length > 0) {
        console.log(
            `\n선택한 모듈이 요구하는 의존성 (자동 설치하지 않습니다):\n  ${pc.cyan(
                `${detected.packageManager} install -D ${deps.join(' ')}`,
            )}`,
        )
    }
    console.log(
        `\n다음 단계:\n` +
            `  1. AGENTS.md 의 TODO와 docs/product-spec.md 를 프로젝트에 맞게 채우세요\n` +
            `  2. .harness/config.json 의 checks 를 확인하세요 (게이트·/verify 가 이 목록을 실행합니다)\n` +
            `  3. eslint 설정의 ignores 에 '.harness/**' 를 추가하세요\n` +
            `     (lint 모듈을 쓰면 eslint.harness.config.js 를 spread하는 것으로 충분합니다)\n` +
            `  4. UI 작업 전이라면 /ds-init 워크플로로 Storybook을 설치하세요`,
    )
    p.outro('done')
}

main().catch((error: unknown) => {
    console.error(error)
    process.exit(1)
})
