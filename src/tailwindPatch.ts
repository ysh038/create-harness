import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

/**
 * Tailwind CSS 자동 와이어링
 * 
 * 1. src/index.css 패치: @import "tailwindcss" 추가
 * 2. vite.config.ts 패치: @tailwindcss/vite plugin 추가
 */

interface ITailwindPatchResult {
    indexCssPatched: boolean
    indexCssPath: string
    viteConfigPatched: boolean
    viteConfigPath?: string
    errors: string[]
}

/**
 * src/index.css (또는 src/main.css) 패치
 * @import "tailwindcss"를 최상단에 추가
 */
export const patchIndexCss = (targetDir: string, hasDesignSystem: boolean): {
    patched: boolean
    path: string
    error?: string
} => {
    // 가능한 CSS 진입점 경로들
    const candidates = [
        path.join(targetDir, 'src', 'index.css'),
        path.join(targetDir, 'src', 'main.css'),
        path.join(targetDir, 'src', 'App.css'),
    ]

    let cssPath = candidates.find((p) => existsSync(p))
    
    // 없으면 src/index.css 생성
    if (!cssPath) {
        cssPath = candidates[0]
        const newContent = hasDesignSystem
            ? `@import "tailwindcss";\n@import "./design-system/tokens.css";\n`
            : `@import "tailwindcss";\n`
        
        try {
            writeFileSync(cssPath, newContent, 'utf-8')
            return { patched: true, path: cssPath }
        } catch (err) {
            return {
                patched: false,
                path: cssPath,
                error: `Failed to create ${cssPath}: ${err}`,
            }
        }
    }

    // 기존 파일 패치
    let content = readFileSync(cssPath, 'utf-8')
    
    // 이미 tailwindcss import가 있으면 패치 불필요
    if (content.includes('@import "tailwindcss"') || content.includes("@import 'tailwindcss'")) {
        return { patched: false, path: cssPath }
    }

    // 최상단에 @import "tailwindcss" 추가
    const tailwindImport = '@import "tailwindcss";\n'
    
    // design-system tokens import가 있는지 확인
    const hasTokensImport = content.includes('./design-system/tokens.css') ||
                           content.includes('../design-system/tokens.css')
    
    // tokens import가 없고 design-system 모듈이 있으면 추가
    if (hasDesignSystem && !hasTokensImport) {
        content = tailwindImport + '@import "./design-system/tokens.css";\n' + content
    } else {
        content = tailwindImport + content
    }

    try {
        writeFileSync(cssPath, content, 'utf-8')
        return { patched: true, path: cssPath }
    } catch (err) {
        return {
            patched: false,
            path: cssPath,
            error: `Failed to patch ${cssPath}: ${err}`,
        }
    }
}

/**
 * vite.config.ts 패치
 * @tailwindcss/vite plugin 추가
 */
export const patchViteConfig = (targetDir: string): {
    patched: boolean
    path?: string
    error?: string
} => {
    const viteConfigPath = path.join(targetDir, 'vite.config.ts')
    
    if (!existsSync(viteConfigPath)) {
        return {
            patched: false,
            error: 'vite.config.ts not found',
        }
    }

    let content = readFileSync(viteConfigPath, 'utf-8')
    
    // 이미 @tailwindcss/vite가 있으면 패치 불필요
    if (content.includes('@tailwindcss/vite') || content.includes('tailwindcss()')) {
        return { patched: false, path: viteConfigPath }
    }

    try {
        // 1. import 문 추가
        const importLine = "import tailwindcss from '@tailwindcss/vite'\n"
        
        // import 섹션 찾기 (첫 번째 import 문 이후에 추가)
        const importMatch = content.match(/^import\s+/m)
        if (importMatch && importMatch.index !== undefined) {
            // 마지막 import 문 이후에 추가
            const lastImportIndex = content.lastIndexOf('\nimport ')
            if (lastImportIndex !== -1) {
                const insertPos = content.indexOf('\n', lastImportIndex + 1) + 1
                content = content.slice(0, insertPos) + importLine + content.slice(insertPos)
            } else {
                // 첫 번째 import만 있으면 그 뒤에 추가
                const insertPos = content.indexOf('\n', importMatch.index) + 1
                content = content.slice(0, insertPos) + importLine + content.slice(insertPos)
            }
        } else {
            // import 문이 없으면 파일 맨 위에 추가
            content = importLine + content
        }

        // 2. plugins 배열에 tailwindcss() 추가
        // plugins: [react()] 패턴 찾기
        const pluginsMatch = content.match(/plugins:\s*\[([\s\S]*?)\]/m)
        if (pluginsMatch) {
            const pluginsContent = pluginsMatch[1]
            const pluginsStartIndex = pluginsMatch.index! + pluginsMatch[0].indexOf('[') + 1
            
            // tailwindcss()를 첫 번째 plugin으로 추가 (react보다 먼저)
            const newPluginsContent = pluginsContent.trimStart()
                ? `\n    tailwindcss(),${pluginsContent}`
                : '\n    tailwindcss(),\n  '
            
            content = 
                content.slice(0, pluginsStartIndex) +
                newPluginsContent +
                content.slice(pluginsStartIndex + pluginsContent.length)
        } else {
            // plugins 배열이 없으면 경고만 하고 넘어감
            return {
                patched: false,
                path: viteConfigPath,
                error: 'Could not find plugins array in vite.config.ts',
            }
        }

        writeFileSync(viteConfigPath, content, 'utf-8')
        return { patched: true, path: viteConfigPath }
    } catch (err) {
        return {
            patched: false,
            path: viteConfigPath,
            error: `Failed to patch vite.config.ts: ${err}`,
        }
    }
}

/**
 * Tailwind 와이어링 전체 수행
 */
export const patchTailwind = (
    targetDir: string,
    hasDesignSystem: boolean,
): ITailwindPatchResult => {
    const result: ITailwindPatchResult = {
        indexCssPatched: false,
        indexCssPath: '',
        viteConfigPatched: false,
        errors: [],
    }

    // 1. index.css 패치
    const cssResult = patchIndexCss(targetDir, hasDesignSystem)
    result.indexCssPatched = cssResult.patched
    result.indexCssPath = cssResult.path
    if (cssResult.error) {
        result.errors.push(cssResult.error)
    }

    // 2. vite.config.ts 패치
    const viteResult = patchViteConfig(targetDir)
    result.viteConfigPatched = viteResult.patched
    result.viteConfigPath = viteResult.path
    if (viteResult.error) {
        result.errors.push(viteResult.error)
    }

    return result
}
