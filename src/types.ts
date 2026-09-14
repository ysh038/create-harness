export type TPackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun'

export type TAgent = 'cursor' | 'claude'

export type TModule = 'design-system' | 'auth-http' | 'data-fetching' | 'lint'

export interface IDetectResult {
    targetDir: string
    hasPackageJson: boolean
    projectName: string
    packageManager: TPackageManager
    isReact: boolean
    isVite: boolean
    isTypeScript: boolean
    /** 참조 구현이 전제하는 라이브러리들 — 모듈 기본 선택값 판단에 쓴다 */
    hasAxios: boolean
    hasReactRouter: boolean
    hasTanstackQuery: boolean
    hasZustand: boolean
    /** Tailwind·CSS-in-JS 는 stylelint 토큰 강제가 무의미하거나 어긋난다 */
    hasTailwind: boolean
    hasCssInJs: boolean
    /** 하네스 lint 조각은 flat config 전용 */
    hasEslintFlatConfig: boolean
    /** 발견된 flat config 파일명 (ignores 자동 패치 대상) */
    eslintConfigFile?: string
    /** 색상 원시값을 쓰는 기존 CSS 파일 — stylelint 유예(baseline) 대상 */
    cssFilesWithRawColor: string[]
    /** 페이지/라우트에서 raw intrinsic elements 사용 — Atomic baseline 대상 */
    pagesWithRawJsx: string[]
    scripts: Record<string, string>
    /** 이미 존재하는 에이전트 관련 파일 (충돌 안내용) */
    existingAgentFiles: string[]
}

export interface IModuleSuggestion {
    module: TModule
    /** 기본 선택 여부 — 대상 스택에서 바로 컴파일·통과하는 모듈만 true */
    isRecommended: boolean
    /** 추천/비추천 근거 (프롬프트 힌트와 --yes 안내에 노출) */
    reason: string
}

export interface ICheck {
    id: string
    command: string
}

export type TStorybookState = 'off' | 'pending' | 'ready'

export interface IHarnessConfig {
    packageManager: TPackageManager
    checks: ICheck[]
    storybook: TStorybookState
}

export interface IScaffoldOptions {
    targetDir: string
    preset: 'react-fe'
    agents: TAgent[]
    modules: TModule[]
    /** 서드파티 ponytail 규칙(YAGNI 사다리) 연동 여부 — 코어 4모듈과 별도 축이다 */
    ponytail: boolean
    /** Storybook 사용 의향 — CLI 설치 시 결정 */
    storybook: TStorybookState
    dryRun: boolean
    yes: boolean
    install: boolean
}

export interface IFileAction {
    /** 대상 프로젝트 루트 기준 상대 경로 */
    dest: string
    content: string
    /** 이 파일을 만든 모듈 (core | design-system | ...) */
    module: string
    executable?: boolean
}

export interface IWriteResult {
    dest: string
    /** 충돌로 .harness/incoming/ 아래에 배치되었는지 */
    placedInIncoming: boolean
    sha256: string
    module: string
}

export interface IManifest {
    version: string
    createdAt: string
    preset: string
    agents: TAgent[]
    modules: TModule[]
    files: {
        path: string
        sha256: string
        module: string
    }[]
}
