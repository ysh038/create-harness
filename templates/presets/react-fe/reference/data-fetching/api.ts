/**
 * 모든 API 응답이 통과하는 공통 래퍼 타입.
 * 컴포넌트에 백엔드 원시 응답 형태가 새어나가지 않게 한다. (규칙: 20-data-fetching)
 *
 * TODO: 백엔드의 실제 응답 봉투 형태에 맞게 필드를 조정하세요.
 */
export interface IApiResponse<TData> {
    code: number
    message: string
    data: TData
}
