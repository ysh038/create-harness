/**
 * 디자인 토큰 강제 — 색상 원시값(#hex, rgb(), 색상 키워드)을 error 처리한다.
 * 에이전트가 규칙 문서를 무시해도 여기서 걸린다.
 *
 * v0.1은 색상만 켠다. 간격·타이포까지 한 번에 강제하면 토큰이 불완전한 상태에서
 * 에이전트가 존재하지 않는 토큰 이름을 발명한다 — hex보다 나쁜 결과.
 * src/design-system/tokens.css 의 해당 카테고리가 채워지면 아래 주석을 해제할 것.
 */
export default {
    plugins: ['stylelint-declaration-strict-value'],
    rules: {
        'scale-unlimited/declaration-strict-value': [
            [
                // 색상 — 항상 강제
                '/color$/',
                'fill',
                'stroke',
                'background',
                'border-color',
                'outline-color',

                // 간격 — tokens.css 의 --space-* 가 실사용 값으로 채워지면 해제
                // 'gap', 'padding', 'margin',

                // 타이포 — --font-* 가 채워지면 해제
                // 'font-size', 'font-weight',
            ],
            {
                ignoreValues: [
                    'currentColor',
                    'transparent',
                    'inherit',
                    'initial',
                    'unset',
                    'none',
                    '/^var\\(--/',
                ],
                message:
                    '원시값 대신 디자인 토큰(var(--...))을 쓰세요. 토큰이 없으면 src/design-system/tokens.css 에 먼저 추가하세요.',
            },
        ],
    },
}
