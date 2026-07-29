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
            // 기능 폴더는 index.ts 로만 import. 내부 파일 deep import를 차단한다.
            // (폴더 내부의 상대 import './exampleApi' 는 패턴에 안 걸린다)
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                '**/queries/*/*',
                                '!**/queries/*/index',
                                '**/components/*/*/*',
                            ],
                            message:
                                '기능 폴더는 index.ts 공개 API로만 import하세요 (10-architecture).',
                        },
                    ],
                },
            ],

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
    {
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
