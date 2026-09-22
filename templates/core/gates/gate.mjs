#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * 커밋 게이트 본체. Cursor(beforeShellExecution)와 Claude Code(PreToolUse) 훅이
 * pre-commit-gate.sh 를 통해 같은 이 스크립트를 부른다.
 *
 * 정책:
 *  - `git commit` 감지 시 → --no-verify 거부, .env 스테이징 거부, checks 실패 시 거부
 *  - `git push --force`/-f 거부 (--force-with-lease 는 허용)
 *  - 통과 시 layout-first·구조 흐트러짐 경고가 있으면 전달 (차단 안 함, 0.6.0/0.7.0)
 *
 * 사용: gate.mjs <cursor|claude>  (훅 입력 JSON은 stdin)
 */
import { execSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const tool = process.argv[2] === 'claude' ? 'claude' : 'cursor'
const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(gatesDir, '..', '..')

const respond = (decision, reason) => {
    if (tool === 'claude') {
        // 통과 시에는 아무것도 출력하지 않는다 — 명시적 'allow'는 사용자의 권한 확인을
        // 건너뛰게 만든다. 출력이 없으면 Claude Code의 원래 권한 흐름을 그대로 따른다. (0.7.0)
        if (decision === 'allow') process.exit(0)
        console.log(
            JSON.stringify({
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    permissionDecision: decision,
                    permissionDecisionReason: reason ?? '',
                },
            }),
        )
    } else {
        console.log(
            JSON.stringify(
                decision === 'deny'
                    ? { permission: 'deny', user_message: reason, agent_message: reason }
                    : { permission: 'allow' },
            ),
        )
    }
    process.exit(0)
}

/**
 * 커밋은 진행시키되 경고를 전달한다 (0.7.0)
 * - Claude Code: stderr는 exit 0에서 아무에게도 안 보인다. additionalContext(에이전트) +
 *   systemMessage(사용자)로 보내고, permissionDecision은 비워 원래 권한 흐름을 따른다.
 * - Cursor: 통과 응답에 메시지를 붙이는 필드가 없다. 'ask'로 사용자에게 경고를 보여주고
 *   진행 여부를 맡긴다.
 */
const respondWithWarnings = (warnings) => {
    const text = `커밋 전 구조 점검 경고 ${warnings.length}건 (커밋은 막지 않음):\n${warnings.map((w) => `- ${w}`).join('\n')}`
    if (tool === 'claude') {
        console.log(
            JSON.stringify({
                systemMessage: text,
                hookSpecificOutput: {
                    hookEventName: 'PreToolUse',
                    additionalContext: `${text}\n\n이번 커밋은 진행해도 되지만, 사용자에게 위 경고를 알리고 정리할지 물어보세요.`,
                },
            }),
        )
    } else {
        console.log(
            JSON.stringify({
                permission: 'ask',
                user_message: `${text}\n\n그대로 커밋하려면 승인하세요.`,
                agent_message: `${text}\n\n사용자에게 위 경고를 알리고 정리할지 물어보세요.`,
            }),
        )
    }
    process.exit(0)
}

let command = ''
try {
    const raw = readFileSync(0, 'utf-8')
    const input = raw.trim() ? JSON.parse(raw) : {}
    command =
        tool === 'claude'
            ? (input.tool_input && input.tool_input.command) || ''
            : input.command || ''
} catch {
    // 입력을 못 읽으면 판단 불가 — 무관한 명령을 막지 않도록 허용
    respond('allow')
}

const isGitCommit = /\bgit\b[^&|;]*\bcommit\b/.test(command)
const isGitPush = /\bgit\b[^&|;]*\bpush\b/.test(command)

if (isGitPush) {
    const stripped = command.replace(/--force-with-lease(=\S+)?/g, '')
    if (/(\s--force\b|\s-f\b)/.test(stripped)) {
        respond(
            'deny',
            'force push는 금지되어 있습니다. 필요하면 --force-with-lease 를 사전 협의 후 사용하세요.',
        )
    }
}

if (isGitCommit) {
    if (/--no-verify\b|\s-n\b/.test(command)) {
        respond('deny', 'git commit --no-verify 는 게이트 우회이므로 금지입니다.')
    }

    let staged = ''
    try {
        staged = execSync('git diff --cached --name-only', {
            cwd: projectRoot,
            encoding: 'utf-8',
        })
    } catch {
        // git 저장소가 아니면 이후 검사만 진행
    }
    const stagedEnv = staged
        .split('\n')
        .filter((file) => /(^|\/)\.env(\.\w+)?$/.test(file))
        .filter((file) => !file.endsWith('.env.example'))
    if (stagedEnv.length > 0) {
        respond(
            'deny',
            `.env 파일이 스테이징되어 있습니다: ${stagedEnv.join(', ')} — 시크릿 커밋 금지.`,
        )
    }

    // 보조 경고 — 커밋을 막지는 않는다.
    // 0.6.0 layout-first + 0.7.0 구조 흐트러짐(페이지 비대화·atom 비대화·부품 중복).
    // 두 모듈은 조건부 설치 파일이므로 동적으로 불러오고, 없으면 해당 경고만 생략한다.
    const warnings = []
    let config = {}
    try {
        config = JSON.parse(
            readFileSync(path.join(projectRoot, '.harness', 'config.json'), 'utf-8'),
        )
    } catch {
        // config를 못 읽으면 기본값으로 진행
    }
    const stagedFiles = staged.split('\n').filter(Boolean)
    try {
        const { collectLayoutWarnings } = await import('./ui-prereq-check.mjs')
        warnings.push(...collectLayoutWarnings(projectRoot, config, stagedFiles))
    } catch {
        // 모듈 없음 — 생략
    }
    try {
        const { collectStagedStructureWarnings } = await import('./structure-check.mjs')
        warnings.push(...collectStagedStructureWarnings(projectRoot, config))
    } catch {
        // 모듈 없음 — 생략
    }

    const result = spawnSync(
        process.execPath,
        [path.join(gatesDir, 'run-checks.mjs')],
        { cwd: projectRoot, encoding: 'utf-8' },
    )
    if (result.status !== 0) {
        const tail = `${result.stdout ?? ''}${result.stderr ?? ''}`
            .split('\n')
            .filter(Boolean)
            .slice(-15)
            .join('\n')
        const warningText =
            warnings.length > 0 ? `\n\n구조 점검 경고:\n${warnings.map((w) => `- ${w}`).join('\n')}` : ''
        respond(
            'deny',
            `커밋 전 검증(checks)이 실패했습니다. 고친 뒤 다시 커밋하세요.\n${tail}${warningText}`,
        )
    }

    if (warnings.length > 0) {
        respondWithWarnings(warnings)
    }
}

respond('allow')
