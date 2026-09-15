import * as p from '@clack/prompts'

import { getMessages, type TLanguage } from './i18n.js'
import type {
    IDetectResult,
    IModuleSuggestion,
    IScaffoldOptions,
    TAgent,
    TModule,
    TDesignMode,
    TComponentDeclaration,
    TStyling,
} from './types.js'

const MODULE_ORDER: TModule[] = [
    'design-system',
    'auth-http',
    'data-fetching',
    'lint',
]

export const runPrompts = async (
    detected: IDetectResult,
    defaults: IScaffoldOptions,
    suggestions: IModuleSuggestion[],
    explicitLang?: TLanguage,
): Promise<IScaffoldOptions> => {
    // 1. Language selection first (if not already specified via --lang)
    let lang: TLanguage = explicitLang ?? 'ko'
    if (!explicitLang) {
        const langChoice = (await p.select({
            message: '어떤 언어로 설치를 진행할까요? / Which language would you like to use for installation?',
            options: [
                { value: 'ko' as const, label: '한국어 (Korean)' },
                { value: 'en' as const, label: 'English' },
            ],
            initialValue: 'ko' as const,
        })) as TLanguage
        if (p.isCancel(langChoice)) {
            p.cancel(lang === 'ko' ? '취소되었습니다.' : 'Operation cancelled.')
            process.exit(1)
        }
        lang = langChoice
    }

    const msg = getMessages(lang)
    p.intro(msg.intro)

    const detectedFeatures = [
        detected.isReact ? 'React' : null,
        detected.isVite ? 'Vite' : null,
        detected.isTypeScript ? 'TypeScript' : null,
        detected.hasAxios ? 'axios' : null,
        detected.hasTanstackQuery ? 'TanStack Query' : null,
        detected.hasZustand ? 'Zustand' : null,
        detected.hasTailwind ? 'Tailwind' : null,
        detected.hasCssInJs ? 'CSS-in-JS' : null,
    ]
        .filter(Boolean)
        .join(' · ')

    p.log.info(msg.projectInfo(detected.projectName, detectedFeatures))

    if (detected.existingAgentFiles.length > 0) {
        p.log.warn(msg.existingFilesWarning(detected.existingAgentFiles.join(', ')))
    }

    // 2. 프로젝트 디자인 모드
    const mode = (await p.select({
        message: msg.modePrompt,
        options: [
            {
                value: 'free',
                label: msg.modeFree,
                hint: msg.modeFreeHint,
            },
            {
                value: 'inspire',
                label: msg.modeInspire,
                hint: msg.modeInspireHint,
            },
            {
                value: 'implement',
                label: msg.modeImplement,
                hint: msg.modeImplementHint,
            },
        ],
        initialValue: defaults.mode,
    })) as TDesignMode
    if (p.isCancel(mode)) {
        p.cancel(msg.cancelled)
        process.exit(1)
    }

    // 3. 코딩 스타일 — 컴포넌트 선언 방식
    let componentDeclaration: TComponentDeclaration = defaults.style.componentDeclaration
    if (!detected.isReact) {
        // React가 아니면 물어보지 않고 기본값 사용
    } else {
        const declChoice = (await p.select({
            message: msg.componentDeclPrompt,
            options: [
                { value: 'function', label: msg.componentDeclFunction },
                { value: 'arrow', label: msg.componentDeclArrow },
            ],
            initialValue: componentDeclaration,
        })) as TComponentDeclaration
        if (p.isCancel(declChoice)) {
            p.cancel(msg.cancelled)
            process.exit(1)
        }
        componentDeclaration = declChoice
    }

    // Component export: use default, don't ask (v0.5.0 UX improvement)
    const componentExport = defaults.style.componentExport

    // 4. 코딩 스타일 — 스타일링 (감지되지 않은 경우에만)
    let styling: TStyling = defaults.style.styling
    if (detected.hasTailwind) {
        styling = 'tailwind'
    } else if (detected.hasCssInJs) {
        styling = 'detected'
    } else if (detected.hasCssModules) {
        styling = 'css-modules'
    } else {
        // Tailwind, CSS-in-JS, CSS Modules 모두 감지되지 않음 — 물어봄
        const styleChoice = (await p.select({
            message: msg.stylingPrompt,
            options: [
                { value: 'css', label: msg.stylingCss },
                { value: 'css-modules', label: msg.stylingCssModules },
                { value: 'tailwind', label: msg.stylingTailwind },
            ],
            initialValue: styling === 'detected' ? 'css' : styling,
        })) as TStyling
        if (p.isCancel(styleChoice)) {
            p.cancel(msg.cancelled)
            process.exit(1)
        }
        styling = styleChoice
    }

    const agents = await p.multiselect<TAgent>({
        message: msg.agentsPrompt,
        options: [
            { value: 'cursor', label: 'Cursor' },
            { value: 'claude', label: 'Claude Code' },
        ],
        initialValues: defaults.agents,
        required: true,
    })
    if (p.isCancel(agents)) {
        p.cancel(msg.cancelled)
        process.exit(1)
    }

    const suggestionByModule = new Map(
        suggestions.map((suggestion) => [suggestion.module, suggestion]),
    )

    const MODULE_LABELS = {
        'design-system': msg.moduleDesignSystem,
        'auth-http': msg.moduleAuthHttp,
        'data-fetching': msg.moduleDataFetching,
        lint: msg.moduleLint,
    }

    p.log.info(msg.modulesInfo)

    const modules = await p.multiselect<TModule>({
        message: msg.modulesPrompt,
        options: MODULE_ORDER.map((module) => {
            const suggestion = suggestionByModule.get(module)
            const mark = suggestion?.isRecommended ? '' : ` ${msg.moduleNotRecommended}`
            return {
                value: module,
                label: `${module}${mark}`,
                hint: suggestion
                    ? `${MODULE_LABELS[module]} — ${suggestion.reason}`
                    : MODULE_LABELS[module],
            }
        }),
        initialValues: defaults.modules,
        required: false,
    })
    if (p.isCancel(modules)) {
        p.cancel(msg.cancelled)
        process.exit(1)
    }

    // design-system 모듈 선택 시에만 Storybook 질문
    let storybook: 'off' | 'pending' | 'ready' = 'off'
    if (modules.includes('design-system')) {
        p.log.info(msg.storybookInfo)
        const useStorybook = await p.confirm({
            message: msg.storybookPrompt,
            initialValue: true,
        })
        if (p.isCancel(useStorybook)) {
            p.cancel(msg.cancelled)
            process.exit(1)
        }
        storybook = useStorybook ? 'pending' : 'off'
    }

    // ponytail: don't ask, use default (v0.5.0 UX improvement)
    const ponytail = defaults.ponytail

    return {
        ...defaults,
        agents,
        modules,
        storybook,
        ponytail,
        mode,
        fidelity: mode === 'free' ? null : mode === 'inspire' ? 'inspire' : 'match',
        style: {
            componentDeclaration,
            componentExport,
            styling,
        },
        figmaUrl: defaults.figmaUrl,
        acceptDisclaimer: defaults.acceptDisclaimer,
        lang,
    }
}
