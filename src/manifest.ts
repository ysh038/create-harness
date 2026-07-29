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

/**
 * 파일을 쓴다. 대상 경로에 내용이 다른 파일이 이미 있으면 덮어쓰지 않고
 * .harness/incoming/ 아래 같은 상대 경로에 두어 사용자가 비교할 수 있게 한다.
 */
export const writeActions = (
    actions: IFileAction[],
    targetDir: string,
    dryRun: boolean,
): IWriteResult[] =>
    actions.map((action) => {
        const absDest = path.join(targetDir, action.dest)
        let placedInIncoming = false

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
            placedInIncoming = true
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
            sha256: sha256(action.content),
            module: action.module,
        }
    })

export const writeManifest = (
    results: IWriteResult[],
    options: IScaffoldOptions,
    version: string,
    dryRun: boolean,
): IManifest => {
    const manifest: IManifest = {
        version,
        createdAt: new Date().toISOString(),
        preset: options.preset,
        agents: options.agents,
        modules: options.modules,
        files: results
            .filter((result) => !result.placedInIncoming)
            .map((result) => ({
                path: result.dest,
                sha256: result.sha256,
                module: result.module,
            })),
    }

    if (!dryRun) {
        const manifestPath = path.join(
            options.targetDir,
            '.harness/manifest.json',
        )
        mkdirSync(path.dirname(manifestPath), { recursive: true })
        writeFileSync(
            manifestPath,
            JSON.stringify(manifest, null, 4) + '\n',
            'utf-8',
        )
    }

    return manifest
}
