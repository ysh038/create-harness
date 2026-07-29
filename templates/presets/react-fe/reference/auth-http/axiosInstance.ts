/**
 * 단일 axios 인스턴스 — 모든 HTTP 호출은 이 인스턴스를 통한다.
 * (규칙: 50-auth-http. 새 인스턴스 생성·axios 직접 호출 금지)
 *
 * - access token은 메모리에만 보관 (localStorage 금지)
 * - 요청 인터셉터가 Authorization 헤더 자동 첨부
 * - 401 시 refresh 1회 시도 (refreshPromise로 동시 요청 중복 제거) 후 원 요청 재시도
 * - refresh까지 실패하면 'auth:logout' 이벤트만 발행 — 라우팅은 인증 훅의 책임
 */
import axios from 'axios'
import type { AxiosError, InternalAxiosRequestConfig } from 'axios'

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true,
})

let currentAccessToken: string | null = null

export const setAccessToken = (token: string | null) => {
    currentAccessToken = token
}

export const getAccessToken = () => currentAccessToken

// 요청 인터셉터: 토큰을 Authorization 헤더에 자동 첨부 (refresh 요청 제외)
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const isRefreshRequest = (config.url ?? '').includes('/auth/refresh')
        if (currentAccessToken && config.headers && !isRefreshRequest) {
            config.headers.Authorization = `Bearer ${currentAccessToken}`
        }
        return config
    },
    (error) => Promise.reject(error),
)

interface IRefreshResponse {
    data: {
        accessToken: string
    }
}

// 동시에 만료된 요청 N개가 refresh를 N번 부르지 않도록 중복 제거
let refreshPromise: Promise<string> | null = null

const refreshAccessToken = (): Promise<string> => {
    if (refreshPromise) return refreshPromise

    refreshPromise = axiosInstance
        .post<IRefreshResponse>('/auth/refresh')
        .then((response) => {
            const token = response.data.data.accessToken
            setAccessToken(token)
            return token
        })
        .finally(() => {
            refreshPromise = null
        })

    return refreshPromise
}

// 응답 인터셉터: 401 → refresh 1회 → 원 요청 재시도, 실패 시 로그아웃 이벤트
axiosInstance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & {
            _retry?: boolean
        }

        const requestUrl = originalRequest?.url ?? ''
        const isAuthRequest =
            requestUrl.includes('/auth/login') ||
            requestUrl.includes('/auth/refresh') ||
            requestUrl.includes('/auth/logout')

        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !isAuthRequest &&
            currentAccessToken !== null
        ) {
            originalRequest._retry = true
            try {
                const token = await refreshAccessToken()
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${token}`
                }
                return axiosInstance(originalRequest)
            } catch {
                setAccessToken(null)
                window.dispatchEvent(new CustomEvent('auth:logout'))
            }
        }

        return Promise.reject(error)
    },
)
