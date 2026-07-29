#!/usr/bin/env node
/* eslint-disable */
// ↑ Node 인프라 스크립트 — 브라우저 전용 eslint 설정(no-undef: process 등)에 걸리지 않게 한다.
/**
 * .harness/config.json 의 checks 를 순서대로 실행한다.
 * /verify 워크플로와 커밋 게이트가 같은 이 스크립트를 부르므로
 * 로컬·에이전트·CI의 판정 기준이 하나로 유지된다.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const gatesDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(gatesDir, '..', '..')
const configPath = path.resolve(gatesDir, '..', 'config.json')

const config = JSON.parse(readFileSync(configPath, 'utf-8'))
const checks = Array.isArray(config.checks) ? config.checks : []

if (checks.length === 0) {
    console.log('checks 가 비어 있습니다 (.harness/config.json)')
    process.exit(0)
}

for (const check of checks) {
    console.log(`\n▶ ${check.id}: ${check.command}`)
    const result = spawnSync(check.command, {
        cwd: projectRoot,
        shell: true,
        stdio: 'inherit',
    })
    if (result.status !== 0) {
        console.error(`\n✗ ${check.id} 실패 (exit ${result.status})`)
        process.exit(result.status ?? 1)
    }
}

console.log(`\n✓ 모든 체크 통과 (${checks.map((check) => check.id).join(' → ')})`)
