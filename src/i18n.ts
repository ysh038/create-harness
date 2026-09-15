export type TLanguage = 'ko' | 'en'

export const MESSAGES = {
    ko: {
        intro: 'create-harness',
        projectInfo: (name: string, detected: string) =>
            `프로젝트: ${name}\n감지: ${detected}`,
        existingFilesWarning: (files: string) =>
            `이미 존재하는 에이전트 파일: ${files}\n내용이 다른 파일은 덮어쓰지 않고 .harness/incoming/ 아래에 둡니다.`,
        
        // Language selection
        languagePrompt: '어떤 언어로 설치를 진행할까요?',
        languageKorean: '한국어',
        languageEnglish: 'English',
        
        // Mode selection
        modePrompt: '이 프로젝트는 어떤 작업을 하나요?',
        modeFree: '자유롭게 만들기',
        modeFreeHint: '디자인 참조 없이 구현 — 에이전트가 자율 디자인',
        modeInspire: '참고해서 만들기',
        modeInspireHint: '디자인을 영감으로 활용 — 재해석 허용',
        modeImplement: '회사 일, 피그마 화면 맞추기',
        modeImplementHint: '제공된 디자인과 최대한 일치 — 자유로운 재디자인 금지',
        
        // Component declaration
        componentDeclPrompt: '컴포넌트를 어떻게 선언하나요?',
        componentDeclFunction: 'function 키워드 (function Button() {})',
        componentDeclArrow: '화살표 함수 (const Button = () => {})',
        
        // Styling
        stylingPrompt: '스타일을 어떻게 작성하나요?',
        stylingCss: '일반 CSS (App.css, index.css 등)',
        stylingCssModules: 'CSS Modules (.module.css)',
        stylingTailwind: 'Tailwind CSS (유틸리티 클래스)',
        
        // Agents
        agentsPrompt: '어떤 에이전트를 대상으로 하나요?',
        
        // Modules
        modulesInfo: '모듈 선택 기준: 설치 직후 컴파일·검증을 통과할 수 있는 모듈만 기본 선택됩니다.\n비권장 모듈을 포함하면 필요한 의존성이 없어 컴파일이 깨질 수 있습니다.',
        modulesPrompt: '어떤 모듈을 포함하나요? (코어 규칙·워크플로·게이트는 항상 포함)',
        moduleNotRecommended: '⚠️  비권장',
        
        // Module labels
        moduleDesignSystem: '디자인 토큰, Atomic UI 계층, stylelint 색상 차단, 스토리 템플릿 — UI를 재사용 가능한 부품으로 정리',
        moduleAuthHttp: '로그인/세션 HTTP 헬퍼 (axios 인터셉터, ProtectedRoute) — 앱에 인증 API가 있을 때만 유용',
        moduleDataFetching: 'TanStack Query + 샘플 API 계층 + Zustand 알림 저장소 — 서버 상태 패턴',
        moduleLint: 'ESLint/prettier/commitlint 네이밍·import 경계 게이트',
        
        // Storybook
        storybookInfo: 'Storybook — 컴포넌트를 전체 앱과 분리하여 미리보는 갤러리입니다. UI 컴포넌트를 단독으로 확인하고 디자이너와 협업할 때 유용합니다. 지금 설치하지 않고 의향만 기록하면, /ds-init 워크플로가 나중에 설치합니다.',
        storybookPrompt: 'Storybook을 사용할 계획인가요?',
        
        // Outro
        cancelled: '취소되었습니다.',
    },
    en: {
        intro: 'create-harness',
        projectInfo: (name: string, detected: string) =>
            `Project: ${name}\nDetected: ${detected}`,
        existingFilesWarning: (files: string) =>
            `Existing agent files: ${files}\nFiles with different content will be placed under .harness/incoming/.`,
        
        // Language selection
        languagePrompt: 'Which language would you like to use for installation?',
        languageKorean: 'Korean (한국어)',
        languageEnglish: 'English',
        
        // Mode selection
        modePrompt: 'What kind of work is this project?',
        modeFree: 'Build freely',
        modeFreeHint: 'No design reference — agent designs autonomously',
        modeInspire: 'Build with inspiration',
        modeInspireHint: 'Use design as inspiration — reinterpretation allowed',
        modeImplement: 'Professional work, match Figma',
        modeImplementHint: 'Match provided design closely — no free redesign',
        
        // Component declaration
        componentDeclPrompt: 'How do you declare components?',
        componentDeclFunction: 'function keyword (function Button() {})',
        componentDeclArrow: 'arrow function (const Button = () => {})',
        
        // Styling
        stylingPrompt: 'How do you write styles?',
        stylingCss: 'Plain CSS (App.css, index.css, etc)',
        stylingCssModules: 'CSS Modules (.module.css)',
        stylingTailwind: 'Tailwind CSS (utility classes)',
        
        // Agents
        agentsPrompt: 'Which agents are you targeting?',
        
        // Modules
        modulesInfo: 'Module selection criteria: Only modules that will compile and pass checks right after installation are selected by default.\nIncluding non-recommended modules may break compilation due to missing dependencies.',
        modulesPrompt: 'Which modules to include? (core rules, workflows, gates always included)',
        moduleNotRecommended: '⚠️  not recommended',
        
        // Module labels
        moduleDesignSystem: 'Design tokens, Atomic UI layers, stylelint blocking raw colors, story templates — organize UI into reusable components',
        moduleAuthHttp: 'Login/session HTTP helpers (axios interceptors, ProtectedRoute) — useful only if app has auth API',
        moduleDataFetching: 'TanStack Query + sample API layers + Zustand alert store — server state patterns',
        moduleLint: 'ESLint/prettier/commitlint naming & import boundary gates',
        
        // Storybook
        storybookInfo: 'Storybook — A separate gallery where you preview UI components alone (not the full app). Useful to check the design system and collaborate with designers. Choosing yes records intent (pending); actual install can happen later via /ds-init.',
        storybookPrompt: 'Do you plan to use Storybook?',
        
        // Outro
        cancelled: 'Operation cancelled.',
    },
}

export const getMessages = (lang: TLanguage) => MESSAGES[lang]
