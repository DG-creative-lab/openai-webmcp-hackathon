# Conversion Lab pluggable product architecture

Status: accepted product direction; implementation pending
Decision date: 2026-08-31
Nearest delivery slice: Stage 1.5 — Pluggable Core proof

## Decision summary

Conversion Lab will be one **headless agent-conversion optimisation product** with several delivery surfaces, not separate SaaS, Shopify, SDK, CLI, MCP and WebMCP products.

The durable product is the versioned optimisation core and its authority-preserving workflow:

```text
authoritative product truth
  → audit buyer-intent and channel readiness
  → propose an evidence-bound representation
  → evaluate the proposal
  → bind exact approval
  → prepare or execute a bounded channel effect
  → produce a portable receipt
  → observe later outcomes
```

The current Vercel application is the first reference host. It combines a merchant workspace, a fictional Shopify-style product, a shopper view, an in-memory lifecycle store and page-scoped WebMCP tools in one React application. It proves the workflow but is not yet an installable Shopify app, public SDK, hosted API or multi-tenant SaaS.

The next proof will separate a DOM-free core from that reference host, make the web application consume the same core, and expose a narrow TypeScript SDK plus CLI. That is a portability proof, not completion of the production beta.

## Product forms are delivery surfaces

| Surface | Primary user | Responsibility | Does not own |
| --- | --- | --- | --- |
| SaaS workspace | Merchant or agency operator | Hosted audit, review, approval and reporting experience | Provider-native product truth or implicit publication authority |
| Shopify app and storefront connector | Shopify merchant | Installation, catalogue ingestion, authenticated merchant context and storefront WebMCP exposure | Optimisation semantics or Ads activation |
| TypeScript SDK | Product engineer | Embedded access to typed optimisation capabilities | Tenancy, hosting or credentials by default |
| HTTP API | Remote application | Network boundary over the same application capabilities | Permission inferred from possession of a product ID |
| CLI | Developer, operator or CI job | Local audit, evaluation and receipt verification | Authenticated merchant approval or uncontrolled channel writes |
| MCP server | External agent host | Headless agent access to permitted semantic capabilities | Web-page state or merchant authority |
| WebMCP adapter | Agent visiting a merchant web experience | Page-scoped tools over the host's visible shared state | Global account access, approval or invisible external effects |
| Agentic-commerce capability pack | Governed host platform | Cross-system jobs using typed findings, candidates and receipts | Host tenancy, policy, budgets or completion authority |

SDK, API, CLI and MCP are access protocols. SaaS and Shopify are distribution and hosting forms. WebMCP is the browser collaboration surface. They converge on one core contract and must not reimplement lifecycle, evidence or approval rules independently.

## Whole-system map

```text
Product sources                         Delivery surfaces
┌────────────────────┐                 ┌──────────────────────────┐
│ Fixture / JSON     │                 │ React SaaS workspace     │
│ Shopify Admin      │                 │ Shopify embedded app     │
│ Future PIM / CMS   │                 │ CLI / SDK / HTTP API     │
└─────────┬──────────┘                 │ MCP / WebMCP adapters     │
          │ catalogue + evidence       └────────────┬─────────────┘
          ▼                                         │ semantic calls
┌───────────────────────────────────────────────────▼─────────────┐
│                    Conversion Lab Core                         │
│ identity · evidence · audit · candidate · evaluation           │
│ lifecycle · approval binding · channel projection · receipts   │
└─────────┬───────────────────────┬───────────────────────┬───────┘
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────────┐   ┌─────────────────┐
│ Shopify channel │   │ OpenAI Ads channel  │   │ Receipt / host  │
│ preview / write │   │ feed / PAUSED proof │   │ interoperability│
└─────────────────┘   └─────────────────────┘   └─────────────────┘
```

The core must not import React, browser globals, `document.modelContext`, a hard-coded product fixture, provider credentials or a process-wide singleton. Hosts provide those concerns through explicit ports.

## Core responsibilities and ports

### Core-owned responsibilities

- Versioned commerce identities and provider-native target references.
- Evidence content, provenance, freshness and completeness.
- Buyer-intent batteries and deterministic evaluation.
- Immutable representation candidates and legal lifecycle transitions.
- Exact approval payload construction and verification.
- Channel projection validation and effect classification.
- Content-addressed optimisation receipts and semantic verification.

### Host- or adapter-owned responsibilities

| Port | Host responsibility | Required boundary |
| --- | --- | --- |
| `CatalogueSource` | Load products and evidence | Preserve tenant, provider identity, provenance, freshness and partial states |
| `WorkspaceRepository` | Persist workspace and lifecycle state | Optimistic concurrency or equivalent stale-write protection |
| `Clock` | Supply validation and issuance time | Valid UTC time; deterministic substitute in tests |
| `ApprovalAuthority` | Attest principal, policy, scope and expiry | Approval bound to exact target, snapshot, representation and evidence digest |
| `ChannelProjector` | Prepare provider-specific preview | No execution authority; explicit unsupported and failure states |
| `ChannelExecutor` | Perform a governed external effect | Current grant, idempotency, native identity, observation and rollback contract |
| `ReceiptSink` | Store or transmit portable receipts | Receipt integrity is not treated as execution authority |
| `OutcomeObserver` | Return later channel outcomes | Preserve source, window, completeness and synthetic/observed distinction |

The Stage 1.5 proof needs only an in-memory repository, injected clock, fixture/JSON catalogue source, existing preview projectors and receipt export. Production authorities and executors remain deferred.

## Capability surface

The same semantic capabilities may be exposed by the SDK, API, CLI, MCP, WebMCP or a host platform, subject to surface-specific authority:

| Capability | Class | Minimum input | Result | External effect |
| --- | --- | --- | --- | --- |
| `auditAgentConversionReadiness` | Read | Commerce snapshot and buyer-intent battery | Evidence gaps, intent coverage and channel blockers | None |
| `proposeEvidenceBoundRepresentation` | Proposal | Product identity, verified evidence and candidate copy | Immutable candidate with evidence bindings | None |
| `evaluateAgentSelection` | Read/simulation | Candidate, evidence and frozen battery version | Comparative deterministic result | None |
| `stageRepresentationForApproval` | Internal reversible state | Evaluated candidate | Approval-ready immutable state | None |
| `applyApprovalEnvelope` | Authority ingestion | Host-attested exact approval envelope | Approved lifecycle state or normalized rejection | None by itself |
| `prepareChannelProjection` | Preview | Current approval, representation and evidence | Shopify/Ads preview with effect metadata | None |
| `executeApprovedProjection` | Governed effect | Current authenticated grant and idempotency key | Provider effect receipt and rollback reference | Possible; deferred |
| `exportOptimizationReceipt` | Read/export | Complete mutually consistent workflow | Content-addressed portable receipt | Local artifact only |
| `verifyOptimizationReceipt` | Read | Portable receipt | Integrity and semantic validation result | None |

Surface names may be idiomatic, but their inputs, authority and effects must map to these capabilities without semantic loss.

## Authority allocation

| Claim or action | May propose | Verifier or attester | Authorizer | Executor | Retained evidence |
| --- | --- | --- | --- | --- | --- |
| Product identity and current catalogue facts | Adapter or agent query | Shopify or authoritative source adapter | Not applicable for reads | Catalogue source | Native ID, source, observation time and completeness |
| Representation candidate | Model, browser user or API caller | Deterministic evidence and schema validation | None | Core stores draft only | Candidate, evidence IDs and evaluation version |
| Buyer-intent result | Core evaluator | Frozen battery and authoritative evidence | None | Core | Inputs, battery version, result and timestamp |
| Merchant approval | Host UI or workflow | Authenticated host authority in production | Merchant policy | Core ingests envelope; does not invent it | Principal, policy, target, payload digest, issue and expiry times |
| Shopify publication | Approved workflow | Core revalidation plus Shopify permission | Current merchant grant | Shopify executor | Idempotency key, native response, observation and rollback reference |
| Paid preparation | Agent or operator | Core feed and approval validators | Current policy for any external write | Ads adapter | Feed digest, account scope, PAUSED state and acceptance limits |
| Optimisation receipt | Core | Independent semantic and digest validation | Never authorizes an effect by itself | Host stores or transmits | Complete evidence, approval context, channel declarations and digest |

No delivery surface may turn readable IDs, model confidence, a receipt digest, a WebMCP tool call or possession of an API token into merchant approval.

## Stage 1.5 — Pluggable Core proof

### Customer-visible claim

> The Conversion Lab website is one host of a reusable optimisation engine. The same product snapshot can be audited and its receipts verified without React, the demo storefront or `document.modelContext`.

### Smallest coherent implementation

1. Introduce a DOM-free `ConversionLabEngine` or equivalent application service over the existing versioned contracts.
2. Replace direct fixture construction inside the application store with injected `CommerceSnapshot`, clock and preview dependencies.
3. Keep one workspace instance shared by React and the WebMCP adapter so the visible-state promise remains intact.
4. Export a narrow TypeScript SDK entry point for audit, evaluation and receipt verification.
5. Add a CLI that consumes the same SDK and accepts versioned JSON input.
6. Include one non-React example input and machine-readable output.
7. Prove parity: identical inputs produce the same evaluation and receipt-verification result through the web host and CLI/SDK.

Candidate CLI contract:

```text
conversion-lab audit <commerce-snapshot.json>
conversion-lab evaluate <commerce-snapshot.json> <candidate.json>
conversion-lab verify-receipt <optimization-receipt.json>
```

The CLI should emit versioned JSON on stdout, diagnostics on stderr and a non-zero exit code for invalid input or failed verification. It must not approve, publish, upload, activate, spend, check out or pay.

### Explicit non-goals

- No public HTTP deployment, API keys, rate limits or remote persistence.
- No MCP server in the hackathon proof.
- No npm publication guarantee.
- No Shopify OAuth, app installation, live update or rollback.
- No authenticated merchant authority, multi-tenancy or billing.
- No Ads upload, API write, activation or spend.
- No migration of the agentic-commerce platform.

### Acceptance evidence

- Existing ten-tool WebMCP and browser journey remain behaviorally unchanged.
- Core and SDK modules import no React, DOM or page-scoped WebMCP code.
- The web host no longer imports the Fieldwork fixture as hidden global product truth inside a process-wide singleton construction path.
- CLI audit runs from a clean checkout without browser automation or credentials.
- CLI and web paths pass golden contract fixtures for identity, evidence, evaluation and receipt verification.
- Wrong-product evidence, stale approval, mutation, over-precise money and prohibited effects remain rejected.
- `make test-all` and native ChatGPT WebMCP acceptance both pass after extraction.

### Delivery estimate and cut line

The bounded proof is estimated at 8–14 focused engineering hours including tests and documentation. It may start only after native ChatGPT WebMCP acceptance and a second clean-session rehearsal pass. It must merge and deploy before the September 2 internal feature freeze; otherwise it is deferred intact.

## Evolution after the proof

### Standalone and Shopify beta

Add Shopify OAuth, tenant isolation, durable repositories, multi-product ingestion, authenticated approvals, controlled publication/rollback and outcome reporting. The SaaS workspace and Shopify embedded app remain two hosts of the same core.

### Remote API and MCP

Expose the application service through a versioned HTTP job contract after authentication, idempotency, persistence and cancellation semantics exist. An MCP server can then be a thin client of that API or SDK; it must not acquire broader authority than the caller and must not duplicate WebMCP's page collaboration role.

### Agentic-commerce platform

Integrate through the platform's signed, idempotent external-agent job façade. Conversion Lab owns domain findings, candidates, evaluations and receipts; the host retains tenant, workflow, approval, budget and completion authority.

## Principal risks and recovery

| Risk | Impact | Prevention | Recovery |
| --- | --- | --- | --- |
| UI and CLI implement different rules | Conflicting product truth and misleading portability claim | One core service and golden parity fixtures | Block release; remove the divergent adapter |
| Generic contracts erase Shopify identity | Cross-product or cross-tenant effects | Preserve provider-native identity and provenance end to end | Reject unsupported mapping; require explicit adapter change |
| Receipt becomes accidental authority | Unauthorized publication or paid effect | Receipts remain evidence artifacts; current grants are revalidated | Reject execution and record normalized denial |
| Retry duplicates an external effect | Duplicate publication or provider cost | Idempotency keys and provider observation before retry | Reconcile native state and use rollback where supported |
| Refactor destabilizes the judge journey | Submission failure despite stronger architecture | Stage 1.5 cut line, same browser acceptance and rollback by reverting the isolated branch | Defer proof and retain the current reference host |
| Extra protocols dilute the WebMCP story | Lower judging clarity | Ship SDK + CLI only; describe API/MCP as future adapters | Remove unproven surfaces from submission narrative |

## Open decisions

| Decision | Current position | Evidence needed |
| --- | --- | --- |
| SDK packaging | Repository-local TypeScript entry point first | Consumer spike before npm publication |
| Stateful engine shape | Injected workspace service with one owner per instance | Implementation spike and concurrent-state tests |
| CLI scope | Audit, evaluate and verify only | Judge/demo value and time remaining after acceptance |
| Canonical hosted boundary | SaaS likely becomes control plane; Shopify is an embedded host and connector | Merchant onboarding research |
| HTTP API timing | After persistence, authentication and idempotency | Stage 2 design-partner need |
| MCP timing | After stable SDK/API capability contract | Agentic-platform integration need; avoid WebMCP confusion |
| Non-Shopify support | JSON fixture proves contract portability, not provider completeness | A second authoritative catalogue adapter |
