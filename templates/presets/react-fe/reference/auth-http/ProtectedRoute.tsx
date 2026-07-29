/**
 * 라우트 가드 — 로그인 필요 페이지는 이 컴포넌트로 감싼다.
 * (규칙: 50-auth-http. 페이지 안에서 `if (!user) navigate(...)` 금지)
 *
 * 사용:
 *   <ProtectedRoute><MyPage /></ProtectedRoute>
 *   <ProtectedRoute requiredRoles={['ROLE_ADMIN']}><Admin /></ProtectedRoute>
 *
 * TODO: 아래 AuthContext 스텁을 프로젝트의 실제 인증 Provider와 연결하세요.
 *       (인증 훅은 'auth:logout' 이벤트를 구독해 로그아웃·리다이렉트를 처리해야 합니다)
 */
import { createContext, useContext } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

export type TRole = 'ROLE_USER' | 'ROLE_ADMIN'

export interface IAuthState {
    isAuthenticated: boolean
    isLoading: boolean
    role: TRole | null
}

// 프로젝트에 이미 AuthContext가 있다면 이 스텁을 지우고 그것을 import 하세요
export const AuthContext = createContext<IAuthState>({
    isAuthenticated: false,
    isLoading: true,
    role: null,
})

interface IProtectedRouteProps {
    children: React.ReactNode
    requiredAuth?: boolean
    requiredRoles?: TRole[]
}

function ProtectedRoute({
    children,
    requiredAuth = true,
    requiredRoles,
}: IProtectedRouteProps) {
    const { isAuthenticated, isLoading, role } = useContext(AuthContext)
    const location = useLocation()

    // 인증 여부 확인 중에는 아무것도 렌더하지 않는다 (깜빡임 방지)
    if (isLoading) {
        return null
    }

    if (!isAuthenticated && requiredAuth) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    if (requiredRoles && requiredRoles.length > 0) {
        if (!role || !requiredRoles.includes(role)) {
            return <Navigate to="/" replace />
        }
    }

    return <>{children}</>
}

export default ProtectedRoute
