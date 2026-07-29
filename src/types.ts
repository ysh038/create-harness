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
    scripts: Record<string, string>
    /** 이미 존재하는 에이전트 관련 파일 (충돌 안내용) */
    existingAgentFiles: string[]
}

export interface ICheck {
    id: string
    command: string
}

export interface IHarnessConfig {
    packageManager: TPackageManager
    checks: ICheck[]
}

export interface IScaffoldOptions {
    targetDir: string
    preset: 'react-fe'
    agents: TAgent[]
    modules: TModule[]
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
