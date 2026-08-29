import { useEffect, useState, useSyncExternalStore } from "react";
import { appStore } from "./store/appStore";
import type { Activity, AppState, IntentResult } from "./domain/types";
import "./styles.css";

const journeySteps = [
  { number: "01", label: "Evidence draft", actor: "Agent", effect: "Draft only" },
  { number: "02", label: "Buyer evaluation", actor: "Agent", effect: "Simulation" },
  { number: "03", label: "Review stage", actor: "Agent", effect: "No publish" },
  { number: "04", label: "Exact approval", actor: "Browser user", effect: "UI checkpoint" },
  { number: "05", label: "Channel projection", actor: "Agent", effect: "Demo + £0 paid" },
  { number: "06", label: "Shopper cart", actor: "Agent", effect: "No checkout" },
];

const starterPrompt = "Inspect this Conversion Lab workspace. Create and evaluate an evidence-led product variant, stage it at the visible review checkpoint, and stop before approval.";
const continuationPrompt = "Continue the approved journey: publish the exact variant, prepare the PAUSED Ads projection, find the product for a waterproof 16-inch laptop need, and set the demo cart quantity to 2.";

function journeyGuide(state: AppState) {
  if (state.adsPackage.status === "ready" && state.cartQuantity > 0) {
    return { progress: 6, actor: "Complete", effect: "Verified", title: "Judge journey complete", instruction: "Open Shopper view to verify the approved copy and shared cart.", prompt: null };
  }
  if (state.adsPackage.status === "ready") {
    return { progress: 5, actor: "Agent", effect: "Demo cart", title: "Complete the shopper handoff", instruction: "Match the published product to the shopper need and set the visible cart quantity to 2. Checkout stays unavailable.", prompt: continuationPrompt };
  }
  if (state.variant.status === "published") {
    return { progress: 4, actor: "Agent", effect: "Paid projection", title: "Project the approved truth", instruction: "Prepare the OpenAI Ads package. It must remain PAUSED, credential-free and £0 spend.", prompt: continuationPrompt };
  }
  if (state.variant.status === "approved") {
    return { progress: 4, actor: "Agent", effect: "Demo publish", title: "Continue after visible approval", instruction: "Publish the exact approved digest to the demo storefront, then prepare the paid projection.", prompt: continuationPrompt };
  }
  if (state.variant.status === "staged") {
    return { progress: 3, actor: "Browser user", effect: "UI checkpoint", title: "Visible approval checkpoint", instruction: "Review the tested copy and select Approve exact variant. Approval is absent from site tools, but this credential-free demo does not authenticate the browser actor.", prompt: null };
  }
  if (state.variant.status === "draft" && state.variantEvaluation) {
    return { progress: 2, actor: "Agent", effect: "Review stage", title: "Stage the tested variant", instruction: "Move the 8/8 draft to visible review, then stop. Staging does not approve or publish it.", prompt: starterPrompt };
  }
  if (state.variant.status === "draft") {
    return { progress: 1, actor: "Agent", effect: "Simulation", title: "Run the fixed buyer test", instruction: "Evaluate this evidence-led draft against the same eight buyer needs used for the baseline.", prompt: starterPrompt };
  }
  return { progress: 0, actor: "Agent", effect: "Read + draft", title: "Start with one agent prompt", instruction: "The agent inspects verified evidence, creates a better draft, evaluates it and stops at the visible review checkpoint.", prompt: starterPrompt };
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StatusDot({ tone = "neutral" }: { tone?: "neutral" | "good" | "warning" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function AppHeader() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const [resetArmed, setResetArmed] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);

  useEffect(() => {
    if (!resetComplete) return;
    const timeout = window.setTimeout(() => setResetComplete(false), 2600);
    return () => window.clearTimeout(timeout);
  }, [resetComplete]);

  const confirmReset = () => {
    appStore.reset();
    setResetArmed(false);
    setResetComplete(true);
  };

  return (
    <header className="app-header">
      <button className="wordmark" onClick={() => appStore.setSurface("studio")} aria-label="Open Conversion Lab studio">
        <span className="wordmark-mark">CL</span>
        <span>Conversion Lab</span>
        <span className="alpha">α / 01</span>
      </button>
      <nav className="surface-nav" aria-label="Application views">
        <button className={state.surface === "studio" ? "is-active" : ""} onClick={() => appStore.setSurface("studio")}>Growth studio</button>
        <button className={state.surface === "storefront" ? "is-active" : ""} onClick={() => appStore.setSurface("storefront")}>Shopper view <span className="count">{state.cartQuantity}</span></button>
      </nav>
      <div className="header-actions">
        <div className="connection-state">
          <StatusDot tone={state.webmcpAvailable ? "good" : "neutral"} />
          <span>{state.webmcpAvailable ? "9 site tools · 3 read / 6 state" : "WebMCP-ready"}</span>
        </div>
        <button
          type="button"
          className="reset-trigger"
          aria-expanded={resetArmed}
          aria-controls="reset-confirmation"
          onClick={() => { setResetArmed((current) => !current); setResetComplete(false); }}
        >
          <span aria-hidden="true">↺</span> Reset demo
        </button>
      </div>
      {resetArmed && (
        <aside id="reset-confirmation" className="reset-confirmation" role="alertdialog" aria-labelledby="reset-title" aria-describedby="reset-description">
          <div>
            <strong id="reset-title">Return to the verified baseline?</strong>
            <span id="reset-description">Clears evaluation, approval, channel projections and cart. Product evidence remains.</span>
          </div>
          <div className="reset-confirmation__actions">
            <button type="button" onClick={() => setResetArmed(false)}>Cancel</button>
            <button type="button" className="reset-confirm" onClick={confirmReset}>Confirm reset</button>
          </div>
        </aside>
      )}
      {resetComplete && <div className="reset-complete" role="status" aria-live="polite"><StatusDot tone="good" /> Demo returned to baseline</div>}
    </header>
  );
}

function ScoreRing({ score, total, muted = false }: { score: number; total: number; muted?: boolean }) {
  const percentage = Math.round((score / total) * 100);
  return (
    <div className={`score-ring ${muted ? "score-ring--muted" : ""}`} style={{ "--score": `${percentage * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{score}</strong><span>/{total}</span></div>
    </div>
  );
}

function JudgeGuide({ state }: { state: AppState }) {
  const guide = journeyGuide(state);
  return (
    <section className={`judge-guide ${guide.effect === "UI checkpoint" ? "is-review-gate" : ""}`} aria-labelledby="judge-guide-title">
      <div className="guide-copy">
        <div className="guide-kicker"><span>Guided judge journey</span><span>{guide.progress === 6 ? "06 / 06" : `${String(guide.progress + 1).padStart(2, "0")} / 06`}</span></div>
        <div className="guide-actor"><span>{guide.actor}</span><span>{guide.effect}</span></div>
        <h2 id="judge-guide-title">{guide.title}</h2>
        <p>{guide.instruction}</p>
        {guide.prompt && <div className="guide-prompt"><span>Say to Codex</span><code>{guide.prompt}</code></div>}
      </div>
      <ol className="guide-steps" aria-label="Six checkpoint demo progress">
        {journeySteps.map((step, index) => (
          <li key={step.number} className={index < guide.progress ? "is-done" : index === guide.progress ? "is-current" : ""}>
            <span className="guide-step-number">{step.number}</span>
            <div><strong>{step.label}</strong><small>{step.actor} · {step.effect}</small></div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function IntentRow({ item }: { item: IntentResult }) {
  return (
    <li>
      <span className={`match-mark ${item.matched ? "is-match" : ""}`}>{item.matched ? "✓" : "—"}</span>
      <span>{item.shortLabel}</span>
      <small>{item.matched ? "Evidence matched" : "Copy gap"}</small>
    </li>
  );
}

function ActivityLog({ items }: { items: Activity[] }) {
  return (
    <section className="activity-log">
      <div className="section-heading"><p>Live operation log</p><span>{items.length} events</span></div>
      <ol>
        {items.slice(0, 5).map((item) => (
          <li key={item.id}>
            <div><strong>{item.action}</strong><span>{item.actor} · {formatTime(item.time)}</span></div>
            <p>{item.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Studio() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const score = state.variantEvaluation?.score ?? state.baselineEvaluation.score;
  const canStage = Boolean(state.variantEvaluation) && state.variant.status === "draft";
  const canApprove = state.variant.status === "staged";
  const canPublish = state.variant.status === "approved";
  const isPublished = state.variant.status === "published";
  const isComplete = state.adsPackage.status === "ready" && state.cartQuantity > 0;

  const runPrimaryAction = () => {
    try {
      if (state.variant.status === "baseline") appStore.generateVariant("Browser user");
      else if (!state.variantEvaluation) appStore.runEvaluation("Browser user");
      else if (canStage) appStore.stageVariant("Browser user");
      else if (canApprove) appStore.recordVisibleApproval();
      else if (canPublish) appStore.publishVariant("Browser user");
      else if (state.adsPackage.status !== "ready") appStore.prepareAds("Browser user");
      else appStore.setSurface("storefront");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The action could not be completed.");
    }
  };

  const actionLabel = state.variant.status === "baseline" ? "Create evidence-led draft" : !state.variantEvaluation ? "Run buyer tests" : canStage ? "Stage for review" : canApprove ? "Approve exact variant" : canPublish ? "Publish to demo store" : state.adsPackage.status !== "ready" ? "Prepare paid projection" : isComplete ? "Journey complete" : "Open shopper view";

  return (
    <main className="studio page-enter">
      <section className="studio-intro">
        <div>
          <p className="eyebrow">Fieldwork Supply / Shopify catalogue / URB-24-BLK</p>
          <h1>Make the product easier for agents to choose.</h1>
        </div>
        <p className="intro-note">One evidence layer. One approved message. Two acquisition surfaces.</p>
      </section>

      <JudgeGuide state={state} />

      <section className="workspace-grid">
        <div className="product-visual">
          <img src={state.product.image} alt="Black waterproof commuter pack mounted on a bicycle rack in the rain" />
          <div className="image-caption">
            <span>Demo merchant / Product 01</span>
            <strong>{state.product.brand}</strong>
          </div>
          <div className="image-price">£{state.product.price}</div>
        </div>

        <div className="control-panel">
          <div className="panel-kicker"><span>Active experiment</span><span className={`state-label state-label--${state.variant.status}`}>{state.variant.status}</span></div>
          <h2>{state.variant.title}</h2>
          <p className="variant-description">{state.variant.description}</p>

          <div className="score-comparison">
            <div><ScoreRing score={state.baselineEvaluation.score} total={state.baselineEvaluation.total} muted /><p>Current copy</p></div>
            <span className="score-arrow">→</span>
            <div><ScoreRing score={score} total={8} /><p>Tested variant</p></div>
            <div className="score-copy"><strong>{score === 8 ? "8 buyer needs resolved" : "Evidence is ready"}</strong><span>{score === 8 ? "Every match can be traced to a source." : "Run the same task battery agents will face."}</span></div>
          </div>

          <button className={`primary-action ${canApprove ? "is-review-gate" : ""}`} onClick={runPrimaryAction} disabled={isComplete}>
            <span>{actionLabel}</span><span aria-hidden="true">↗</span>
          </button>
          <p className={`authority-note ${canApprove ? "is-review-gate" : ""}`}><span>{canApprove ? "Demo review" : "Authority boundary"}</span>{canApprove ? "Approval is absent from site tools. This local demo does not authenticate whether a person or browser automation selects this control." : "Agents may draft, test and stage. Production publication requires authenticated merchant authority; paid activation is never available here."}</p>
        </div>
      </section>

      <section className="metrics-strip" aria-label="Experiment metrics">
        <div><span>Verified evidence</span><strong>{state.evidence.filter((item) => item.verified).length}<small>/08</small></strong></div>
        <div><span>Intent coverage</span><strong>{score * 12.5}<small>%</small></strong></div>
        <div><span>Unbound claims</span><strong>0</strong></div>
        <div><span>Projected spend</span><strong>£0</strong></div>
      </section>

      <section className="lower-grid">
        <section className="evidence-panel">
          <div className="section-heading"><p>Buyer-intent battery</p><span>Deterministic evaluation / 08 tasks</span></div>
          <div className="evaluation-grid">
            <ol className="intent-list">
              {(state.variantEvaluation?.results ?? state.baselineEvaluation.results).map((item) => <IntentRow key={item.id} item={item} />)}
            </ol>
            <div className="evidence-stack">
              <p>Claims allowed into copy</p>
              {state.evidence.slice(0, 5).map((item) => (
                <div key={item.id}><StatusDot tone="good" /><span><strong>{item.value}</strong><small>{item.source}</small></span></div>
              ))}
              <button onClick={() => appStore.generateVariant("Browser user")}>Regenerate from evidence</button>
            </div>
          </div>
        </section>
        <ActivityLog items={state.activities} />
      </section>

      <section className="channels-section">
        <div className="section-heading"><p>One optimisation loop, two surfaces</p><span>Same approved product truth</span></div>
        <div className="channel-grid">
          <article>
            <div className="channel-index">01 / ORGANIC</div>
            <h3>Shopify + WebMCP</h3>
            <p>Versioned fixture truth feeds the demo today; the same native identity and approved digest produce a Shopify Admin 2026-07 update preview without exposing credentials.</p>
            <div className="channel-status"><StatusDot tone={isPublished ? "good" : "warning"} /><span>{state.commerce.updatePreview ? "Demo published · Shopify payload preview ready" : "Awaiting approved publication"}</span></div>
          </article>
          <article className="channel-paid">
            <div className="channel-index">02 / PAID</div>
            <h3>OpenAI Ads projection</h3>
            <p>The same evidence becomes an Ads-eligible product-feed row and relevant product ad template—not a separate creative fiction.</p>
            <div className="channel-status"><StatusDot tone={state.adsPackage.status === "ready" ? "good" : "warning"} /><span>{state.adsPackage.status === "ready" ? "Schema valid locally · Campaign PAUSED" : "Projection not prepared"}</span></div>
          </article>
        </div>
      </section>
    </main>
  );
}

function Storefront() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const copy = state.variant.status === "published" ? state.variant : state.product.baseline;
  const published = state.variant.status === "published";
  return (
    <main className="storefront page-enter">
      <div className="shop-banner"><span>FIELDWORK / CITY SYSTEMS</span><span>Free UK delivery over £120</span></div>
      <section className="product-page">
        <div className="store-image"><img src={state.product.image} alt="Modular commuter backpack attached to a bicycle rack" /><span>01 / 03</span></div>
        <div className="product-copy">
          <p className="eyebrow">Commuter systems / Black</p>
          <h1>{copy.title}</h1>
          <div className="price-line"><strong>£{state.product.price}</strong><span><StatusDot tone="good" /> In stock · Friday delivery</span></div>
          <p className="store-description">{copy.description}</p>
          <ul>{copy.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          <button className="add-button" onClick={() => appStore.updateCart(state.cartQuantity + 1, "Browser user")}><span>Add to bag</span><span>{state.cartQuantity ? `${state.cartQuantity} in bag` : "£159"}</span></button>
          <div className="agent-proof">
            <div><span>Agent-readable product proof</span><strong>{published ? "08 / 08" : `${state.baselineEvaluation.score.toString().padStart(2, "0")} / 08`}</strong></div>
            <p>{published ? "This page exposes verified fit, weather, repair, price and delivery facts through 9 WebMCP site tools." : "The approved evidence-led variant has not been published yet. Agents still see the current generic copy."}</p>
            <button onClick={() => appStore.setSurface("studio")}>Inspect in growth studio →</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [state.surface]);

  return <><AppHeader />{state.surface === "studio" ? <Studio /> : <Storefront />}</>;
}
