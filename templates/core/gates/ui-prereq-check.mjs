#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * ui-prereq-check.mjs — UI 파일 작성 전제조건 체크 (공유 모듈)
 *
 * pre-write-gate.mjs 및 shell-gate.mjs 양쪽에서 사용하는 공통 로직.
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
 * 제외 패턴 — stories, tokens, _story-template
 */
export const EXCLUDE_PATTERNS = [
    /\.stories\./,
    /_story-template/,
    /\/tokens\./,
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

    const entries = designRefs.entries || []
    const entry = entries.find((e) => {
        if (e.codePath === relPath) return true
        const entryFileName = path.basename(e.codePath)
        const pageFileName = path.basename(relPath)
        return entryFileName === pageFileName
    })

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
