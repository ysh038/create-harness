# Tailwind CSS 설정 안내

하네스가 `styling: tailwind` 옵션을 감지했습니다.
다음 단계를 완료하여 Tailwind v4 + 디자인 토큰을 통합하세요.

## 1. 패키지 설치

```bash
{{PM}} install -D tailwindcss @tailwindcss/vite
```

## 2. Vite 설정에 플러그인 추가

`vite.config.ts` 에 `@tailwindcss/vite` 플러그인을 추가합니다:

```typescript
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
// ... 기존 imports

export default defineConfig({
  plugins: [
    tailwindcss(), // ← Tailwind v4 Vite 플러그인
    // ... 기존 플러그인들
  ],
})
```

## 3. CSS 진입점에 Tailwind 임포트

`src/index.css` (또는 main CSS 파일)의 **맨 위에** 다음을 추가합니다:

```css
@import "tailwindcss";

/* 디자인 토큰 유지 — Tailwind와 함께 사용 */
@import "./design-system/tokens.css";
```

## 4. 디자인 토큰과 Tailwind 연동

Tailwind 유틸리티가 하네스 토큰을 참조하도록 설정합니다:

### 방법 A: CSS 변수 직접 사용 (권장)

```tsx
// 토큰을 Tailwind arbitrary 값으로 사용
<button className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]">
  클릭
</button>
```

### 방법 B: @theme로 별칭 등록

`src/index.css` 또는 별도 `tailwind.css` 에 추가:

```css
@theme {
  --color-brand: var(--color-primary);
  --color-brand-hover: var(--color-primary-hover);
  /* 필요한 토큰만 별칭 등록 */
}
```

사용:

```tsx
<button className="bg-brand hover:bg-brand-hover">
  클릭
</button>
```

## 5. stylelint 가이드

- `tokens.css` / `tokens.ts` 는 여전히 색상·간격·타이포 정본입니다
- Tailwind 유틸리티 클래스 자체는 stylelint로 검증되지 않습니다 (정상)
- 커스텀 CSS를 작성할 때는 여전히 토큰을 사용하세요

## 6. Atomic 계층 + Tailwind

- `src/design-system/{atoms,molecules,organisms}` 는 여전히 필요합니다
- Tailwind는 스타일 방식이지 컴포넌트 계층을 대체하지 않습니다
- Button·TextField 같은 atom은 Tailwind 클래스로 구현하되, 페이지에서 직접 `<button>` 사용은 여전히 금지됩니다

---

**완료 후**: `/ds-init` 을 실행하여 Storybook을 설치하고 예제 컴포넌트를 생성하세요.
