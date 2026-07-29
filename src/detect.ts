import { existsSync, readdirSync, readFileSync, type Dirent } from 'node:fs'
import path from 'node:path'

import type { IDetectResult, TPackageManager } from './types.js'

const detectPackageManager = (targetDir: string): TPackageManager => {
    if (existsSync(path.join(targetDir, 'pnpm-lock.yaml'))) return 'pnpm'
    if (existsSync(path.join(targetDir, 'yarn.lock'))) return 'yarn'
    if (existsSync(path.join(targetDir, 'bun.lock'))) return 'bun'
    if (existsSync(path.join(targetDir, 'bun.lockb'))) return 'bun'
    return 'npm'
}

const ESLINT_FLAT_CONFIG_CANDIDATES = [
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
    'eslint.config.cts',
]

const CSS_IN_JS_PACKAGES = [
    'styled-components',
    '@emotion/styled',
    '@emotion/react',
    '@stitches/react',
    '@vanilla-extract/css',
]

/** 선언부의 색상 원시값 — 토큰 강제를 곧바로 error로 켰을 때 걸릴 것들 */
const RAW_COLOR_PATTERN =
    /(?:color|fill|stroke|background|border-color|outline-color)[^;{}]*:[^;{}]*(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/

/**
 * src/ 안에서 색상 원시값을 쓰는 기존 CSS 파일을 찾는다.
 * 기존 프로젝트에 토큰 강제를 error로 얹으면 첫 커밋부터 수백 건이 막혀
 * 게이트를 꺼버리게 된다 — 이 목록이 stylelint 유예(baseline) 대상이 된다.
 */
const findCssFilesWithRawColor = (targetDir: string): string[] => {
    const srcDir = path.join(targetDir, 'src')
    if (!existsSync(srcDir)) return []

    const found: string[] = []
    const MAX_FILES_SCANNED = 2000
    let scanned = 0

    const walk = (dir: string): void => {
        if (scanned >= MAX_FILES_SCANNED) return
        let entries: Dirent[]
        try {
            entries = readdirSync(dir, { withFileTypes: true })
        } catch {
            return
        }
        for (const entry of entries) {
            if (scanned >= MAX_FILES_SCANNED) return
            if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                continue
            }
            const full = path.join(dir, entry.name)
            if (entry.isDirectory()) {
                walk(full)
            } else if (entry.name.endsWith('.css')) {
                scanned += 1
                try {
                    if (RAW_COLOR_PATTERN.test(readFileSync(full, 'utf-8'))) {
                        found.push(
                            path.relative(targetDir, full).split(path.sep).join('/'),
                        )
                    }
                } catch {
                    // 읽을 수 없는 파일은 없는 것으로 취급
                }
            }
        }
    }

    walk(srcDir)
    return found.sort()
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
        hasAxios: 'axios' in deps,
        hasReactRouter: 'react-router-dom' in deps || 'react-router' in deps,
        hasTanstackQuery:
            '@tanstack/react-query' in deps || 'react-query' in deps,
        hasZustand: 'zustand' in deps,
        hasTailwind: 'tailwindcss' in deps,
        hasCssInJs: CSS_IN_JS_PACKAGES.some((pkg) => pkg in deps),
        hasEslintFlatConfig: ESLINT_FLAT_CONFIG_CANDIDATES.some((candidate) =>
            existsSync(path.join(targetDir, candidate)),
        ),
        eslintConfigFile: ESLINT_FLAT_CONFIG_CANDIDATES.find((candidate) =>
            existsSync(path.join(targetDir, candidate)),
        ),
        cssFilesWithRawColor: findCssFilesWithRawColor(targetDir),
        scripts,
        existingAgentFiles,
    }
}
