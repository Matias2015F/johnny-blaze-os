# AGENTS.md

Codex must treat `CLAUDE.md` in this repository root as the single source of truth for MotoGestion rules.

Before any task:

1. Read `.clou/ESTADO.md`.
2. Read `CLAUDE.md`.
3. Apply the same MotoGestion filter, Golden Path, backup, safety, commit, push and deploy rules defined there.
4. Reconstruct the real state with Git before editing:
   - `git status --short`
   - `git rev-parse HEAD`
   - `git log -5 --oneline --decorate`
5. Distinguish explicitly:
   - `DECIDED`
   - `IMPLEMENTED_IN_DOMAIN`
   - `CONNECTED_TO_UI`
   - `ENFORCED_IN_RUNTIME`
   - `DEPLOYED`

Do not duplicate project rules in this file. If a rule changes, update `CLAUDE.md` and keep this file as a pointer.

Codex-specific note:

- The only working directory for this app, for both Claude and Codex, is `C:\Users\Usuario\johnny-blaze-os`.
- The OneDrive monorepo (`ANTIGRAVITI_PROYECTOS\Motogestion.ar`) and any preservation copy are out of scope. Do not read, build, or commit there under any circumstance, even if asked ambiguously.
- Do not add new files under `api/` without checking `.clou/ESTADO.md`; Vercel Hobby is at the serverless function limit.
