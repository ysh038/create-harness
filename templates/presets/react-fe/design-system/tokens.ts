/**
 * tokens.css 의 타입드 미러 — TS/JSX에서 토큰 값이 필요할 때 이 상수를 import한다.
 * (예: 차트 라이브러리 색상 배열, canvas 렌더링)
 * 문자열 하드코딩 금지. tokens.css 에 변수를 추가하면 여기도 함께 추가한다.
 *
 * semanticColorTokens 만 컴포넌트에서 쓴다. primitive 램프는 tokens.css 안에서만
 * 참조되고 TS로는 노출하지 않는다 — TS 코드가 램프를 직접 참조하면 브랜드 교체 시
 * 여기도 다 고쳐야 해서, semantic 계층을 두는 의미가 없어진다.
 */
export const semanticColorTokens = {
    primary: 'var(--color-primary)',
    primaryHover: 'var(--color-primary-hover)',
    primaryPressed: 'var(--color-primary-pressed)',
    primarySubtle: 'var(--color-primary-subtle)',
    onPrimary: 'var(--color-on-primary)',
    secondary: 'var(--color-secondary)',
    secondaryHover: 'var(--color-secondary-hover)',
    background: 'var(--color-background)',
    surface: 'var(--color-surface)',
    surfaceHover: 'var(--color-surface-hover)',
    border: 'var(--color-border)',
    borderStrong: 'var(--color-border-strong)',
    text: 'var(--color-text)',
    textMuted: 'var(--color-text-muted)',
    textDisabled: 'var(--color-text-disabled)',
    textInverse: 'var(--color-text-inverse)',
    successSubtle: 'var(--color-success-subtle)',
    success: 'var(--color-success)',
    successStrong: 'var(--color-success-strong)',
    warningSubtle: 'var(--color-warning-subtle)',
    warning: 'var(--color-warning)',
    warningStrong: 'var(--color-warning-strong)',
    dangerSubtle: 'var(--color-danger-subtle)',
    danger: 'var(--color-danger)',
    dangerStrong: 'var(--color-danger-strong)',
    infoSubtle: 'var(--color-info-subtle)',
    info: 'var(--color-info)',
    infoStrong: 'var(--color-info-strong)',
} as const

export const focusRingTokens = {
    color: 'var(--focus-ring-color)',
    width: 'var(--focus-ring-width)',
    offset: 'var(--focus-ring-offset)',
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

/** 사용 기준(어떤 계층에 어떤 그림자인지)은 30-design-system.md 참고 */
export const shadowTokens = {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
} as const

/** duration/easing 조합 사용 기준은 30-design-system.md 참고 */
export const motionTokens = {
    durationFast: 'var(--duration-fast)',
    durationBase: 'var(--duration-base)',
    durationSlow: 'var(--duration-slow)',
    easingStandard: 'var(--easing-standard)',
    easingDecelerate: 'var(--easing-decelerate)',
    easingAccelerate: 'var(--easing-accelerate)',
} as const

export type TSemanticColorToken = keyof typeof semanticColorTokens
export type TFocusRingToken = keyof typeof focusRingTokens
export type TSpaceToken = keyof typeof spaceTokens
export type TRadiusToken = keyof typeof radiusTokens
export type TShadowToken = keyof typeof shadowTokens
export type TMotionToken = keyof typeof motionTokens
