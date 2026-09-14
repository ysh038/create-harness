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
npx create-harness-cli ./my-app --dry-run
```

Requires Node.js 20+.

### Interactive vs explicit paths

- **TTY (interactive)**: prompts walk you through every decision
- **Non-TTY / automation**: all required answers must be provided via `--flags` or `--config <path.json>`. Missing answers = immediate error (never hangs on stdin)

## What you get

- **`AGENTS.md`** — short source of truth for every agent (`CLAUDE.md` imports it), includes design mode + coding style preferences
- **Cursor rules / Claude skills** — architecture, data fetching, design system, testing, auth
- **Workflows** — `/spec` → `/impl` → `/verify` → `/ship`, plus `/ds-init`, `/ds-add`, `/ux-review`, `/ds-ref` when the design-system module is on
- **Design reference map** (inspire/implement modes) — agent-maintained Figma link registry, prevents free redesign when `implement` mode is set
- **Coding style config** — componentDeclaration (function/arrow), export (default/named), styling (css-modules/tailwind) stored in config, enforced by agents
- **Commit gate** — shared script wired to Cursor `beforeShellExecution` and Claude `PreToolUse` (blocks failed checks, staged `.env`, `--no-verify`, force push)
- **Reference code** — axios instance, `ProtectedRoute`, TanStack Query 3-layer example, Zustand store (compile-ready, not prose)
- **Lint enforcement** — naming, public API boundaries, Atomic layer imports (early page raw JSX ban), color tokens via stylelint
- **Brownfield baselines** — existing violations (raw colors, raw page JSX) grandfathered as warnings; new code stays strict

Existing files are never overwritten. Conflicts land under `.harness/incoming/`. Every write is recorded in `.harness/manifest.json`.

## Options

```
npx create-harness-cli [dir] [options]

--preset <name>                preset (currently: react-fe)
--agents <csv>                 cursor,claude (default: both)
--modules <csv>                design-system,auth-http,data-fetching,lint
--ponytail                     optional YAGNI ladder rules from ponytail
--mode <mode>                  free|inspire|implement (default: free)
--component-declaration <type> function|arrow (default: function)
--component-export <type>      default|named (default: default)
--styling <type>               css|css-modules|tailwind (when not detected)
--figma-url <url>              Figma file URL (optional)
--accept-disclaimer            design reference liability disclaimer
--dry-run                      print the plan without writing
--config <path>                load settings from JSON file (flags override config)
```

Interactive runs also ask:
- **Design mode**: free (no design reference) / inspire (redesign allowed) / implement (match Figma closely)
- **Coding style**: component declaration, export pattern, styling approach
- **Storybook intent**: `off` / `pending` in `.harness/config.json` (use `/ds-init` later to install and set `ready`)

Optional flags for power users (`--figma-url` / `--accept-disclaimer`) skip prompts; interactive install does not ask for Figma URLs at setup.

### Config file format (--config)

JSON file matching CLI flags:

```json
{
  "mode": "free",
  "agents": ["cursor", "claude"],
  "modules": ["design-system", "lint"],
  "storybook": "pending",
  "ponytail": false,
  "componentDeclaration": "function",
  "componentExport": "default",
  "styling": "css-modules"
}
```

Flags override config when both are present. You can also pass config via stdin: `--config -`

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
npm run dev -- <target> --dry-run
```

- `templates/` — files copied into target projects
- everything else — this CLI
- roadmap: [`TODO.md`](./TODO.md)

**Note on local paths**: When running `create-harness-cli` with a local machine path (e.g. `/Users/...` on macOS), the executing context needs machine-targeted tools or a parent agent that can access that path. Cloud Agent sandbox executors may not see local machine paths directly.

## License

[MIT](./LICENSE)
