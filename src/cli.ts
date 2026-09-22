#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import * as p from '@clack/prompts'
import pc from 'picocolors'

import { detect } from './detect.js'
import { readManifest, writeActions, writeManifest } from './manifest.js'
import { runPrompts } from './prompts.js'
import { patchEslintIgnores } from './eslintPatch.js'
import { patchTailwind } from './tailwindPatch.js'
import { buildPonytailAction } from './ponytail.js'
import { getModuleReason } from './i18n.js'
import {
    buildPlan,
    hasAtomicBaseline,
    hasStylelintBaseline,
    requiredDevDeps,
} from './registry.js'
import { recommendedModules, suggestModules } from './suggest.js'
import type { IScaffoldOptions, TAgent, TModule, TLanguage } from './types.js'

const VALID_AGENTS: TAgent[] = ['cursor', 'claude']
const VALID_MODULES: TModule[] = [
    'design-system',
    'auth-http',
    'data-fetching',
    'lint',
]

interface IConfigFile {
    mode?: 'free' | 'inspire' | 'implement'
    agents?: TAgent[]
    modules?: TModule[]
    storybook?: 'off' | 'pending'
    ponytail?: boolean
    componentDeclaration?: 'function' | 'arrow'
    componentExport?: 'default' | 'named'
    styling?: 'css' | 'css-modules' | 'tailwind'
    figmaUrl?: string
    acceptDisclaimer?: boolean
    dryRun?: boolean
    install?: boolean
    lang?: 'ko' | 'en'
}

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
            lang: { type: 'string' },
            agents: { type: 'string' },
            modules: { type: 'string' },
            storybook: { type: 'string' },
            ponytail: { type: 'boolean', default: false },
            mode: { type: 'string' },
            'component-declaration': { type: 'string' },
            'component-export': { type: 'string' },
            styling: { type: 'string' },
            'figma-url': { type: 'string' },
            'accept-disclaimer': { type: 'boolean', default: false },
            'dry-run': { type: 'boolean', default: false },
            config: { type: 'string' },
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
  --preset <name>                프리셋 (기본: react-fe)
  --lang <lang>                  설치 언어 en|ko (kr은 ko의 별칭)
  --agents <csv>                 cursor,claude (기본: 둘 다)
  --modules <csv>                design-system,auth-http,data-fetching,lint
  --storybook <state>            off|pending (design-system 모듈 선택 시만 유효)
  --ponytail                     서드파티 ponytail 규칙(YAGNI 사다리) 연동
  --mode <mode>                  free|inspire|implement (기본: free)
  --component-declaration <type> function|arrow (기본: function)
  --component-export <type>      default|named (기본: default)
  --styling <type>               css|css-modules|tailwind (감지되지 않은 경우)
  --figma-url <url>              Figma 파일 URL (선택)
  --accept-disclaimer            디자인 참조 면책 조항 수락
  --dry-run                      파일을 쓰지 않고 계획만 출력
  --config <path>                설정 JSON 파일 (플래그가 config보다 우선)
  --install                      필요한 devDependency 설치 명령까지 출력 후 실행 안내
  -h, --help                     도움말
  -v, --version                  버전

TTY 경로: 대화형 프롬프트로 설치 옵션 결정
Non-TTY 또는 자동화: 모든 필수 답변을 --플래그 및/또는 --config로 제공해야 함
  (누락 시 에러)`)
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

    // --config 파일 로드 (있으면)
    let configFile: IConfigFile = {}
    if (values.config) {
        try {
            const configPath =
                values.config === '-'
                    ? '/dev/stdin'
                    : path.resolve(values.config)
            const raw = readFileSync(configPath, 'utf-8')
            configFile = JSON.parse(raw) as IConfigFile

            // 알 수 없는 키 검증
            const validKeys = new Set([
                'mode',
                'agents',
                'modules',
                'storybook',
                'ponytail',
                'componentDeclaration',
                'componentExport',
                'styling',
                'figmaUrl',
                'acceptDisclaimer',
                'dryRun',
                'install',
                'lang',
            ])
            for (const key of Object.keys(configFile)) {
                if (!validKeys.has(key)) {
                    console.error(
                        `알 수 없는 config 키: "${key}"\n가능한 키: ${Array.from(validKeys).join(', ')}`,
                    )
                    process.exit(1)
                }
            }
        } catch (err) {
            console.error(`config 파일을 읽을 수 없습니다: ${String(err)}`)
            process.exit(1)
        }
    }

    const suggestions = suggestModules(detected)
    const explicitModules = parseCsv(values.modules, VALID_MODULES, 'module')

    // lang 검증: ko (kr 별칭 허용) 또는 en
    let explicitLang: TLanguage | undefined = undefined
    const langRaw = (values.lang ?? configFile.lang) as string | undefined
    if (langRaw) {
        if (langRaw === 'kr') {
            explicitLang = 'ko' // kr을 ko의 별칭으로 허용
        } else if (langRaw === 'ko' || langRaw === 'en') {
            explicitLang = langRaw as TLanguage
        } else {
            console.error(
                `알 수 없는 lang: "${langRaw}" (가능한 값: en, ko, kr)`,
            )
            process.exit(1)
        }
    }

    // mode 검증
    const explicitMode =
        (values.mode as 'free' | 'inspire' | 'implement' | undefined) ??
        configFile.mode
    if (
        explicitMode &&
        !['free', 'inspire', 'implement'].includes(explicitMode)
    ) {
        console.error(
            `알 수 없는 mode: "${explicitMode}" (가능한 값: free, inspire, implement)`,
        )
        process.exit(1)
    }

    // 스타일 옵션 검증
    const declType =
        (values['component-declaration'] as 'function' | 'arrow' | undefined) ??
        configFile.componentDeclaration
    if (declType && !['function', 'arrow'].includes(declType)) {
        console.error(
            `알 수 없는 component-declaration: "${declType}" (가능한 값: function, arrow)`,
        )
        process.exit(1)
    }
    const exportType =
        (values['component-export'] as 'default' | 'named' | undefined) ??
        configFile.componentExport
    if (exportType && !['default', 'named'].includes(exportType)) {
        console.error(
            `알 수 없는 component-export: "${exportType}" (가능한 값: default, named)`,
        )
        process.exit(1)
    }
    const stylingType =
        (values.styling as 'css' | 'css-modules' | 'tailwind' | undefined) ??
        configFile.styling
    if (
        stylingType &&
        !['css', 'css-modules', 'tailwind'].includes(stylingType)
    ) {
        console.error(
            `알 수 없는 styling: "${stylingType}" (가능한 값: css, css-modules, tailwind)`,
        )
        process.exit(1)
    }

    // --storybook 검증: off|pending만 허용 (ready는 설치 시점에 불가)
    let explicitStorybook: 'off' | 'pending' | undefined = undefined
    const storybookFromArg = values.storybook ?? configFile.storybook
    if (storybookFromArg !== undefined) {
        if (storybookFromArg !== 'off' && storybookFromArg !== 'pending') {
            console.error(
                `--storybook 는 'off' 또는 'pending' 만 허용합니다 (받은 값: ${storybookFromArg})`,
            )
            process.exit(1)
        }
        explicitStorybook = storybookFromArg as 'off' | 'pending'
    }

    // ponytail (플래그 우선, config fallback)
    const ponytailValue = values.ponytail ?? configFile.ponytail ?? false

    const defaults: IScaffoldOptions = {
        targetDir,
        preset: 'react-fe',
        agents:
            parseCsv(values.agents, VALID_AGENTS, 'agent') ??
            configFile.agents ??
            ['cursor', 'claude'],
        // --modules 를 주지 않으면 감지 결과가 기본값을 정한다
        modules:
            explicitModules ?? configFile.modules ?? recommendedModules(detected),
        ponytail: ponytailValue,
        // 명시적 --storybook 이 있으면 그걸 쓰고, 없으면 design-system 선택 여부로 추론
        storybook:
            explicitStorybook ??
            ((explicitModules ??
                configFile.modules ??
                recommendedModules(detected)
            ).includes('design-system')
                ? 'pending'
                : 'off'),
        mode: explicitMode ?? 'free',
        fidelity:
            explicitMode === 'inspire'
                ? 'inspire'
                : explicitMode === 'implement'
                  ? 'match'
                  : null,
        style: {
            componentDeclaration: declType ?? 'function',
            componentExport: exportType ?? 'default',
            styling: stylingType
                ? stylingType
                : detected.hasTailwind
                  ? 'tailwind'
                  : detected.hasCssInJs
                    ? 'detected'
                    : detected.hasCssModules
                      ? 'css-modules'
                      : 'css',
        },
        figmaUrl: values['figma-url'] ?? configFile.figmaUrl,
        acceptDisclaimer:
            values['accept-disclaimer'] ?? configFile.acceptDisclaimer ?? false,
        dryRun: values['dry-run'] ?? configFile.dryRun ?? false,
        install: values.install ?? configFile.install ?? false,
        lang: explicitLang,
    }

    // TTY 체크: interactive vs explicit-only
    const isTTY = process.stdin.isTTY === true

    if (!isTTY) {
        // Non-TTY: 모든 필수 답변 검증
        const missing: string[] = []

        // lang는 non-TTY에서 필수 (명시적 정책)
        if (!explicitLang) {
            missing.push('--lang (en|ko)')
        }

        if (!explicitMode && !configFile.mode) {
            missing.push('--mode (free|inspire|implement)')
        }
        if (!values.agents && !configFile.agents) {
            missing.push('--agents (cursor|claude)')
        }
        if (!explicitModules && !configFile.modules) {
            missing.push('--modules (design-system,auth-http,data-fetching,lint)')
        }

        // React 프로젝트이고 스타일이 감지되지 않은 경우 --styling 필수
        if (detected.isReact && !declType && !configFile.componentDeclaration) {
            missing.push('--component-declaration (function|arrow)')
        }
        // componentExport는 v0.5.0부터 필수 아님 (기본값 default)
        if (
            !stylingType &&
            !detected.hasTailwind &&
            !detected.hasCssInJs &&
            !detected.hasCssModules
        ) {
            missing.push('--styling (css|css-modules|tailwind)')
        }

        // design-system 모듈 선택 시 --storybook 필수
        if (defaults.modules.includes('design-system') && !explicitStorybook) {
            missing.push('--storybook (off|pending)')
        }

        if (missing.length > 0) {
            console.error(
                pc.red(
                    '\n❌ Non-TTY 경로: 모든 필수 답변을 CLI 플래그 또는 --config로 제공해야 합니다.\n',
                ) +
                    '\n누락된 항목:\n' +
                    missing.map((m) => `  - ${m}`).join('\n') +
                    '\n\n예시 명령:\n' +
                    pc.dim(
                        `  npx create-harness-cli ${targetDir} --lang ko --mode free --agents cursor --modules design-system,lint --storybook pending --component-declaration function\n`,
                    ) +
                    '\n또는 설정 파일 사용:\n' +
                    pc.dim(`  npx create-harness-cli ${targetDir} --config config.json\n`),
            )
            console.error(
                '\n' +
                    pc.yellow(
                        '⚠️  Missing required answers in non-TTY environment.\n',
                    ) +
                    '\nMissing:\n' +
                    missing.map((m) => `  - ${m}`).join('\n') +
                    '\n\nExample command:\n' +
                    pc.dim(
                        `  npx create-harness-cli ${targetDir} --lang en --mode free --agents cursor --modules design-system,lint --storybook pending --component-declaration function\n`,
                    ) +
                    '\nOr use config file:\n' +
                    pc.dim(`  npx create-harness-cli ${targetDir} --config config.json\n`),
            )
            process.exit(1)
        }
    }

    const options = isTTY
        ? await runPrompts(detected, defaults, suggestions, explicitLang)
        : defaults

    // 감지 때문에 빠진 모듈은 이유를 남긴다
    const excluded = suggestions.filter(
        (suggestion) =>
            !suggestion.isRecommended &&
            !options.modules.includes(suggestion.module),
    )
    if (explicitModules === undefined && excluded.length > 0) {
        // Use localized reason messages
        const infoText = options.lang === 'en' ? 'Excluded modules based on detection:' : '감지 결과로 제외된 모듈:'
        console.log(`\n${pc.dim(infoText)}`)
        for (const suggestion of excluded) {
            const reasonText = options.lang ? getModuleReason(options.lang, suggestion.reason) : suggestion.reason
            console.log(
                `  ${pc.dim('-')} ${suggestion.module} — ${pc.dim(reasonText)}`,
            )
        }
        const includeText = options.lang === 'en' 
            ? `To include: --modules ${VALID_MODULES.join(',')}`
            : `포함하려면: --modules ${VALID_MODULES.join(',')}`
        console.log(
            pc.dim(`  ${includeText}`),
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

    const previousManifest = readManifest(targetDir)
    const results = writeActions(plan, targetDir, options.dryRun, previousManifest)
    writeManifest(results, options, getOwnVersion(), options.dryRun, previousManifest)

    const written = results.filter((result) => !result.placedInIncoming && !result.updated)
    const updated = results.filter((result) => result.updated)
    const incoming = results.filter((result) => result.placedInIncoming)

    const header = options.dryRun
        ? pc.yellow('[dry-run] 실제로 쓰지 않은 계획입니다')
        : pc.green('생성 완료')
    console.log(`\n${header} — ${detected.projectName} (${options.preset})`)
    for (const result of written) {
        console.log(`  ${pc.green('+')} ${result.dest}`)
    }
    if (updated.length > 0) {
        console.log(
            `\n${pc.cyan('업데이트')} — 이전 설치 이후 손대지 않은 하네스 파일을 새 버전으로 교체했습니다:`,
        )
        for (const result of updated) {
            console.log(`  ${pc.cyan('↻')} ${result.dest}`)
        }
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

    // Tailwind 자동 와이어링 (styling === 'tailwind')
    if (options.style.styling === 'tailwind' && !options.dryRun) {
        const twResult = patchTailwind(
            targetDir,
            options.modules.includes('design-system'),
        )
        
        if (twResult.indexCssPatched) {
            console.log(
                `\n${pc.green('Tailwind')} — ${twResult.indexCssPath} 에 @import "tailwindcss" 를 추가했습니다.`,
            )
        }
        
        if (twResult.viteConfigPatched && twResult.viteConfigPath) {
            console.log(
                `${pc.green('Tailwind')} — ${twResult.viteConfigPath} 에 @tailwindcss/vite 플러그인을 추가했습니다.`,
            )
        }
        
        if (twResult.errors.length > 0) {
            console.log(
                `\n${pc.yellow('Tailwind 수동 필요')} — 일부 자동 패치가 실패했습니다:\n` +
                    twResult.errors.map((e) => `  - ${e}`).join('\n') +
                    `\n\n  .harness/notes/tailwind-setup.md 를 참조하여 수동으로 설정하세요.`,
            )
        }
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
