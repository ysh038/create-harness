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
            reason: 'Tailwind 감지 — 토큰 강제가 불가능합니다 (하네스는 CSS Modules + 토큰을 권장)',
        }
    }
    if (detected.hasCssInJs) {
        return {
            module: 'design-system',
            isRecommended: false,
            reason: 'CSS-in-JS 감지 — 색상값이 TS 안에 있어 stylelint가 검사하지 못합니다',
        }
    }
    return {
        module: 'design-system',
        isRecommended: true,
        reason: 'CSS / CSS Modules 프로젝트로 판단',
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
            reason: `${missing.join('·')} 없음 — 참조 구현이 컴파일되지 않습니다`,
        }
    }
    if (!detected.isVite) {
        return {
            module: 'auth-http',
            isRecommended: false,
            reason: 'Vite 아님 — 참조 구현이 import.meta.env.VITE_* 를 씁니다',
        }
    }
    return {
        module: 'auth-http',
        isRecommended: true,
        reason: 'axios + react-router + Vite 감지',
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
            reason: `${missing.join('·')} 없음 — 참조 구현이 컴파일되지 않습니다`,
        }
    }
    if (!detected.hasAxios) {
        return {
            module: 'data-fetching',
            isRecommended: false,
            reason: 'axios 없음 — queries 샘플이 axiosInstance 를 씁니다',
        }
    }
    return {
        module: 'data-fetching',
        isRecommended: true,
        reason: 'TanStack Query + Zustand 감지',
    }
}

const suggestLint = (detected: IDetectResult): IModuleSuggestion => {
    if (!detected.hasEslintFlatConfig) {
        return {
            module: 'lint',
            isRecommended: false,
            reason: 'ESLint flat config(eslint.config.*) 없음 — 규칙 조각을 spread할 대상이 없습니다',
        }
    }
    if (!detected.isTypeScript) {
        return {
            module: 'lint',
            isRecommended: false,
            reason: 'TypeScript 아님 — 명명 규칙이 타입 정보를 요구합니다',
        }
    }
    return {
        module: 'lint',
        isRecommended: true,
        reason: 'ESLint flat config + TypeScript 감지',
    }
}
