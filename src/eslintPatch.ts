import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { IDetectResult } from './types.js'

/**
 * 하네스가 만드는 파일 중 호스트 eslint가 집어들면 안 되는 것들.
 * `.harness/gates/*.mjs` 는 Node 인프라 스크립트이고,
 * `.harness/incoming/**` 는 tsconfig 밖에 있어 타입 인식 린트가 파싱에 실패한다.
 */
const HARNESS_IGNORES = ['.harness/**']

const MARKER = 'create-harness'

export type TEslintPatchStatus =
    | 'patched'
    | 'already-present'
    | 'no-config'
    | 'unrecognized'

export interface IEslintPatchResult {
    status: TEslintPatchStatus
    file?: string
    /** unrecognized 일 때 사용자가 손으로 붙여넣을 조각 */
    snippet: string
}

const SNIPPET_LINES = [
    `    // ${MARKER}: 하네스 생성 파일은 호스트 lint 대상이 아니다`,
    `    { ignores: [${HARNESS_IGNORES.map((glob) => `'${glob}'`).join(', ')}] },`,
]

/**
 * flat config 배열의 여는 괄호를 찾는다.
 * `export default [` · `export default tseslint.config(` · `export default defineConfig([`
 * 세 가지가 실사용의 대부분이고, 어느 쪽이든 바로 뒤에 설정 객체를 끼워 넣을 수 있다.
 */
const findInsertionPoint = (source: string): number | null => {
    const match = /export\s+default\s+(?:[\w.]+\s*\(\s*)?\[?/.exec(source)
    if (!match) return null

    const tail = match[0].trimEnd()
    // 배열 리터럴이나 함수 호출이 열린 지점 바로 뒤여야 한다
    if (!/[[(]$/.test(tail)) return null

    return match.index + match[0].length
}

/**
 * 호스트의 eslint flat config에 `.harness/**` ignores를 끼워 넣는다.
 *
 * 사용자 파일을 고치는 일이라 보수적으로 간다 — 알아볼 수 있는 형태에만 손대고,
 * 이미 적용돼 있으면 아무것도 하지 않으며(멱등), 실패하면 조각만 돌려주고 물러난다.
 */
export const patchEslintIgnores = (
    detected: IDetectResult,
    dryRun: boolean,
): IEslintPatchResult => {
    const snippet = SNIPPET_LINES.join('\n')
    const file = detected.eslintConfigFile
    if (!file) return { status: 'no-config', snippet }

    const absPath = path.join(detected.targetDir, file)
    let source: string
    try {
        source = readFileSync(absPath, 'utf-8')
    } catch {
        return { status: 'no-config', snippet }
    }

    if (source.includes(MARKER) || /['"`]\.harness\/\*\*['"`]/.test(source)) {
        return { status: 'already-present', file, snippet }
    }

    const insertAt = findInsertionPoint(source)
    if (insertAt === null) return { status: 'unrecognized', file, snippet }

    const patched = `${source.slice(0, insertAt)}\n${snippet}${source.slice(insertAt)}`
    if (!dryRun) writeFileSync(absPath, patched, 'utf-8')

    return { status: 'patched', file, snippet }
}
