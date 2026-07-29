/**
 * 3계층 데이터 패턴의 2층: queryKey 팩토리. (규칙: 20-data-fetching)
 * 계층적 키 — 상위 키로 무효화하면 하위가 전부 무효화된다.
 */
import type { IExampleFilters } from './exampleApi'

export const exampleQueryKeys = {
    all: ['example'] as const,
    lists: () => [...exampleQueryKeys.all, 'list'] as const,
    list: (filters: IExampleFilters) =>
        [...exampleQueryKeys.lists(), filters] as const,
    details: () => [...exampleQueryKeys.all, 'detail'] as const,
    detail: (id: string) => [...exampleQueryKeys.details(), id] as const,
}
