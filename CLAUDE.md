<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

# Project conventions (read before changing code)

This is an India-first legal-document drafting platform. Before editing, read:

- **[`CONTRIBUTING.md`](CONTRIBUTING.md)** — repo map, setup, and the golden rules.
- **[`docs/CODING_STANDARDS.md`](docs/CODING_STANDARDS.md)** — TS/React/NestJS conventions, module
  boundaries, i18n/translations, error handling, and "recipes" for adding a doc type / lib / module / route.
- **[`docs/BUILD_LOG.md`](docs/BUILD_LOG.md)** — dated journal of what changed and why (resume point).
- **[`docs/`](docs/)** — market analysis, product roadmap, technical design, progress tracker.

Non-negotiables: one `DocumentTypeBundle` per doc type is the source of truth; the AI never authors
statute citations (use `@org/legal-reference` + `{{applicable_law}}`); verify changes with
typecheck + eslint (+ build) and report honestly what you did/didn't run; every app needs a
solution-style `tsconfig.json`. After a unit of work, append to `docs/BUILD_LOG.md`.
