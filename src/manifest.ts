import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type {
    IFileAction,
    IManifest,
    IScaffoldOptions,
    IWriteResult,
} from './types.js'

export const sha256 = (content: string): string =>
    createHash('sha256').update(content, 'utf-8').digest('hex')

const MANIFEST_PATH = '.harness/manifest.json'

/** 이전 설치 기록. 없거나 읽을 수 없으면 null (첫 설치로 본다) */
export const readManifest = (targetDir: string): IManifest | null => {
    try {
        return JSON.parse(readFileSync(path.join(targetDir, MANIFEST_PATH), 'utf-8')) as IManifest
    } catch {
        return null
    }
}

/**
 * 파일을 쓴다. 대상 경로에 내용이 다른 파일이 이미 있으면:
 * - 이전 설치 기록(manifest)의 해시와 지금 파일이 같으면 → 사용자가 손대지 않은 하네스 파일이므로
 *   새 버전으로 교체한다 (업그레이드, 1.0.0)
 * - 그 밖에는 덮어쓰지 않고 .harness/incoming/ 아래 같은 상대 경로에 두어 사용자가 비교할 수 있게 한다.
 */
export const writeActions = (
    actions: IFileAction[],
    targetDir: string,
    dryRun: boolean,
    previous: IManifest | null = null,
): IWriteResult[] =>
    actions.map((action) => {
        const absDest = path.join(targetDir, action.dest)
        let placedInIncoming = false
        let updated = false

        if (existsSync(absDest)) {
            const existing = readFileSync(absDest, 'utf-8')
            if (existing === action.content) {
                // 동일 내용이면 그대로 둔다 (재실행 멱등성)
                return {
                    dest: action.dest,
                    placedInIncoming: false,
                    sha256: sha256(action.content),
                    module: action.module,
                }
            }
            const recorded = previous?.files.find((file) => file.path === action.dest)
            if (recorded && recorded.sha256 === sha256(existing)) {
                updated = true
            } else {
                placedInIncoming = true
            }
        }

        // .incoming 접미사: 대상 프로젝트의 tsc·eslint가 이 파일을 집어들지 않게 한다
        const finalPath = placedInIncoming
            ? path.join(targetDir, '.harness/incoming', `${action.dest}.incoming`)
            : absDest

        if (!dryRun) {
            mkdirSync(path.dirname(finalPath), { recursive: true })
            writeFileSync(finalPath, action.content, 'utf-8')
            if (action.executable) chmodSync(finalPath, 0o755)
        }

        return {
            dest: action.dest,
            placedInIncoming,
            ...(updated ? { updated: true } : {}),
            sha256: sha256(action.content),
            module: action.module,
        }
    })

export const writeManifest = (
    results: IWriteResult[],
    options: IScaffoldOptions,
    version: string,
    dryRun: boolean,
    previous: IManifest | null = null,
): IManifest => {
    const files = results.flatMap((result) => {
        if (!result.placedInIncoming) {
            return [{ path: result.dest, sha256: result.sha256, module: result.module }]
        }
        // 충돌로 incoming에 둔 파일은 이전 기록을 유지한다 — 지우면 다음 업그레이드 때
        // 이 파일이 하네스가 설치한 것인지 판단할 근거가 사라진다
        const recorded = previous?.files.find((file) => file.path === result.dest)
        return recorded ? [recorded] : []
    })
    const manifest: IManifest = {
        version,
        createdAt: new Date().toISOString(),
        preset: options.preset,
        agents: options.agents,
        modules: options.modules,
        files,
    }

    if (!dryRun) {
        const manifestPath = path.join(options.targetDir, MANIFEST_PATH)
        mkdirSync(path.dirname(manifestPath), { recursive: true })
        writeFileSync(
            manifestPath,
            JSON.stringify(manifest, null, 4) + '\n',
            'utf-8',
        )
    }

    return manifest
}
