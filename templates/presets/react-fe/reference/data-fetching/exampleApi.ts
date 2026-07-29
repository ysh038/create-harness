/**
 * 3계층 데이터 패턴의 1층: 원시 API 호출. (규칙: 20-data-fetching)
 * - axiosInstance만 사용, IApiResponse<T> 언래핑까지 담당
 * - 이 파일은 폴더 밖에서 직접 import 금지 (index.ts 공개 API로만)
 *
 * "Example" 도메인은 이 패턴을 모방하기 위한 참조 구현입니다.
 * 실제 도메인을 추가할 때 이 폴더 구조(Api / QueryKeys / index)를 복사하세요.
 */
import type { IApiResponse } from '../../types/api'
import { axiosInstance } from '../../utils/axiosInstance'

export interface IExampleItem {
    id: string
    name: string
    isActive: boolean
}

// 페이지네이션 형태는 도메인마다 다를 수 있어 모듈 안에 둔다
// (types/api.ts 가 기존 프로젝트 파일과 충돌해도 이 모듈은 컴파일된다)
export interface IPaginatedData<TItem> {
    items: TItem[]
    page: number
    pageSize: number
    totalCount: number
}

export interface IExampleFilters {
    keyword?: string
    page?: number
}

export async function getExampleList(
    filters: IExampleFilters,
): Promise<IPaginatedData<IExampleItem>> {
    const response = await axiosInstance.get<
        IApiResponse<IPaginatedData<IExampleItem>>
    >('/examples', { params: filters })
    return response.data.data
}

export async function getExampleDetail(id: string): Promise<IExampleItem> {
    const response = await axiosInstance.get<IApiResponse<IExampleItem>>(
        `/examples/${encodeURIComponent(id)}`,
    )
    return response.data.data
}
