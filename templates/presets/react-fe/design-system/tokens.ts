/**
 * tokens.css 의 타입드 미러 — TS/JSX에서 토큰 값이 필요할 때 이 상수를 import한다.
 * (예: 차트 라이브러리 색상 배열, canvas 렌더링)
 * 문자열 하드코딩 금지. tokens.css 에 변수를 추가하면 여기도 함께 추가한다.
 */
export const colorTokens = {
    primary: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    secondary: 'var(--color-secondary)',
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    border: 'var(--color-border)',
    text: 'var(--color-text)',
    textMuted: 'var(--color-text-muted)',
    textInverse: 'var(--color-text-inverse)',
    success: 'var(--color-success)',
    warning: 'var(--color-warning)',
    error: 'var(--color-error)',
    info: 'var(--color-info)',
} as const

export const spaceTokens = {
    1: 'var(--space-1)',
    2: 'var(--space-2)',
    3: 'var(--space-3)',
    4: 'var(--space-4)',
    6: 'var(--space-6)',
    8: 'var(--space-8)',
} as const

export const radiusTokens = {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
    full: 'var(--radius-full)',
} as const

export type TColorToken = keyof typeof colorTokens
export type TSpaceToken = keyof typeof spaceTokens
export type TRadiusToken = keyof typeof radiusTokens
