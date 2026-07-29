/**
 * 3계층 데이터 패턴의 3층: 공개 API. (규칙: 20-data-fetching)
 * 컴포넌트·훅은 이 파일이 export하는 것만 쓴다. 내부 파일 deep import 금지.
 */
import { useQuery } from '@tanstack/react-query'

import { getExampleDetail, getExampleList } from './exampleApi'
import type { IExampleFilters } from './exampleApi'
import { exampleQueryKeys } from './exampleQueryKeys'

export type { IExampleFilters, IExampleItem } from './exampleApi'
export { exampleQueryKeys } from './exampleQueryKeys'

export const useExampleListQuery = (filters: IExampleFilters) =>
    useQuery({
        queryKey: exampleQueryKeys.list(filters),
        queryFn: () => getExampleList(filters),
    })

export const useExampleDetailQuery = (id: string) =>
    useQuery({
        queryKey: exampleQueryKeys.detail(id),
        queryFn: () => getExampleDetail(id),
        enabled: id.length > 0,
    })
