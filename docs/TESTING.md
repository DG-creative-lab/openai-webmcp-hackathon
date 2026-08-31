# Testing and CI

The quality system is deliberately layered. Agents may help discover failure cases and extend tests, but deterministic code decides whether a branch is safe to merge.

## Test layers

| Layer | Command | Protects | Typical runtime |
| --- | --- | --- | --- |
| Unit and narrow contracts | `make test-unit` | Evaluation, approval digests, store behavior, WebMCP registration schemas | Seconds |
| Adversarial | `make test-adversarial` | Illegal lifecycle edges, stale authority, hostile runtime values, unsupported claims, prohibited agent capabilities | Seconds |
| Infrastructure | `make test-infrastructure` | Change-impact mapping and conservative fallback behavior | Seconds |
| Submission contract | `make test-submission` | Required public links, license, claims, video duration and honest external-checkpoint status | Seconds |
| Coverage gate | `make test-coverage` | Unit and adversarial behavior across domain, store, and WebMCP control modules | Seconds |
| Browser smoke | `make test-smoke` | Real page boot, tool discovery, shared session state, visible approval checkpoint, publication, digest-bound Ads CSV and optimisation-receipt downloads, shopper recommendation and cart | Under a minute |
| Deployment smoke | `make test-deployment` | Production Vite output, static assets, and the complete Vercel-shaped browser journey | Under a minute |
| Complete merge gate | `make test-all` | Diff hygiene, typecheck, submission contract, coverage thresholds, production build and browser journey | Under a few minutes |

Coverage is intentionally scoped to `src/commerce`, `src/domain`, `src/store`, and `src/webmcp/registerTools.ts`, where deterministic product, adapter and authority logic lives. The current thresholds are 85% statements, functions and lines, and 75% branches. The browser suite supplies behavioral evidence for React composition; these numbers are not presented as whole-system coverage.

## Change-aware selection

Run `make test-affected BASE_REF=origin/main` for branch feedback. The selector is explicit and conservative:

| Changed surface | Selected evidence |
| --- | --- |
| Commerce adapters, domain, store, or WebMCP | Coverage, build, browser smoke |
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

The browser smoke test supplies a standards-shaped `document.modelContext` host before the app loads. It verifies that the ten tools are discoverable and executable in one shared page session, including the read-only portable receipt after both channel projections complete. Its scripted click at the approval checkpoint is synthetic test setup, not evidence of human identity or authorization. The actual Codex in-app-browser journey remains a separate acceptance check for the browser's native WebMCP implementation.

Production startup retries host discovery ten times over approximately 4.5 seconds so a browser that injects `document.modelContext` just after page boot can still receive the tool surface. Registration is sequential and idempotent per browser host, including concurrent attempts. If any registration rejects, the app records WebMCP as unavailable, stops before later tools, and permanently disables that host object because the browser API provides no transactional registration or unregister recovery; a fresh page host is required. Unit tests cover late availability, bounded fallback, partial rejection, invalid retry configuration, and duplicate prevention.

The deployment smoke serves the generated `dist` directory through Vite preview and repeats the complete journey against production output. Set `DEPLOYMENT_BASE_URL=https://<deployment>.vercel.app` when invoking `pnpm test:deployment` to run the same deterministic journey against a Vercel preview or production deployment without starting a local server. This still does not replace the native WebMCP acceptance journey in a clean ChatGPT browser session.

The submission contract validates the repository-owned portion of challenge readiness. It checks the manifest, public links, MIT license, structured capability facts, capability-derived claims, and under-three-minute video plan. It deliberately allows external checkpoints to remain `pending`; a native WebMCP run, second clean session, public video, and final Devpost submission may be marked `passed` only with checkpoint-specific dated metadata and related evidence or receipt URLs. A green merge gate therefore never masquerades as completed external acceptance.

## Planned Stage 1.5 portability evidence

The pluggable-core work is not implemented yet. When it begins, the quality portfolio must add evidence at the module and composed-system boundaries rather than treating a new package layout as proof of decoupling:

| Evidence | Protects |
| --- | --- |
| Import-boundary test | Core and SDK do not depend on React, DOM, browser globals, `document.modelContext` or the reference fixture |
| Golden snapshot parity | Web host, SDK and CLI preserve identity, evidence, audit and evaluation semantics for the same versioned input |
| CLI contract tests | Versioned JSON stdout, stderr diagnostics, stable exit codes and no approval or external-effect commands |
| Host-instance tests | Two engine instances cannot share lifecycle, approval, cart or activity state accidentally |
| Authority mutation suite | CLI/API/MCP wrappers cannot broaden approval, target scope, evidence freshness or effect class; cross-channel, changed-destination, changed-projection, raised-budget, revoked, expired and new-replay-key grants fail closed |
| Replay-ledger schedule suite | Two workers validate the same `single_use` grant simultaneously but only one CAS claim wins and invokes a provider without native idempotency; stale fences, lease expiry and ambiguous outcomes cannot trigger a second call |
| Outcome-lineage suite | Wrong representation/effect IDs, overlapping windows, duplicate events and product-level aggregates remain partial/unknown instead of becoming exact lift |
| Existing browser/deployment journey | Core extraction does not regress the ten-tool visible shared-state experience |
| Native ChatGPT acceptance | The deployed WebMCP adapter still registers and completes the actual human-agent journey |

The implementation branch should begin with `make test-affected BASE_REF=origin/main` and finish with `make test-all`. A successful CLI run cannot replace browser acceptance, and a successful browser run cannot prove SDK/CLI parity. The canonical design and cut line are in [PLUGGABLE-ARCHITECTURE.md](PLUGGABLE-ARCHITECTURE.md).
