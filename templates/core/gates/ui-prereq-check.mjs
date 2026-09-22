#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * ui-prereq-check.mjs — UI 파일 작성 전제조건 체크 (공유 모듈)
 *
 * pre-write-gate.mjs 및 before-shell-gate.mjs 양쪽에서 사용하는 공통 로직.
 * 드리프트 방지: 같은 규칙을 두 곳에서 다르게 구현하지 않기 위함.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/**
 * UI 파일 패턴 — 페이지, 디자인시스템 컴포넌트, 도메인 컴포넌트
 */
export const UI_PATTERNS = [
    // 페이지/라우트
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
    // 디자인시스템 컴포넌트 (stories/tokens/_story-template 제외)
    /^src\/design-system\/(atoms|molecules|organisms)\/.*\.tsx?$/,
    // 도메인 컴포넌트 (src/components/** — v14 dogfood에서 LoginForm 여기 생성)
    /^src\/components\/.*\.(tsx?|jsx?)$/,
]

/**
 * 페이지 파일 패턴 (디자인 참조 체크 대상)
 */
export const PAGE_PATTERNS = [
    /^src\/pages\/.*\.(tsx?|jsx?)$/,
    /^src\/routes\/.*\.(tsx?|jsx?)$/,
    /^src\/app\/.*\/page\.(tsx?|jsx?)$/,
    /^src\/.*Page\.(tsx?|jsx?)$/,
]

/**
 * 제외 패턴 — stories, tokens, _story-template, Example*
 */
export const EXCLUDE_PATTERNS = [
    /\.stories\./,
    /_story-template/,
    /\/tokens\./,
    /\/Example[A-Z]/,
]

/**
 * 주어진 경로가 UI 파일인지 판단
 */
export function isUiFile(relPath) {
    if (EXCLUDE_PATTERNS.some((p) => p.test(relPath))) {
        return false
    }
    return UI_PATTERNS.some((p) => p.test(relPath))
}

/**
 * 주어진 경로가 페이지 파일인지 판단
 */
export function isPageFile(relPath) {
    if (EXCLUDE_PATTERNS.some((p) => p.test(relPath))) {
        return false
    }
    return PAGE_PATTERNS.some((p) => p.test(relPath))
}

/**
 * 프로젝트 루트 찾기 (.harness/config.json 기준)
 */
export function findProjectRoot(startPath) {
    let current = startPath
    while (current !== path.dirname(current)) {
        if (existsSync(path.join(current, '.harness', 'config.json'))) {
            return current
        }
        current = path.dirname(current)
    }
    return null
}

/**
 * Storybook 전제조건 체크
 * @returns {allow: true} | {deny: true, userMsg, agentMsg}
 */
export function checkStorybookPrereq(projectRoot, config) {
    const storybookState = config.storybook
    if (storybookState !== 'pending' && storybookState !== 'ready') {
        return { allow: true }
    }

    const storybookDir = path.join(projectRoot, '.storybook')
    if (!existsSync(storybookDir)) {
        return {
            deny: true,
            userMsg:
                'Storybook이 설치되지 않았습니다. /ds-init 워크플로를 먼저 실행하거나 .harness/config.json에서 storybook을 "off"로 변경하세요.',
            agentMsg:
                '⚠️ UI 파일을 작성하기 전에 /ds-init을 실행하여 Storybook을 설치하거나, 사용자에게 Storybook을 사용하지 않을지 확인하세요. (config.storybook: "pending|ready" 이지만 .storybook/ 폴더가 없습니다.)',
        }
    }

    return { allow: true }
}

/**
 * design-references.json 에서 페이지 항목 찾기 (codePath 일치 → 파일명 일치)
 */
export function findDesignRefEntry(designRefs, relPath) {
    const entries = designRefs.entries || []
    return entries.find((e) => {
        if (!e.codePath) return false
        if (e.codePath === relPath) return true
        return path.basename(e.codePath) === path.basename(relPath)
    })
}

/**
 * 디자인 참조 전제조건 체크 (페이지 파일만)
 * @returns {allow: true} | {deny: true, userMsg, agentMsg}
 */
export function checkDesignRefPrereq(projectRoot, config, relPath) {
    const mode = config.mode
    if (mode !== 'inspire' && mode !== 'implement') {
        return { allow: true }
    }

    if (!isPageFile(relPath)) {
        return { allow: true }
    }

    const designRefsPath = path.join(projectRoot, '.harness', 'design-references.json')
    if (!existsSync(designRefsPath)) {
        return {
            deny: true,
            userMsg: `디자인 참조 맵이 없습니다. 모드가 '${mode}'이므로 .harness/design-references.json이 필요합니다.`,
            agentMsg: `⚠️ 모드가 '${mode}'인데 design-references.json이 없습니다. 하네스 설정을 다시 실행하세요.`,
        }
    }

    let designRefs
    try {
        designRefs = JSON.parse(readFileSync(designRefsPath, 'utf-8'))
    } catch {
        return {
            deny: true,
            userMsg: 'design-references.json을 읽을 수 없습니다.',
            agentMsg: '⚠️ design-references.json 파일이 손상되었습니다.',
        }
    }

    const entry = findDesignRefEntry(designRefs, relPath)

    if (!entry) {
        return {
            deny: true,
            userMsg: `이 화면(${relPath})의 디자인 참조가 design-references.json에 없습니다. 먼저 사용자에게 물어보세요: "이 화면에 참고할 피그마 디자인이나 스크린샷이 있나요?"`,
            agentMsg: `⚠️ 페이지/화면 파일을 작성하기 전에 디자인 참조를 먼저 물어보고 design-references.json에 기록해야 합니다.\n\n질문: "이 화면(${path.basename(relPath)})에 참고할 피그마 디자인이나 스크린샷이 있나요? (있음 / 없음 / 나중에)"\n\n- 있음: URL/이미지를 받아 즉시 읽기 시도 → 성공 시 linked 저장, 실패 시 다른 참조 요청\n- 없음: waived로 기록하고 진행 OK\n- 나중에: needed로 기록 (inspire: 진행 OK, implement: waived 또는 링크 필요)`,
        }
    }

    // inspire 모드: linked / waived / needed 허용, 단 linked는 lastReadOk 체크
    if (mode === 'inspire') {
        if (entry.status === 'linked' && entry.lastReadOk === false) {
            return {
                deny: true,
                userMsg: `${relPath}의 디자인 참조 읽기가 실패했습니다 (lastReadOk: false). 다른 Figma 노드 URL이나 스크린샷을 제공하거나, 명시적으로 waived로 변경하세요.`,
                agentMsg: `⚠️ 디자인 참조(${entry.ref?.url || entry.figma?.url || '?'})를 읽을 수 없습니다.\n에러: ${entry.readError || '없음'}\n\n다른 Figma 노드 URL이나 스크린샷을 사용자에게 요청하거나, 사용자가 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
            }
        }
        return { allow: true }
    }

    // implement 모드: linked(성공) 또는 waived만 허용
    if (mode === 'implement') {
        if (entry.status === 'waived') {
            return { allow: true }
        }
        if (entry.status === 'linked') {
            if (entry.lastReadOk === false) {
                return {
                    deny: true,
                    userMsg: `${relPath}의 디자인 참조 읽기가 실패했습니다. implement 모드에서는 읽기 성공한 참조 또는 명시적 waived만 허용됩니다.`,
                    agentMsg: `⚠️ implement 모드: 디자인 참조(${entry.ref?.url || entry.figma?.url || '?'})를 읽을 수 없습니다.\n에러: ${entry.readError || '없음'}\n\n다른 Figma 노드 URL이나 스크린샷을 사용자에게 요청하거나, 사용자가 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
                }
            }
            return { allow: true }
        }
        if (entry.status === 'needed') {
            return {
                deny: true,
                userMsg: `${relPath}는 needed 상태입니다. implement 모드에서는 디자인 참조를 지금 제공하거나 명시적으로 waived를 선택해야 합니다.`,
                agentMsg: `⚠️ implement 모드: 페이지가 'needed' 상태입니다. 사용자에게 디자인 참조를 지금 제공하도록 요청하거나, 디자인 없이 진행하겠다면 status를 'waived'로 변경하세요.`,
            }
        }
        return {
            deny: true,
            userMsg: `${relPath}의 디자인 참조 상태(${entry.status})가 부적절합니다. implement 모드는 linked(읽기 성공) 또는 waived가 필요합니다.`,
            agentMsg: `⚠️ implement 모드: 디자인 참조 상태가 '${entry.status}'입니다. linked(lastReadOk: true) 또는 waived가 필요합니다.`,
        }
    }

    return { allow: true }
}

/**
 * 주어진 경로가 design-system 컴포넌트 파일인지 판단
 */
export function isDesignSystemComponent(relPath) {
    if (EXCLUDE_PATTERNS.some((p) => p.test(relPath))) {
        return false
    }
    const dsPattern = /^src\/design-system\/(atoms|molecules|organisms)\/.*\.tsx?$/
    return dsPattern.test(relPath)
}

/**
 * Stories pair 체크 — Storybook ready 시 새 DS 컴포넌트는 stories 파일 필요
 * @returns {allow: true} | {deny: true, userMsg, agentMsg}
 */
export function checkStoriesPair(projectRoot, config, relPath, isNewFile) {
    const storybookState = config.storybook
    if (storybookState !== 'ready') {
        return { allow: true }
    }

    const storybookDir = path.join(projectRoot, '.storybook')
    if (!existsSync(storybookDir)) {
        return { allow: true }
    }

    if (!isDesignSystemComponent(relPath)) {
        return { allow: true }
    }

    // 기존 파일 편집은 허용 (brownfield grace)
    if (!isNewFile) {
        return { allow: true }
    }

    // 새 DS 컴포넌트: sibling stories 파일 필요
    const dir = path.dirname(path.join(projectRoot, relPath))
    const base = path.basename(relPath, path.extname(relPath))
    const storiesPath = path.join(dir, `${base}.stories.tsx`)
    
    if (!existsSync(storiesPath)) {
        return {
            deny: true,
            userMsg: `새 design-system 컴포넌트(${relPath})는 stories 파일이 필요합니다. ${base}.stories.tsx 파일을 함께 작성하세요.`,
            agentMsg: `⚠️ Storybook ready 상태: 새 design-system 컴포넌트는 반드시 stories 파일과 함께 작성해야 합니다.\n\n${relPath} → ${base}.stories.tsx 필요\n\n/ds-add 워크플로에서 컴포넌트와 stories를 함께 작성하세요.`,
        }
    }

    return { allow: true }
}

/**
 * Layout scaffold 흔적 — 페이지 파일에 data-slot 속성이 있으면 뼈대가 먼저 작성된 것으로 본다 (0.6.0)
 */
export const SLOT_MARKER = /\bdata-slot\s*=/

const IMPORT_SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g

/**
 * 텍스트에 "알맹이" import가 있는지 판단 (0.6.0)
 * 알맹이 = 도메인 컴포넌트(components/) 또는 design-system molecule/organism.
 * atom·토큰·스타일 파일은 뼈대 단계에서도 허용한다 (Stack 같은 레이아웃 atom 대응).
 */
export function hasSubstanceImport(text) {
    if (!text) return false
    for (const match of text.matchAll(IMPORT_SPECIFIER)) {
        const spec = match[1]
        if (/\.(css|scss|sass|less)$/.test(spec)) continue
        if (/(^|\/)components\//.test(spec)) return true
        if (/(^|\/)design-system\/(molecules|organisms)(\/|$)/.test(spec)) return true
    }
    return false
}

/**
 * Layout-first 체크 — implement 모드에서 페이지에 알맹이를 쓰기 전에 뼈대(data-slot)가 있어야 한다 (0.6.0)
 *
 * 판정 근거는 "디스크에 이미 있는" 페이지 파일이다. 뼈대와 알맹이를 한 번의 쓰기로 넣으면
 * 디스크에는 아직 흔적이 없으므로 차단된다 — 뼈대 쓰기와 채우기를 분리하는 것이 목적.
 *
 * @param incomingText 이번 쓰기로 들어갈 텍스트 (Write 내용, Edit new_string, shell 명령)
 * @returns {allow: true} | {deny: true, userMsg, agentMsg}
 */
export function checkLayoutScaffold(projectRoot, config, relPath, incomingText) {
    if (config.mode !== 'implement') {
        return { allow: true }
    }
    if (!isPageFile(relPath)) {
        return { allow: true }
    }

    // linked 참조가 있는 페이지만 — waived/항목 없음은 대상 아님 (항목 없음은 design-ref 체크가 처리)
    const designRefsPath = path.join(projectRoot, '.harness', 'design-references.json')
    let entry
    try {
        entry = findDesignRefEntry(JSON.parse(readFileSync(designRefsPath, 'utf-8')), relPath)
    } catch {
        return { allow: true }
    }
    if (!entry || entry.status !== 'linked') {
        return { allow: true }
    }

    const absPath = path.join(projectRoot, relPath)
    const existing = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : ''

    // 뼈대가 이미 있음 → 채우기 단계
    if (SLOT_MARKER.test(existing)) {
        return { allow: true }
    }
    // 이미 알맹이가 들어 있는 기존 페이지 → brownfield grace
    if (hasSubstanceImport(existing)) {
        return { allow: true }
    }
    // 이번 쓰기가 뼈대 자체 (알맹이 import 없음) → 허용
    if (!hasSubstanceImport(incomingText)) {
        return { allow: true }
    }

    return {
        deny: true,
        userMsg: `${relPath}: implement 모드에서는 페이지 레이아웃 뼈대(data-slot)를 먼저 작성한 뒤 컴포넌트를 채워야 합니다.`,
        agentMsg: `⚠️ implement 모드 layout-first: ${relPath} 에 뼈대가 없는데 알맹이(components/ 또는 design-system molecule/organism import)를 쓰려고 합니다.\n\n순서 (/ds-add 참조):\n1. Plan — 슬롯 트리 + Atomic 목록 + 채우기 순서를 먼저 적는다\n2. Layout scaffold — 페이지에 빈 슬롯만 작성: <section data-slot="overview" /> 처럼 레이아웃(display/gap/토큰)과 data-slot만. 알맹이 import 없이.\n3. Fill — 뼈대가 저장된 뒤 atoms → 핵심 molecule → organisms 순으로 슬롯을 채운다\n\n뼈대와 알맹이를 한 번에 쓰면 계속 차단됩니다. 뼈대만 먼저 쓰세요.`,
    }
}

/**
 * 커밋 시점 보조 경고 (0.6.0) — 차단하지 않고 메시지만 돌려준다.
 * 쓰기 시점 체크를 피해서 들어온 페이지(예: 하네스 설치 전에 만든 파일)를 알려주는 용도.
 * @param relPaths 커밋에 포함된 상대 경로 목록
 * @returns string[] — 경고 없으면 빈 배열
 */
export function collectLayoutWarnings(projectRoot, config, relPaths) {
    if (config.mode !== 'implement') {
        return []
    }

    let designRefs
    try {
        const designRefsPath = path.join(projectRoot, '.harness', 'design-references.json')
        designRefs = JSON.parse(readFileSync(designRefsPath, 'utf-8'))
    } catch {
        return []
    }

    const warnings = []
    for (const relPath of relPaths) {
        if (!isPageFile(relPath)) continue

        const entry = findDesignRefEntry(designRefs, relPath)
        if (!entry || entry.status !== 'linked') continue

        const absPath = path.join(projectRoot, relPath)
        if (!existsSync(absPath)) continue

        let content = ''
        try {
            content = readFileSync(absPath, 'utf-8')
        } catch {
            continue
        }
        if (SLOT_MARKER.test(content)) continue
        if (!hasSubstanceImport(content)) continue

        warnings.push(
            `${relPath}: 레이아웃 뼈대(data-slot) 없이 컴포넌트가 채워져 있습니다. 다음 작업 때 슬롯 구조로 정리하세요.`,
        )
    }
    return warnings
}

/**
 * 인라인 스타일 개수 (0.7.0)
 * CSS 변수만 넘기는 경우(style={{ '--progress': value }})는 동적 값 전달이라 세지 않는다.
 */
const INLINE_STYLE = /\bstyle=\{\{([\s\S]*?)\}\}/g
const STYLE_KEY = /(['"]?)([\w-]+)\1\s*:/g

export function countInlineStyles(text) {
    if (!text) return 0
    let count = 0
    for (const match of text.matchAll(INLINE_STYLE)) {
        const keys = [...match[1].matchAll(STYLE_KEY)].map((k) => k[2])
        if (keys.length > 0 && keys.every((key) => key.startsWith('--'))) continue
        count++
    }
    return count
}

/**
 * 페이지 인라인 스타일 체크 (0.7.0) — design-system이 있는 프로젝트에서 페이지에
 * 인라인 스타일을 새로 추가하면 거부한다. 기존 인라인 스타일은 건드리지 않는다
 * (이번 쓰기로 개수가 늘어날 때만 거부).
 *
 * @param incomingText 이번 쓰기로 들어갈 텍스트
 * @param replacedText 이번 쓰기로 사라질 텍스트 (Edit old_string, Write/shell은 기존 파일 전체)
 * @returns {allow: true} | {deny: true, userMsg, agentMsg}
 */
export function checkPageInlineStyle(projectRoot, relPath, incomingText, replacedText) {
    if (!isPageFile(relPath)) {
        return { allow: true }
    }
    if (!existsSync(path.join(projectRoot, 'src', 'design-system'))) {
        return { allow: true }
    }
    if (countInlineStyles(incomingText) <= countInlineStyles(replacedText)) {
        return { allow: true }
    }

    return {
        deny: true,
        userMsg: `${relPath}: 페이지 파일에 인라인 스타일을 추가할 수 없습니다. 스타일은 컴포넌트나 페이지 레이아웃 CSS로 옮기세요.`,
        agentMsg: `⚠️ ${relPath} 에 인라인 스타일(style={{...}})을 새로 넣으려고 합니다. 페이지에는 훅 호출과 조립만 남깁니다.\n\n대신:\n- 꾸밈(색·테두리·그림자·글꼴)이 필요하면 → design-system에 부품을 만들거나 기존 부품의 variant/prop을 늘린다 (/ds-add)\n- 배치(간격·정렬)만 필요하면 → 페이지 레이아웃 CSS에 토큰으로 작성한다\n- 동적 값 전달이 목적이면 → CSS 변수만 넘긴다: style={{ '--progress': value }}`,
    }
}
