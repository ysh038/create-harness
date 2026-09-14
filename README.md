# create-harness

[![npm](https://img.shields.io/npm/v/create-harness-cli.svg)](https://www.npmjs.com/package/create-harness-cli)
[![downloads](https://img.shields.io/npm/dm/create-harness-cli.svg)](https://www.npmjs.com/package/create-harness-cli)
[![license](https://img.shields.io/npm/l/create-harness-cli.svg)](./LICENSE)


> Drop an AI coding-agent harness onto an existing project — one command.

Not an app scaffolder. `create-harness` installs conventions, verification gates, and workflows so Cursor and Claude Code produce consistent work in a repo you already have.

Published on npm as [`create-harness-cli`](https://www.npmjs.com/package/create-harness-cli) (the `create-harness` name is taken).

## Quick start

```bash
npx create-harness-cli
npx create-harness-cli ./my-app --yes --dry-run
```

Requires Node.js 20+.

## What you get

- **`AGENTS.md`** — short source of truth for every agent (`CLAUDE.md` imports it)
- **Cursor rules / Claude skills** — architecture, data fetching, design system, testing, auth
- **Workflows** — `/spec` → `/impl` → `/verify` → `/ship`, plus `/ds-init`, `/ds-add`, `/ux-review` when the design-system module is on
- **Commit gate** — shared script wired to Cursor `beforeShellExecution` and Claude `PreToolUse` (blocks failed checks, staged `.env`, `--no-verify`, force push)
- **Reference code** — axios instance, `ProtectedRoute`, TanStack Query 3-layer example, Zustand store (compile-ready, not prose)
- **Lint enforcement** — naming, public API boundaries, Atomic layer imports (early page raw JSX ban), color tokens via stylelint
- **Brownfield baselines** — existing violations (raw colors, raw page JSX) grandfathered as warnings; new code stays strict

Existing files are never overwritten. Conflicts land under `.harness/incoming/`. Every write is recorded in `.harness/manifest.json`.

## Options

```
npx create-harness-cli [dir] [options]

--preset <name>     preset (currently: react-fe)
--agents <csv>      cursor,claude (default: both)
--modules <csv>     design-system,auth-http,data-fetching,lint
--ponytail          optional YAGNI ladder rules from ponytail
--dry-run           print the plan without writing
-y, --yes           skip prompts
```

Interactive runs also ask whether you plan to use Storybook (`off` / `pending` in `.harness/config.json`). Use `/ds-init` later to install and set `ready`.

## Modules

Core (rules, workflows, gates, docs) always installs. Code-generating modules default **on only when they will compile and pass checks on the target**:

| Module | Default on when | Skipped when |
|--------|-----------------|--------------|
| `design-system` | CSS / CSS Modules | Tailwind, CSS-in-JS |
| `auth-http` | axios + react-router + Vite | fetch-only, Next.js/CRA |
| `data-fetching` | TanStack Query + Zustand + axios | other stacks |
| `lint` | ESLint flat config + TypeScript | legacy `.eslintrc`, JS-only |

Use `--modules` to force inclusion. Dropping a module also drops the rules and workflows that depend on it.

## Opinions (short)

- **Docs suggest. Gates enforce.** Prefer checks and lint errors over hoping the agent reads a paragraph.
- **Design tokens + stylelint** are the reliable way to stop UI drift; Atomic layer reverse-imports are ESLint errors.
- **Storybook is on-demand** (`/ds-init`) — CLI asks intent only (off/pending), not installed up front.
- **Brownfield-friendly** — existing violations go into baseline files (warning), new code stays strict (error).
- Design rationale lives in [`DECISIONS.md`](./DECISIONS.md).

## Develop

```bash
npm run check
npm run dev -- <target> --yes --dry-run
```

- `templates/` — files copied into target projects
- everything else — this CLI
- roadmap: [`TODO.md`](./TODO.md)

## License

[MIT](./LICENSE)
