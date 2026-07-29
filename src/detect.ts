import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import type { IDetectResult, TPackageManager } from './types.js'

const detectPackageManager = (targetDir: string): TPackageManager => {
    if (existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(path.join(targetDir, 'yarn.lock'))) return 'yarn'
    if (existsSync(path.join(targetDir, 'bun.lock'))) return 'bun'
    if (existsSync(path.join(targetDir, 'bun.lockb'))) return 'bun'
    return 'npm'
}

const AGENT_FILE_CANDIDATES = [
    'AGENTS.md',
    'CLAUDE.md',
    '.cursor/rules',
    '.cursor/hooks.json',
    '.claude/settings.json',
    '.claude/skills',
    '.harness',
]

export const detect = (targetDir: string): IDetectResult => {
    const pkgPath = path.join(targetDir, 'package.json')
    const hasPackageJson = existsSync(pkgPath)

    let projectName = path.basename(path.resolve(targetDir))
    let scripts: Record<string, string> = {}
    let deps: Record<string, string> = {}

    if (hasPackageJson) {
        try {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
                name?: string
                scripts?: Record<string, string>
                dependencies?: Record<string, string>
                devDependencies?: Record<string, string>
            }
            if (pkg.name) projectName = pkg.name
            scripts = pkg.scripts ?? {}
            deps = { ...pkg.dependencies, ...pkg.devDependencies }
        } catch {
            // 깨진 package.json은 없는 것으로 취급
        }
    }

    const existingAgentFiles = AGENT_FILE_CANDIDATES.filter((candidate) =>
        existsSync(path.join(targetDir, candidate)),
    )

    return {
        targetDir,
        hasPackageJson,
        projectName,
        packageManager: detectPackageManager(targetDir),
        isReact: 'react' in deps,
        isVite: 'vite' in deps,
        isTypeScript:
            'typescript' in deps ||
            existsSync(path.join(targetDir, 'tsconfig.json')),
        scripts,
        existingAgentFiles,
    }
}
