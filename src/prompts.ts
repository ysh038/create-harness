import * as p from '@clack/prompts'

import type {
    IDetectResult,
    IModuleSuggestion,
    IScaffoldOptions,
    TAgent,
    TModule,
} from './types.js'

const MODULE_LABELS: Record<TModule, string> = {
    'design-system':
        '토큰 스켈레톤 + stylelint(색상 원시값 차단) + 스토리 템플릿',
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

    const modules = await p.multiselect<TModule>({
        message:
            '어떤 모듈을 포함하나요? (코어 규칙·워크플로·게이트는 항상 포함)',
        options: MODULE_ORDER.map((module) => {
            const suggestion = suggestionByModule.get(module)
            const mark = suggestion?.isRecommended ? '' : ' (비권장)'
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

    return { ...defaults, agents, modules, ponytail }
}
