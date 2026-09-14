import * as p from '@clack/prompts'

import type {
    IDetectResult,
    IModuleSuggestion,
    IScaffoldOptions,
    TAgent,
    TModule,
    TDesignMode,
    TComponentDeclaration,
    TComponentExport,
    TStyling,
} from './types.js'

const MODULE_LABELS: Record<TModule, string> = {
    'design-system':
        '토큰 스켈레톤 + stylelint(색상 원시값 차단) + Atomic 계층 규칙 + 스토리 템플릿',
    'auth-http': 'axios 인터셉터(토큰 첨부·refresh·401) + ProtectedRoute',
    'data-fetching': 'queries 3계층 샘플 + IApiResponse + Zustand 스토어',
    lint: '명명 규칙·import 경계 ESLint 조각 + prettier + commitlint',
}

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
): Promise<IScaffoldOptions> => {
    if (defaults.yes) return defaults

    p.intro('create-harness')

    p.log.info(
        [
            `프로젝트: ${detected.projectName}`,
            `감지: ${[
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
                .join(' · ')}`,
        ].join('\n'),
    )

    if (detected.existingAgentFiles.length > 0) {
        p.log.warn(
            `이미 존재하는 에이전트 파일: ${detected.existingAgentFiles.join(', ')}\n` +
                '내용이 다른 파일은 덮어쓰지 않고 .harness/incoming/ 아래에 둡니다.',
        )
    }

    // 1. 프로젝트 디자인 모드
    const mode = (await p.select({
        message: '이 프로젝트는 어떤 작업을 하나요?',
        options: [
            {
                value: 'free',
                label: '자유롭게 만들기',
                hint: '디자인 참조 없이 구현 — 에이전트가 자율 디자인',
            },
            {
                value: 'inspire',
                label: '참고해서 만들기',
                hint: '디자인을 영감으로 활용 — 재해석 허용',
            },
            {
                value: 'implement',
                label: '회사 일, 피그마 화면 맞추기',
                hint: '제공된 디자인과 최대한 일치 — 자유로운 재디자인 금지',
            },
        ],
        initialValue: defaults.mode,
    })) as TDesignMode
    if (p.isCancel(mode)) {
        p.cancel('취소되었습니다.')
        process.exit(1)
    }

    // 2. 코딩 스타일 — 컴포넌트 선언 방식
    let componentDeclaration: TComponentDeclaration = defaults.style.componentDeclaration
    if (!detected.isReact) {
        // React가 아니면 물어보지 않고 기본값 사용
    } else {
        const declChoice = (await p.select({
            message: '컴포넌트를 어떻게 선언하나요?',
            options: [
                { value: 'function', label: 'function 키워드 (function Button() {})' },
                { value: 'arrow', label: '화살표 함수 (const Button = () => {})' },
            ],
            initialValue: componentDeclaration,
        })) as TComponentDeclaration
        if (p.isCancel(declChoice)) {
            p.cancel('취소되었습니다.')
            process.exit(1)
        }
        componentDeclaration = declChoice
    }

    // 3. 코딩 스타일 — export 방식
    let componentExport: TComponentExport = defaults.style.componentExport
    const exportChoice = (await p.select({
        message: '컴포넌트를 어떻게 export 하나요?',
        options: [
            { value: 'default', label: 'export default Button' },
            { value: 'named', label: 'export { Button }' },
        ],
        initialValue: componentExport,
    })) as TComponentExport
    if (p.isCancel(exportChoice)) {
        p.cancel('취소되었습니다.')
        process.exit(1)
    }
    componentExport = exportChoice

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
            message: '스타일을 어떻게 작성하나요?',
            options: [
                { value: 'css', label: '일반 CSS (App.css, index.css 등)' },
                { value: 'css-modules', label: 'CSS Modules (.module.css)' },
                { value: 'tailwind', label: 'Tailwind CSS (유틸리티 클래스)' },
            ],
            initialValue: styling === 'detected' ? 'css' : styling,
        })) as TStyling
        if (p.isCancel(styleChoice)) {
            p.cancel('취소되었습니다.')
            process.exit(1)
        }
        styling = styleChoice
    }

    const agents = await p.multiselect<TAgent>({
        message: '어떤 에이전트를 대상으로 하나요?',
        options: [
            { value: 'cursor', label: 'Cursor' },
            { value: 'claude', label: 'Claude Code' },
        ],
        initialValues: defaults.agents,
        required: true,
    })
    if (p.isCancel(agents)) {
        p.cancel('취소되었습니다.')
        process.exit(1)
    }

    const suggestionByModule = new Map(
        suggestions.map((suggestion) => [suggestion.module, suggestion]),
    )

    p.log.info(
        [
            '모듈 선택 기준: 설치 직후 컴파일·검증을 통과할 수 있는 모듈만 기본 선택됩니다.',
            '비권장 모듈을 포함하면 필요한 의존성이 없어 컴파일이 깨질 수 있습니다.',
        ].join('\n'),
    )

    const modules = await p.multiselect<TModule>({
        message:
            '어떤 모듈을 포함하나요? (코어 규칙·워크플로·게이트는 항상 포함)',
        options: MODULE_ORDER.map((module) => {
            const suggestion = suggestionByModule.get(module)
            const mark = suggestion?.isRecommended ? '' : ' ⚠️  비권장'
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
        p.cancel('취소되었습니다.')
        process.exit(1)
    }

    // design-system 모듈 선택 시에만 Storybook 질문
    let storybook: 'off' | 'pending' | 'ready' = 'off'
    if (modules.includes('design-system')) {
        p.log.info(
            [
                'Storybook — 컴포넌트 스토리·접근성·시각 회귀 검증 도구.',
                '지금 설치하지 않고 의향만 기록하면, /ds-init 워크플로가 나중에 설치합니다.',
            ].join('\n'),
        )
        const useStorybook = await p.confirm({
            message: 'Storybook을 사용할 계획인가요?',
            initialValue: true,
        })
        if (p.isCancel(useStorybook)) {
            p.cancel('취소되었습니다.')
            process.exit(1)
        }
        storybook = useStorybook ? 'pending' : 'off'
    }

    p.log.info(
        [
            'ponytail — 이 하네스와 무관한 서드파티 규칙(YAGNI 사다리, 최소 구현 강제).',
            'Cursor: 최신 릴리스에서 규칙 파일을 받아 자동 설치합니다.',
            'Claude Code: 플러그인 설치 명령 두 줄을 마지막에 안내합니다 (직접 실행 필요).',
        ].join('\n'),
    )
    const ponytail = await p.confirm({
        message: 'ponytail도 함께 설정할까요?',
        initialValue: defaults.ponytail,
    })
    if (p.isCancel(ponytail)) {
        p.cancel('취소되었습니다.')
        process.exit(1)
    }

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
    }
}
