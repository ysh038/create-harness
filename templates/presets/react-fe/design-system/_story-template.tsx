/* eslint-disable */
// ↑ 이 파일은 렌더되지 않는 참고용 템플릿이라 린트 대상에서 제외한다. 복사 후 제거하세요.
/**
 * 스토리 작성 템플릿 — 새 디자인시스템 컴포넌트의 스토리는 이 형식을 따른다.
 * (규칙: 30-design-system, 40-testing)
 *
 * 이 파일 자체는 렌더되지 않는 참고용이다 (일부러 *.stories.tsx 이름을 피했다 —
 * Storybook 러너가 집어들면 안 되기 때문). 실제 스토리를 만들 때:
 *  1. 이 파일을 복사해 <계층 폴더>/<Name>/<Name>.stories.tsx 로
 *     - atoms/ | molecules/ | organisms/ (도메인 결합 시 src/components/{Domain}/)
 *  2. title 을 계층 그대로 쓴다 — 'Atoms/Button', 'Molecules/FormField',
 *     'Organisms/ReviewList', 'Layouts/DetailLayout'
 *  3. 아래 TODO들을 채우고, play 함수에 상호작용·포커스·aria 단정을 쓴다
 *
 * play 함수가 스크린샷으로 못 잡는 것(포커스 이동, 키보드 조작, aria 상태)을 잡는다.
 * 테스트를 통과시키려고 단정문을 약화시키지 않는다.
 */
// @ts-nocheck — 템플릿 파일. 복사 후 @ts-nocheck 을 제거하세요.
import type { Meta, StoryObj } from '@storybook/react'
import { expect } from 'storybook/test'

// TODO: import MyComponent from './MyComponent'
declare const MyComponent: (props: { label: string }) => JSX.Element

const meta = {
    // TODO: 계층/이름 — Atoms | Molecules | Organisms | Layouts
    title: 'Atoms/MyComponent',
    component: MyComponent,
    tags: ['autodocs'],
    parameters: {
        // a11y 위반은 테스트 실패다 (.storybook/preview 에서 전역 설정됨)
    },
} satisfies Meta<typeof MyComponent>

export default meta
type TStory = StoryObj<typeof meta>

export const Default: TStory = {
    args: {
        label: '기본',
    },
}

/**
 * 상위 계층(molecule/organism) 스토리는 하위 계층 조합의 결과를 렌더한다.
 * 데이터는 반드시 args(props)로 주입한다 — 스토리 안에서 쿼리 훅·전역 스토어를 부르면
 * 그 컴포넌트는 계층을 잘못 잡은 것이다 (규칙: 30-design-system).
 */
export const Interaction: TStory = {
    args: {
        label: '저장',
    },
    play: async ({ canvas, userEvent }) => {
        // 사용자 관점 쿼리(getByRole)를 우선한다
        const button = canvas.getByRole('button', { name: '저장' })

        // 키보드 접근성: Tab으로 도달 가능한가
        await userEvent.tab()
        await expect(button).toHaveFocus()

        // 상호작용 후 상태 단정
        await userEvent.click(button)
        // TODO: await expect(canvas.getByRole('status')).toHaveTextContent('저장됨')
    },
}
