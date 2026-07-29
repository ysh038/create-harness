import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 렌더러의 소스 루트는 templates/ 하나로 하드코딩한다.
 * 저장소 루트의 TODO.md·DECISIONS.md 같은 내부 기록이
 * 대상 프로젝트로 복사될 경로가 애초에 존재하지 않게 하기 위함이다.
 */
export const getTemplatesRoot = (): string =>
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates')

export const renderString = (
    content: string,
    vars: Record<string, string>,
): string =>
    content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) =>
        key in vars ? vars[key] : match,
    )

/** templates/ 기준 상대 경로의 템플릿을 읽어 변수 치환까지 마친 문자열을 돌려준다 */
export const loadTemplate = (
    relPath: string,
    vars: Record<string, string>,
): string =>
    renderString(readFileSync(path.join(getTemplatesRoot(), relPath), 'utf-8'), vars)

export interface IFrontmatterResult {
    meta: Record<string, string>
    body: string
}

/**
 * `---` 로 감싼 단순 frontmatter 파서.
 * `key: value` 한 줄 형식만 지원한다 (템플릿 정본에는 그 이상이 필요 없다).
 */
export const parseFrontmatter = (content: string): IFrontmatterResult => {
    const match = /^---\n([\s\S]*?)\n---\n?/.exec(content)
    if (!match) return { meta: {}, body: content }

    const meta: Record<string, string> = {}
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':')
        if (idx === -1) continue
        const key = line.slice(0, idx).trim()
        const value = line.slice(idx + 1).trim()
        if (key) meta[key] = value
    }
    return { meta, body: content.slice(match[0].length) }
}

export const serializeFrontmatter = (meta: Record<string, string>): string => {
    const lines = Object.entries(meta).map(([key, value]) => `${key}: ${value}`)
    return `---\n${lines.join('\n')}\n---\n`
}
