/**
 * 하네스 린트 규칙 조각 — 기존 eslint.config.js 에 spread해서 쓴다:
 *
 *   import harnessRules from './eslint.harness.config.js'
 *   export default [ ...기존설정, ...harnessRules ]
 *
 * 문서만 있으면 에이전트가 무시한다. 컨벤션은 여기서 error로 강제된다.
 * 필요 devDependency: typescript-eslint, eslint-plugin-import
 */
import importPlugin from 'eslint-plugin-import'
import tseslint from 'typescript-eslint'

/**
 * 주의 — no-restricted-imports 는 **작성된 import 문자열**을 매칭한다 (해석된 경로가 아니다).
 * design-system 내부에서 옆 계층을 부를 때 경로는 `../../molecules/FormField` 이지
 * `.../design-system/molecules/...` 가 아니다. 패턴에 `design-system/` 을 넣으면
 * 정작 막아야 할 계층 내부 위반이 통과한다 — 계층 폴더 이름만으로 매칭한다.
 */

/**
 * 공개 API 경계 (10-architecture) — 기능 폴더는 index.ts 로만 import한다.
 * 아래 Atomic 계층 블록들이 no-restricted-imports 를 재정의하면서
 * 이 패턴을 덮어쓰지 않도록 상수로 빼서 매번 함께 넣는다
 * (flat config 는 같은 규칙을 병합하지 않고 마지막 정의로 대체한다).
 */
const PUBLIC_API_PATTERN = {
    group: [
        '**/queries/*/*',
        '!**/queries/*/index',
        '**/components/*/*/*',
        // <계층>/<Name>/<file> deep import (30-design-system)
        '**/atoms/*/*',
        '!**/atoms/*/index',
        '**/molecules/*/*',
        '!**/molecules/*/index',
        '**/organisms/*/*',
        '!**/organisms/*/index',
    ],
    message: '기능 폴더는 index.ts 공개 API로만 import하세요 (10-architecture).',
}

/** 상위 계층·도메인·전역 상태 차단 블록 하나를 만든다 (30-design-system) */
const layerBoundary = (layer, forbidden, message) => ({
    files: [`src/design-system/${layer}/**/*.{ts,tsx}`],
    rules: {
        'no-restricted-imports': [
            'error',
            { patterns: [PUBLIC_API_PATTERN, { group: forbidden, message }] },
        ],
    },
})

export default [
    {
        files: ['src/**/*.{ts,tsx}'],
        plugins: {
            '@typescript-eslint': tseslint.plugin,
            import: importPlugin,
        },
        rules: {
            // ── 명명 규칙 (10-architecture) ─────────────────────────────
            '@typescript-eslint/naming-convention': [
                'error',
                {
                    selector: 'variable',
                    types: ['boolean'],
                    format: ['PascalCase', 'camelCase'],
                    prefix: ['is', 'has', 'should', 'can', 'must', 'was', 'will'],
                },
                // 화살표 함수 컴포넌트(const Button = () => ...)는 PascalCase 변수다 —
                // 이 예외가 없으면 표준 React 컴포넌트 선언 방식 자체가 위반으로 잡힌다
                {
                    selector: 'variable',
                    types: ['function'],
                    format: ['PascalCase', 'camelCase'],
                },
                {
                    selector: 'variable',
                    format: ['camelCase'],
                    leadingUnderscore: 'allow',
                },
                {
                    selector: 'variable',
                    modifiers: ['const'],
                    format: ['UPPER_CASE', 'camelCase'],
                    filter: { regex: '^[_A-Z0-9]+$', match: true },
                },
                { selector: 'function', format: ['PascalCase', 'camelCase'] },
                { selector: 'class', format: ['PascalCase'] },
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: { regex: '^I[A-Z]', match: true },
                },
                { selector: 'typeAlias', format: ['PascalCase'] },
                {
                    selector: 'typeParameter',
                    format: ['PascalCase'],
                    prefix: ['T'],
                },
            ],

            // ── any 금지 (00-core) ──────────────────────────────────────
            '@typescript-eslint/no-explicit-any': 'error',

            // ── 공개 API 경계 (10-architecture) ─────────────────────────
            // 폴더 내부의 상대 import './exampleApi' 는 패턴에 안 걸린다
            'no-restricted-imports': ['error', { patterns: [PUBLIC_API_PATTERN] }],

            // ── import 정렬 ─────────────────────────────────────────────
            'import/order': [
                'error',
                {
                    groups: [
                        ['builtin', 'external'],
                        ['internal', 'parent', 'sibling', 'index'],
                    ],
                    'newlines-between': 'always',
                    alphabetize: { order: 'asc', caseInsensitive: true },
                },
            ],
        },
    },
    // ── Atomic 계층 의존 방향 (30-design-system) ────────────────────
    // UI는 아래에서 위로만 쌓인다. atom이 molecule을, molecule이 organism을
    // import하는 순간 "재사용 가능한 최소 단위"라는 전제가 깨지고,
    // 그 컴포넌트를 쓰는 화면 전부가 상위 계층에 끌려 들어간다.
    // 문서로만 두면 지켜지지 않으므로 여기서 error로 끊는다.
    layerBoundary(
        'atoms',
        [
            '**/molecules/**',
            '**/organisms/**',
            '**/components/**',
            '**/queries/**',
            '**/stores/**',
        ],
        'atom은 상위 계층·도메인·전역 상태를 모른다. 조합이 필요하면 molecule로 올리세요 (30-design-system).',
    ),
    layerBoundary(
        'molecules',
        [
            '**/organisms/**',
            '**/components/**',
            '**/queries/**',
            '**/stores/**',
        ],
        'molecule은 atom만 조합한다. 도메인·전역 상태가 필요하면 organism 또는 page 계층입니다 (30-design-system).',
    ),
    layerBoundary(
        'organisms',
        ['**/components/**', '**/queries/**', '**/stores/**'],
        'design-system 의 organism은 도메인을 모른다. 데이터는 props로 받고, 도메인 결합이 필요하면 src/components/{Domain}/ 으로 옮기세요 (30-design-system).',
    ),
{{#if DESIGN_SYSTEM}}    // ── 페이지 raw JSX 금지 (30-design-system) ──────────────────────
    {
        files: [
            'src/pages/**/*.{ts,tsx}',
            'src/routes/**/*.{ts,tsx}',
            'src/App.tsx',
            'src/app/page.tsx',
        ],
        rules: {
            'no-restricted-syntax': [
                'error',
                {
                    selector:
                        'JSXElement[openingElement.name.name=/^(button|input|select|textarea|form|a|div|span|p|h[1-6]|ul|ol|li|table|tr|td|th|img|video|audio|canvas|svg)$/]',
                    message:
                        '페이지는 조립만 한다. 이 태그는 Atomic 계층(atom/molecule/organism)으로 만들고 import하세요 (30-design-system).',
                },
            ],
        },
    },
{{/if}}{{#if ATOMIC_BASELINE}}    {
        files: (() => {
            try {
                return JSON.parse(
                    require('fs').readFileSync('.harness/atomic-baseline.json', 'utf-8'),
                )
            } catch {
                return []
            }
        })(),
        rules: {
            'no-restricted-syntax': ['warn'],
        },
    },
{{/if}}    {
        // 스토리 export(Default, Interaction 등)는 관례상 PascalCase — 명명 규칙 예외
        files: ['src/**/*.stories.{ts,tsx}'],
        rules: {
            '@typescript-eslint/naming-convention': 'off',
        },
    },
    {
        // 하네스 인프라(.harness/)와 incoming 은 린트 대상이 아니다
        ignores: ['.harness/**'],
    },
]
