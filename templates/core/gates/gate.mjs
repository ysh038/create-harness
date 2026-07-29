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
                    ? { permission: 'deny', userMessage: reason, agentMessage: reason }
                    : { permission: 'allow' },
            ),
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
        respond(
            'deny',
            `커밋 전 검증(checks)이 실패했습니다. 고친 뒤 다시 커밋하세요.\n${tail}`,
        )
    }
}

respond('allow')
