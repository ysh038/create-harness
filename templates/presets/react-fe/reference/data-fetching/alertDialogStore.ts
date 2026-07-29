/**
 * 전역 클라이언트 상태(Zustand) 참조 구현 — 확인 버튼 단일 액션 알림 다이얼로그.
 * (규칙: 20-data-fetching 상태 4분류 — "애플리케이션 상태"에 해당)
 *
 * 서버 캐시(TanStack Query 데이터)를 이런 스토어에 복사하지 않는다.
 */
import { create } from 'zustand'

interface IAlertDialogState {
    isOpen: boolean
    title: string
    message: string
    onConfirm: (() => void) | null
    open: (params: {
        title: string
        message: string
        onConfirm?: () => void
    }) => void
    close: () => void
}

export const useAlertDialogStore = create<IAlertDialogState>((set) => ({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    open: ({ title, message, onConfirm }) =>
        set({ isOpen: true, title, message, onConfirm: onConfirm ?? null }),
    close: () => set({ isOpen: false, title: '', message: '', onConfirm: null }),
}))
