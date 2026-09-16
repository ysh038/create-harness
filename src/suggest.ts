import type { IDetectResult, IModuleSuggestion, TModule } from './types.js'

/**
 * 감지 결과로 모듈 기본 선택값을 정한다.
 *
 * 기준은 하나다: **생성 직후 대상 프로젝트에서 그대로 컴파일·통과하는가.**
 * 참조 구현은 특정 라이브러리(axios·TanStack Query 등)를 전제하므로,
 * 그 전제가 없는 프로젝트에 기본으로 넣으면 typecheck가 즉시 깨진다.
 * 비추천이어도 사용자가 프롬프트나 --modules 로 직접 켤 수 있다.
 */
export const suggestModules = (detected: IDetectResult): IModuleSuggestion[] => [
    suggestDesignSystem(detected),
    suggestAuthHttp(detected),
    suggestDataFetching(detected),
    suggestLint(detected),
]

export const recommendedModules = (detected: IDetectResult): TModule[] =>
    suggestModules(detected)
        .filter((suggestion) => suggestion.isRecommended)
        .map((suggestion) => suggestion.module)

const suggestDesignSystem = (detected: IDetectResult): IModuleSuggestion => {
    // stylelint 색상 강제는 CSS 선언을 검사한다. Tailwind는 유틸리티 클래스라 검사 대상이
    // 거의 없고, CSS-in-JS는 값이 TS 안에 있어 stylelint가 아예 보지 못한다.
    // 강제할 수 없는데 켜두면 "지켜지고 있다"는 착각만 준다.
    if (detected.hasTailwind) {
        return {
            module: 'design-system',
            isRecommended: false,
            reason: 'tailwind-detected',
        }
    }
    if (detected.hasCssInJs) {
        return {
            module: 'design-system',
            isRecommended: false,
            reason: 'css-in-js-detected',
        }
    }
    return {
        module: 'design-system',
        isRecommended: true,
        reason: 'css-modules-detected',
    }
}

const suggestAuthHttp = (detected: IDetectResult): IModuleSuggestion => {
    const missing: string[] = []
    if (!detected.hasAxios) missing.push('axios')
    if (!detected.hasReactRouter) missing.push('react-router')
    if (missing.length > 0) {
        return {
            module: 'auth-http',
            isRecommended: false,
            reason: `missing-${missing.join('-')}`,
        }
    }
    if (!detected.isVite) {
        return {
            module: 'auth-http',
            isRecommended: false,
            reason: 'not-vite',
        }
    }
    return {
        module: 'auth-http',
        isRecommended: true,
        reason: 'auth-http-detected',
    }
}

const suggestDataFetching = (detected: IDetectResult): IModuleSuggestion => {
    const missing: string[] = []
    if (!detected.hasTanstackQuery) missing.push('@tanstack/react-query')
    if (!detected.hasZustand) missing.push('zustand')
    if (missing.length > 0) {
        return {
            module: 'data-fetching',
            isRecommended: false,
            reason: missing.includes('zustand') && missing.includes('@tanstack/react-query')
                ? 'missing-query-zustand'
                : missing.includes('zustand')
                  ? 'missing-zustand'
                  : 'missing-query',
        }
    }
    if (!detected.hasAxios) {
        return {
            module: 'data-fetching',
            isRecommended: false,
            reason: 'missing-axios-datafetch',
        }
    }
    return {
        module: 'data-fetching',
        isRecommended: true,
        reason: 'data-fetching-detected',
    }
}

const suggestLint = (detected: IDetectResult): IModuleSuggestion => {
    if (!detected.hasEslintFlatConfig) {
        return {
            module: 'lint',
            isRecommended: false,
            reason: 'no-flat-config',
        }
    }
    if (!detected.isTypeScript) {
        return {
            module: 'lint',
            isRecommended: false,
            reason: 'not-typescript',
        }
    }
    return {
        module: 'lint',
        isRecommended: true,
        reason: 'lint-detected',
    }
}
