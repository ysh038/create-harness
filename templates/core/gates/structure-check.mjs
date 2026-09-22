#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * structure-check.mjs — 구조 흐트러짐 점검 (0.7.0)
 *
 * 바이브코딩으로 작은 수정이 쌓이면서 생기는 세 가지 흐트러짐을 찾는다:
 *  1. 페이지 비대화 — 페이지에 기본 태그·원시 컨트롤·꾸밈 CSS가 늘어남
 *  2. atom 비대화 — atom이 다른 atom을 조합하거나, props·줄 수가 기준을 넘음
 *  3. 부품 중복 — 새 부품 이름이 기존 부품과 비슷함 (같은 끝단어·동의어·오타 수준 차이)
 *
 * 전부 경고다. 차단하지 않는다 — 판단이 필요한 영역이라 사람이/에이전트가 보고 결정한다.
 *
 * 사용:
 *  - gate.mjs 가 커밋 시 staged 파일 기준으로 호출 (collectStagedStructureWarnings)
 *  - 직접 실행: node .harness/gates/structure-check.mjs  → 프로젝트 전체 점검 리포트
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** config.json 의 structure 로 조정 가능 */
export const DEFAULT_STRUCTURE_OPTIONS = {
    atomMaxProps: 8,
    atomMaxLines: 150,
    pageRawTagGrowth: 3,
}

export function loadStructureOptions(config) {
    return { ...DEFAULT_STRUCTURE_OPTIONS, ...(config?.structure ?? {}) }
}

const PAGE_PATTERNS = [
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
]
const PAGE_STYLE_PATTERNS = [
    /^src\/(pages|routes)\/.*\.(css|scss|sass|less)$/,
    /^src\/app\/.*\/page(\.module)?\.(css|scss|sass|less)$/,
    /^src\/.*Page(\.module)?\.(css|scss|sass|less)$/,
]
const EXCLUDED = [/\.stories\./, /\.test\./, /\.spec\./, /_story-template/, /\/Example[A-Z]/, /\/index\.(tsx?|jsx?)$/]
const COMPONENT_ROOTS = [
    'src/design-system/atoms',
    'src/design-system/molecules',
    'src/design-system/organisms',
    'src/components',
]

const isExcluded = (relPath) => EXCLUDED.some((p) => p.test(relPath))
export const isPagePath = (relPath) => !isExcluded(relPath) && PAGE_PATTERNS.some((p) => p.test(relPath))
export const isPageStylePath = (relPath) => PAGE_STYLE_PATTERNS.some((p) => p.test(relPath))
export const isAtomPath = (relPath) =>
    !isExcluded(relPath) && /^src\/design-system\/atoms\/.*\.tsx$/.test(relPath)
export const isComponentPath = (relPath) =>
    !isExcluded(relPath) &&
    /\.tsx$/.test(relPath) &&
    COMPONENT_ROOTS.some((root) => relPath.startsWith(`${root}/`))
const isDesignSystemPath = (relPath) => relPath.startsWith('src/design-system/')

// ─── 1. 페이지 비대화 ─────────────────────────────────────────────

/** 레이아웃 시맨틱 태그(main/section/header/…)는 뼈대라서 세지 않는다 */
const CONTENT_TAGS = ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'label', 'form', 'table', 'strong', 'em']
const CONTROL_TAGS = ['button', 'input', 'select', 'textarea']

const countTags = (text, tags) => {
    if (!text) return 0
    const pattern = new RegExp(`<(${tags.join('|')})[\\s>/]`, 'g')
    return (text.match(pattern) || []).length
}

/**
 * 페이지 한 개의 before/after 비교
 * @returns string[]
 */
export function analyzePageDrift(relPath, before, after, options) {
    const warnings = []
    const controlGrowth = countTags(after, CONTROL_TAGS) - countTags(before, CONTROL_TAGS)
    if (controlGrowth > 0) {
        warnings.push(
            `${relPath}: 페이지에 원시 컨트롤(<button>/<input> 등)이 ${controlGrowth}개 늘었습니다. design-system의 Button·TextField 같은 부품을 쓰세요.`,
        )
    }
    const tagGrowth = countTags(after, CONTENT_TAGS) - countTags(before, CONTENT_TAGS)
    if (tagGrowth >= options.pageRawTagGrowth) {
        warnings.push(
            `${relPath}: 페이지에 기본 태그(<div>/<p> 등)가 ${tagGrowth}개 늘었습니다. 새 마크업 덩어리는 부품으로 빼고 페이지에는 조립만 남기세요.`,
        )
    }
    return warnings
}

/** 레이아웃이 아닌 꾸밈 속성 — 페이지 CSS에 이게 늘면 부품으로 가야 할 스타일이다 */
const DECORATIVE_PROPERTY =
    /^\s*(color|background(-color|-image)?|border(-(top|right|bottom|left))?(-(color|style|width|radius))?|border-radius|box-shadow|text-shadow|font(-(size|weight|family|style))?|text-decoration|letter-spacing)\s*:/

/**
 * 페이지 스타일 파일에 추가된 줄 검사
 * @param addedLines diff에서 새로 추가된 줄들 ('+' 제거된 상태)
 */
export function analyzePageStyleLines(relPath, addedLines) {
    const decorative = addedLines.filter((line) => DECORATIVE_PROPERTY.test(line))
    if (decorative.length === 0) return []
    const props = [...new Set(decorative.map((line) => line.trim().split(':')[0]))]
    return [
        `${relPath}: 페이지 CSS에 꾸밈 속성(${props.join(', ')})이 추가됐습니다. 페이지 CSS에는 배치(간격·정렬)만 두고, 꾸밈은 부품으로 옮기세요.`,
    ]
}

// ─── 2. atom 비대화 ───────────────────────────────────────────────

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g

/** atom이 가져다 쓰는 다른 atom 이름 목록 (형제 폴더 import 또는 atoms/ 경로) */
export function findAtomImports(content) {
    const names = []
    for (const match of content.matchAll(IMPORT_SPECIFIER)) {
        const spec = match[1]
        if (/\.(css|scss|sass|less)$/.test(spec)) continue
        const sibling = spec.match(/^\.\.\/([A-Z]\w*)/)
        const viaAtoms = spec.match(/\/atoms\/([A-Z]\w*)/)
        const name = sibling?.[1] ?? viaAtoms?.[1]
        if (name) names.push(name)
    }
    return [...new Set(names)]
}

/** XxxProps 인터페이스/타입의 직접 선언된 멤버 수 (상속분 제외) */
export function countProps(content) {
    const head = content.match(/(?:interface|type)\s+\w*Props\b[^{]*\{/)
    if (!head) return 0
    let depth = 1
    let i = head.index + head[0].length
    const start = i
    while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++
        else if (content[i] === '}') depth--
        i++
    }
    let body = content.slice(start, i - 1)
    // 중첩 객체 타입은 멤버 하나로 본다
    let previous
    do {
        previous = body
        body = body.replace(/\{[^{}]*\}/g, '{}')
    } while (body !== previous)
    return body
        .split('\n')
        .filter((line) => /^\s*(readonly\s+)?['"]?[\w-]+['"]?\??\s*:/.test(line)).length
}

export function analyzeAtom(relPath, content, options) {
    const warnings = []
    const atomImports = findAtomImports(content)
    if (atomImports.length > 0) {
        warnings.push(
            `${relPath}: atom이 다른 atom(${atomImports.join(', ')})을 조합하고 있습니다. 조합이면 molecule로 옮기는 것을 검토하세요.`,
        )
    }
    const props = countProps(content)
    if (props > options.atomMaxProps) {
        warnings.push(
            `${relPath}: atom의 props가 ${props}개입니다 (기준 ${options.atomMaxProps}). 역할이 여러 개로 늘었는지 확인하고, 필요하면 쪼개거나 molecule로 올리세요.`,
        )
    }
    const lines = content.split('\n').length
    if (lines > options.atomMaxLines) {
        warnings.push(
            `${relPath}: atom 파일이 ${lines}줄입니다 (기준 ${options.atomMaxLines}). 더 작은 단위로 쪼갤 수 있는지 확인하세요.`,
        )
    }
    return warnings
}

// ─── 3. 부품 중복 ─────────────────────────────────────────────────

/** 끝단어 동의어 묶음 — 이름이 달라도 같은 역할일 가능성이 높은 것들 */
const SYNONYM_GROUPS = [
    ['Badge', 'Tag', 'Chip', 'Pill'],
    ['Button', 'Btn'],
    ['Modal', 'Dialog', 'Popup'],
    ['Card', 'Tile'],
    ['Input', 'Field', 'TextField', 'TextInput'],
    ['Toast', 'Snackbar', 'Notification'],
    ['Dropdown', 'Select', 'Picker', 'Combobox'],
    ['Spinner', 'Loader', 'Loading'],
    ['Divider', 'Separator'],
    ['Switch', 'Toggle'],
    ['Tooltip', 'Hint'],
]

const splitWords = (name) => name.match(/[A-Z][a-z0-9]*|[a-z0-9]+/g) || [name]
const headWord = (name) => {
    const words = splitWords(name)
    return words[words.length - 1]
}
const sameGroup = (a, b) => a === b || SYNONYM_GROUPS.some((group) => group.includes(a) && group.includes(b))

const levenshtein = (a, b) => {
    const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
    for (let j = 1; j <= b.length; j++) dp[0][j] = j
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
            )
        }
    }
    return dp[a.length][b.length]
}

/**
 * 두 부품 이름이 비슷한지
 * - 이름이 같거나 오타 수준 차이 (5자 이상, 편집 거리 2 이하)
 * - 기존 쪽이 design-system 부품이면: 끝단어가 같거나 동의어 (StatusBadge ↔ Badge, StatusTag ↔ Badge)
 *   도메인 부품끼리는 끝단어 비교를 하지 않는다 (LoginForm ↔ SignupForm 은 정상)
 */
export function isSimilarComponent(newName, existing) {
    const a = newName
    const b = existing.name
    if (a === b) return true
    if (Math.min(a.length, b.length) >= 5 && levenshtein(a.toLowerCase(), b.toLowerCase()) <= 2) return true
    if (existing.isDesignSystem && sameGroup(headWord(a), headWord(b))) return true
    return false
}

const walk = (dir) => {
    if (!existsSync(dir)) return []
    const results = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) results.push(...walk(full))
        else results.push(full)
    }
    return results
}

/** 프로젝트의 부품 목록 */
export function listComponents(projectRoot) {
    const components = []
    for (const root of COMPONENT_ROOTS) {
        for (const abs of walk(path.join(projectRoot, root))) {
            const relPath = path.relative(projectRoot, abs).split(path.sep).join('/')
            if (!isComponentPath(relPath)) continue
            components.push({
                name: path.basename(relPath, '.tsx'),
                relPath,
                isDesignSystem: isDesignSystemPath(relPath),
            })
        }
    }
    return components
}

export function findSimilarComponents(newName, newRelPath, components) {
    return components.filter((c) => c.relPath !== newRelPath && isSimilarComponent(newName, c))
}

const formatSimilar = (name, similar) =>
    `새 부품 ${name} — 비슷한 기존 부품: ${similar.map((c) => `${c.name} (${c.relPath})`).join(', ')}. 새로 만들기 전에 재사용하거나 variant/prop 추가를 먼저 검토하세요.`

// ─── 커밋 시점 (staged 기준) ──────────────────────────────────────

const git = (projectRoot, args) => {
    try {
        return execFileSync('git', args, { cwd: projectRoot, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
        return ''
    }
}

/**
 * staged 변경에서 구조 흐트러짐 경고 수집
 * design-system 폴더가 없는 프로젝트는 대상이 아니다.
 * @returns string[]
 */
export function collectStagedStructureWarnings(projectRoot, config) {
    if (!existsSync(path.join(projectRoot, 'src', 'design-system'))) return []
    const options = loadStructureOptions(config)

    const staged = git(projectRoot, ['diff', '--cached', '--name-status', '--diff-filter=AM'])
        .split('\n')
        .filter(Boolean)
        .map((line) => {
            const [status, ...rest] = line.split('\t')
            return { status, relPath: rest.join('\t') }
        })

    const warnings = []
    const newComponents = []

    for (const { status, relPath } of staged) {
        if (isPagePath(relPath)) {
            const before = git(projectRoot, ['show', `HEAD:${relPath}`])
            const after = git(projectRoot, ['show', `:${relPath}`])
            warnings.push(...analyzePageDrift(relPath, before, after, options))
        }
        if (isPageStylePath(relPath)) {
            const added = git(projectRoot, ['diff', '--cached', '-U0', '--', relPath])
                .split('\n')
                .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
                .map((line) => line.slice(1))
            warnings.push(...analyzePageStyleLines(relPath, added))
        }
        if (isAtomPath(relPath)) {
            warnings.push(...analyzeAtom(relPath, git(projectRoot, ['show', `:${relPath}`]), options))
        }
        if (status === 'A' && isComponentPath(relPath)) {
            newComponents.push(relPath)
        }
    }

    if (newComponents.length > 0) {
        // 이번 커밋에 같이 들어온 새 부품끼리는 비교하지 않는다 (atom과 그걸 쓰는 molecule 등)
        const existing = listComponents(projectRoot).filter((c) => !newComponents.includes(c.relPath))
        for (const relPath of newComponents) {
            const name = path.basename(relPath, '.tsx')
            const similar = findSimilarComponents(name, relPath, existing)
            if (similar.length > 0) warnings.push(formatSimilar(name, similar))
        }
    }

    return warnings
}

// ─── 전체 점검 (직접 실행) ────────────────────────────────────────

export function collectProjectStructureReport(projectRoot, config) {
    const options = loadStructureOptions(config)
    const report = { pages: [], atoms: [], duplicates: [] }

    const pageFiles = walk(path.join(projectRoot, 'src'))
        .map((abs) => path.relative(projectRoot, abs).split(path.sep).join('/'))
        .filter(isPagePath)
    for (const relPath of pageFiles) {
        const content = readFileSync(path.join(projectRoot, relPath), 'utf-8')
        const controls = countTags(content, CONTROL_TAGS)
        const tags = countTags(content, CONTENT_TAGS)
        if (controls > 0 || tags >= options.pageRawTagGrowth * 3) {
            report.pages.push(`${relPath}: 원시 컨트롤 ${controls}개, 기본 태그 ${tags}개`)
        }
    }

    const components = listComponents(projectRoot)
    for (const c of components.filter((c) => isAtomPath(c.relPath))) {
        const content = readFileSync(path.join(projectRoot, c.relPath), 'utf-8')
        report.atoms.push(...analyzeAtom(c.relPath, content, options))
    }

    const seen = new Set()
    for (const c of components) {
        for (const other of findSimilarComponents(c.name, c.relPath, components)) {
            const key = [c.relPath, other.relPath].sort().join('|')
            if (seen.has(key)) continue
            seen.add(key)
            report.duplicates.push(`${c.name} (${c.relPath}) ↔ ${other.name} (${other.relPath})`)
        }
    }

    return report
}

// 심볼릭 링크 경로(macOS /var → /private/var 등)로 실행돼도 직접 실행으로 인식하도록 실제 경로로 비교
const isMain = (() => {
    try {
        return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
    } catch {
        return false
    }
})()
if (isMain) {
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
    let config = {}
    try {
        config = JSON.parse(readFileSync(path.join(projectRoot, '.harness', 'config.json'), 'utf-8'))
    } catch {
        // 기본값 사용
    }
    const report = collectProjectStructureReport(projectRoot, config)
    const section = (title, items) => {
        console.log(`\n## ${title} (${items.length})`)
        if (items.length === 0) console.log('- 없음')
        for (const item of items) console.log(`- ${item}`)
    }
    console.log('# 구조 점검 리포트')
    section('페이지에 남은 원시 마크업', report.pages)
    section('atom 비대화', report.atoms)
    section('비슷한 부품 후보', report.duplicates)
    console.log('\n경고일 뿐입니다. 정리할지는 /ux-review 에서 판단하세요.')
}
