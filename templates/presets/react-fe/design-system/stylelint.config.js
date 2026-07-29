/**
 * 디자인 토큰 강제 — 색상 원시값(#hex, rgb(), 색상 키워드)을 error 처리한다.
 * 에이전트가 규칙 문서를 무시해도 여기서 걸린다.
 *
 * 색상만 켠다. 간격·타이포까지 한 번에 강제하면 토큰이 불완전한 상태에서
 * 에이전트가 존재하지 않는 토큰 이름을 발명한다 — hex보다 나쁜 결과.
 * src/design-system/tokens.css 의 해당 카테고리가 채워지면 아래 주석을 해제할 것.
 */
{{#if STYLELINT_BASELINE}}import { readFileSync } from 'node:fs'

/**
 * 유예 목록 — 하네스 도입 시점에 이미 원시값을 쓰던 CSS {{CSS_RAW_COLOR_FILES}}개.
 * 이 파일들만 warning 으로 낮춘다. **새로 만드는 CSS는 그대로 error다.**
 *
 * 전부 error로 켜면 첫 커밋부터 막혀 게이트를 꺼버리게 되고, 반대로 전부 warning으로
 * 낮추면 새 코드의 드리프트를 못 막는다. 목록으로 끊는 이유가 그것이다.
 *
 * 정리할 때마다 .harness/stylelint-baseline.json 에서 해당 경로를 지운다.
 * 목록이 비면 이 블록과 overrides 를 통째로 삭제하면 된다.
 */
const baseline = JSON.parse(
    readFileSync(new URL('./.harness/stylelint-baseline.json', import.meta.url), 'utf-8'),
)

{{/if}}const TOKEN_PROPERTIES = [
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
]

const OPTIONS = {
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
}

/**
 * strict-value 플러그인은 함수 값(ignoreFunctions 기본 true)을 건너뛴다.
 * 그래서 `#hex` 는 잡아도 `rgb()` · `hsl()` 은 통과한다 — 색상 속성에 한해 따로 막는다.
 * background-image 의 그라디언트는 대상이 아니므로 var() 조합은 그대로 쓸 수 있다.
 */
const COLOR_FUNCTION_PROPERTIES =
    '/^(color|fill|stroke|background|background-color|border(-(top|right|bottom|left))?-color|outline-color)$/'

const rules = (severity) => ({
    'scale-unlimited/declaration-strict-value': [
        TOKEN_PROPERTIES,
        severity ? { ...OPTIONS, severity } : OPTIONS,
    ],
    'declaration-property-value-disallowed-list': [
        { [COLOR_FUNCTION_PROPERTIES]: ['/rgba?\\(/', '/hsla?\\(/'] },
        { message: OPTIONS.message, ...(severity ? { severity } : {}) },
    ],
})

export default {
    plugins: ['stylelint-declaration-strict-value'],
    rules: rules(),
{{#if STYLELINT_BASELINE}}    overrides: [{ files: baseline, rules: rules('warning') }],
{{/if}}}
