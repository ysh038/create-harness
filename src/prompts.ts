import * as p from '@clack/prompts'

import type { IDetectResult, IScaffoldOptions, TAgent, TModule } from './types.js'

const ALL_MODULES: { value: TModule; label: string; hint: string }[] = [
    {
        value: 'design-system',
        label: 'design-system',
        hint: '토큰 스켈레톤 + stylelint(색상 원시값 차단) + 스토리 템플릿',
    },
    {
        value: 'auth-http',
        label: 'auth-http',
        hint: 'axios 인터셉터(토큰 첨부·401 처리) + ProtectedRoute 참조 구현',
    },
    {
        value: 'data-fetching',
        label: 'data-fetching',
        hint: 'queries 3계층 샘플 + IApiResponse 래퍼 + Zustand 모달 스토어',
    },
    {
        value: 'lint',
        label: 'lint',
        hint: 'naming-convention·import 경계 ESLint 조각 + prettier + commitlint',
    },
]

export const runPrompts = async (
    detected: IDetectResult,
    defaults: IScaffoldOptions,
): Promise<IScaffoldOptions> => {
    if (defaults.yes) return defaults

    p.intro('create-harness')

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

    const modules = await p.multiselect<TModule>({
        message: '어떤 모듈을 포함하나요? (코어 규칙·워크플로·게이트는 항상 포함)',
        options: ALL_MODULES,
        initialValues: defaults.modules,
        required: false,
    })
    if (p.isCancel(modules)) {
        p.cancel('취소되었습니다.')
        process.exit(1)
    }

    return { ...defaults, agents, modules }
}
