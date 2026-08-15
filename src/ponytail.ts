import type { IFileAction } from './types.js'

const REPO = 'DietrichGebert/ponytail'
const RULE_PATH = '.cursor/rules/ponytail.mdc'
const FETCH_TIMEOUT_MS = 5000

export interface IPonytailFetchResult {
    action: IFileAction
    tag: string
}

const withTimeout = async (
    fetchImpl: typeof fetch,
    url: string,
    init?: RequestInit,
): Promise<Response> => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
        return await fetchImpl(url, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

/**
 * GitHub Releases API로 최신 릴리스 태그를 찾는다.
 * main 브랜치를 그대로 받으면 재실행마다 결과가 달라져 이 CLI가 지키는
 * 멱등성 원칙과 어긋난다 — 태그에 고정해 같은 버전을 반복 재현한다.
 */
export const fetchLatestPonytailTag = async (
    fetchImpl: typeof fetch = fetch,
): Promise<string> => {
    const res = await withTimeout(
        fetchImpl,
        `https://api.github.com/repos/${REPO}/releases/latest`,
        { headers: { Accept: 'application/vnd.github+json' } },
    )
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const body = (await res.json()) as { tag_name?: string }
    if (!body.tag_name) throw new Error('tag_name 없음')
    return body.tag_name
}

/** 고정된 릴리스 태그에서 Cursor 규칙 파일 원문을 받는다 (벤더링이 아니라 실행 시점 fetch) */
export const fetchPonytailCursorRule = async (
    tag: string,
    fetchImpl: typeof fetch = fetch,
): Promise<string> => {
    const res = await withTimeout(
        fetchImpl,
        `https://raw.githubusercontent.com/${REPO}/${tag}/${RULE_PATH}`,
    )
    if (!res.ok) throw new Error(`raw.githubusercontent.com ${res.status}`)
    return res.text()
}

/**
 * ponytail의 Cursor 규칙 파일을 최신 릴리스에서 받아 IFileAction으로 돌려준다.
 * 네트워크·API 실패는 여기서 흡수하고 null을 돌려준다 — 호출부는 실패해도
 * 스캐폴딩 전체를 막지 않고 수동 설치 안내로 폴백해야 하기 때문이다.
 */
export const buildPonytailAction = async (
    fetchImpl: typeof fetch = fetch,
): Promise<IPonytailFetchResult | null> => {
    try {
        const tag = await fetchLatestPonytailTag(fetchImpl)
        const content = await fetchPonytailCursorRule(tag, fetchImpl)
        return {
            tag,
            action: {
                dest: RULE_PATH,
                content,
                module: 'ponytail',
            },
        }
    } catch {
        return null
    }
}
