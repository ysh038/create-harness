# create-harness

> Scaffold your AI coding agent's context files in one command.

`create-harness` bootstraps the config and context files that AI coding agents
(Claude Code, Cursor, Codex, and others) rely on — `CLAUDE.md`, `.cursorrules`,
`AGENTS.md`, and project-specific workflow rules — so every project starts
with a consistent "harness" for AI-assisted development.

Originally built for React/frontend projects, but framework-agnostic by design —
works for backend, full-stack, or any language.

## Why
Every AI coding agent expects its own context file, and every project reinvents
the same rules (coding conventions, review checklist, folder structure, PR flow)
from scratch. `create-harness` gives you a sane, opinionated starting point
you can customize per project.
