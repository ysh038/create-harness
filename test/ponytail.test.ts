import { describe, expect, it, vi } from 'vitest'

// 빌드 산출물을 테스트한다 (다른 테스트 파일과 동일한 관례)
import { buildPonytailAction } from '../dist/ponytail.js'

const jsonResponse = (body: unknown, ok = true, status = 200): Response =>
    ({ ok, status, json: async () => body }) as unknown as Response

const textResponse = (body: string, ok = true, status = 200): Response =>
    ({ ok, status, text: async () => body }) as unknown as Response

describe('buildPonytailAction', () => {
    it('최신 릴리스 태그로 Cursor 규칙 파일을 받아온다', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ tag_name: 'v4.9.0' }))
            .mockResolvedValueOnce(textResponse('---\nalwaysApply: true\n---\nrule body'))

        const result = await buildPonytailAction(fetchImpl as unknown as typeof fetch)

        expect(result).not.toBeNull()
        expect(result!.tag).toBe('v4.9.0')
        expect(result!.action).toEqual({
            dest: '.cursor/rules/ponytail.mdc',
            content: '---\nalwaysApply: true\n---\nrule body',
            module: 'ponytail',
        })
        expect(fetchImpl).toHaveBeenNthCalledWith(
            1,
            'https://api.github.com/repos/DietrichGebert/ponytail/releases/latest',
            expect.anything(),
        )
        expect(fetchImpl).toHaveBeenNthCalledWith(
            2,
            'https://raw.githubusercontent.com/DietrichGebert/ponytail/v4.9.0/.cursor/rules/ponytail.mdc',
            expect.anything(),
        )
    })

    it('릴리스 API가 실패하면 null을 돌려주고 규칙 파일은 요청하지 않는다', async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}, false, 404))
        const result = await buildPonytailAction(fetchImpl as unknown as typeof fetch)
        expect(result).toBeNull()
        expect(fetchImpl).toHaveBeenCalledTimes(1)
    })

    it('tag_name이 없는 응답도 실패로 처리한다', async () => {
        const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse({}))
        const result = await buildPonytailAction(fetchImpl as unknown as typeof fetch)
        expect(result).toBeNull()
    })

    it('규칙 파일 fetch가 실패하면 null을 돌려준다', async () => {
        const fetchImpl = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse({ tag_name: 'v4.9.0' }))
            .mockResolvedValueOnce(textResponse('', false, 404))
        const result = await buildPonytailAction(fetchImpl as unknown as typeof fetch)
        expect(result).toBeNull()
    })

    it('네트워크 예외도 흡수해 스캐폴딩을 막지 않는다', async () => {
        const fetchImpl = vi.fn().mockRejectedValueOnce(new Error('network down'))
        const result = await buildPonytailAction(fetchImpl as unknown as typeof fetch)
        expect(result).toBeNull()
    })
})
