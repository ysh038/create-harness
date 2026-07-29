/**
 * Conventional Commits 검증 — /ship 워크플로와 게이트가 전제하는 커밋 형식.
 * https://www.conventionalcommits.org/
 */
export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        'type-enum': [
            2,
            'always',
            [
                'feat', // 새 기능 (MINOR)
                'fix', // 버그 수정 (PATCH)
                'docs', // 문서
                'style', // 포맷팅 (동작 변화 없음)
                'refactor', // 리팩토링
                'perf', // 성능
                'test', // 테스트
                'chore', // 빌드·설정
                'ci', // CI
                'build', // 빌드 시스템
                'revert', // 되돌리기
            ],
        ],
        'type-case': [2, 'always', 'lower-case'],
        'subject-case': [0],
        'subject-empty': [2, 'never'],
        'type-empty': [2, 'never'],
    },
    ignorePatterns: [
        '^Merge branch',
        '^Merge pull request',
        '^Merge remote-tracking branch',
        '^Revert "',
    ],
}
