# Testing and CI

The quality system is deliberately layered. Agents may help discover failure cases and extend tests, but deterministic code decides whether a branch is safe to merge.

## Test layers

| Layer | Command | Protects | Typical runtime |
| --- | --- | --- | --- |
| Unit and narrow contracts | `make test-unit` | Evaluation, approval digests, store behavior, WebMCP registration schemas | Seconds |
| Adversarial | `make test-adversarial` | Illegal lifecycle edges, stale authority, hostile runtime values, unsupported claims, prohibited agent capabilities | Seconds |
| Infrastructure | `make test-infrastructure` | Change-impact mapping and conservative fallback behavior | Seconds |
| Coverage gate | `make test-coverage` | Unit and adversarial behavior across domain, store, and WebMCP control modules | Seconds |
| Browser smoke | `make test-smoke` | Real page boot, tool discovery, shared session state, visible approval checkpoint, publication, Ads projection, shopper recommendation and cart | Under a minute |
| Complete merge gate | `make test-all` | Diff hygiene, typecheck, coverage thresholds, production build and browser journey | Under a few minutes |

Coverage is intentionally scoped to `src/domain`, `src/store`, and `src/webmcp/registerTools.ts`, where deterministic product and authority logic lives. The current thresholds are 85% statements, functions and lines, and 75% branches. The browser suite supplies behavioral evidence for React composition; these numbers are not presented as whole-system coverage.

## Change-aware selection

Run `make test-affected BASE_REF=origin/main` for branch feedback. The selector is explicit and conservative:

| Changed surface | Selected evidence |
| --- | --- |
| Domain, store, or WebMCP | Coverage, build, browser smoke |
| React UI, CSS, HTML, public assets | Typecheck, build, browser smoke |
| Adversarial tests | Adversarial suite |
| Browser tests | Browser smoke |
| Dependencies, TypeScript/Vite/Playwright config, Makefile, scripts or CI | Complete gate |
| Documentation or repo skill only | Diff hygiene |
| Unknown path | Complete gate |

Make provides stable entry points; `scripts/test-affected.mjs` owns dependency-aware selection. This avoids hiding path logic inside shell recipes. The selector accelerates branch work, but it is not the final merge authority.

## Pull-request policy

- Develop on `feature/<short-name>` or `fix/<short-name>` branches.
- Feature and fix branch pushes run the change-aware selector.
- Every pull request into `main` runs `make test-all`, regardless of changed paths.
- A push to `main` reruns the complete gate.
- Configure the GitHub branch protection rule for `main` to require the **Complete merge gate** check and at least one reviewed pull request.

This gives granular feedback during development while retaining a macro-level proof before and after merge.

## Repo-scoped Codex skill

The `$webmcp-quality-harness` skill in `.agents/skills` gives future Codex sessions the product invariants, selection rules and evidence-reporting standard. It may design or diagnose tests; it cannot approve variants, authorize external effects, lower a gate, or replace deterministic CI.

The browser smoke test supplies a standards-shaped `document.modelContext` host before the app loads. It verifies that the nine tools are discoverable and executable in one shared page session. Its scripted click at the approval checkpoint is synthetic test setup, not evidence of human identity or authorization. The actual Codex in-app-browser journey remains a separate acceptance check for the browser's native WebMCP implementation.
