import { useSyncExternalStore } from "react";
import { appStore } from "./store/appStore";
import type { Activity, IntentResult, VariantStatus } from "./domain/types";
import "./styles.css";

const workflow: { key: VariantStatus; number: string; label: string }[] = [
  { key: "draft", number: "01", label: "Evidence copy" },
  { key: "staged", number: "02", label: "Buyer tests" },
  { key: "approved", number: "03", label: "Human approval" },
  { key: "published", number: "04", label: "Channel publish" },
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function StatusDot({ tone = "neutral" }: { tone?: "neutral" | "good" | "warning" }) {
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function AppHeader() {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
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
      <div className="connection-state">
        <StatusDot tone={state.webmcpAvailable ? "good" : "neutral"} />
        <span>{state.webmcpAvailable ? "9 site tools live" : "WebMCP-ready"}</span>
      </div>
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

function WorkflowRail({ status }: { status: VariantStatus }) {
  const rank: Record<VariantStatus, number> = { baseline: 0, draft: 1, staged: 2, approved: 3, published: 4 };
  return (
    <ol className="workflow-rail">
      {workflow.map((step, index) => (
        <li key={step.key} className={rank[status] >= index + 1 ? "is-done" : ""}>
          <span>{step.number}</span><p>{step.label}</p>
        </li>
      ))}
    </ol>
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
  const score = state.variantEvaluation?.score ?? 0;
  const canStage = Boolean(state.variantEvaluation) && state.variant.status === "draft";
  const canApprove = state.variant.status === "staged";
  const canPublish = state.variant.status === "approved";
  const isPublished = state.variant.status === "published";

  const runPrimaryAction = () => {
    try {
      if (!state.variantEvaluation) appStore.runEvaluation("Merchant");
      else if (canStage) appStore.stageVariant("Merchant");
      else if (canApprove) appStore.approveVariant();
      else if (canPublish) appStore.publishVariant("Merchant");
      else appStore.prepareAds("Merchant");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The action could not be completed.");
    }
  };

  const actionLabel = !state.variantEvaluation ? "Run buyer tests" : canStage ? "Stage for review" : canApprove ? "Approve exact variant" : canPublish ? "Publish to demo store" : state.adsPackage.status !== "ready" ? "Prepare paid projection" : "Package ready";

  return (
    <main className="studio page-enter">
      <section className="studio-intro">
        <div>
          <p className="eyebrow">Fieldwork Supply / Shopify catalogue / URB-24-BLK</p>
          <h1>Make the product easier for agents to choose.</h1>
        </div>
        <p className="intro-note">One evidence layer. One approved message. Two acquisition surfaces.</p>
      </section>

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
          <WorkflowRail status={state.variant.status} />

          <div className="score-comparison">
            <div><ScoreRing score={state.baselineEvaluation.score} total={state.baselineEvaluation.total} muted /><p>Current copy</p></div>
            <span className="score-arrow">→</span>
            <div><ScoreRing score={score} total={8} /><p>Tested variant</p></div>
            <div className="score-copy"><strong>{score === 8 ? "8 buyer needs resolved" : "Evidence is ready"}</strong><span>{score === 8 ? "Every match can be traced to a source." : "Run the same task battery agents will face."}</span></div>
          </div>

          <button className="primary-action" onClick={runPrimaryAction} disabled={state.adsPackage.status === "ready"}>
            <span>{actionLabel}</span><span aria-hidden="true">↗</span>
          </button>
          <p className="authority-note"><span>Authority boundary</span> Agents may draft, test and stage. A merchant approves. Paid activation is never available.</p>
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
              <button onClick={() => appStore.generateVariant("Merchant")}>Regenerate from evidence</button>
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
            <p>Agents search verified product facts, explain the match and update the visible demo cart in the shopper’s live session.</p>
            <div className="channel-status"><StatusDot tone={isPublished ? "good" : "warning"} /><span>{isPublished ? "Published to demo storefront" : "Awaiting approved publication"}</span></div>
          </article>
          <article className="channel-paid">
            <div className="channel-index">02 / PAID</div>
            <h3>OpenAI Ads projection</h3>
            <p>The same evidence becomes an Ads-eligible product-feed row and relevant product ad template—not a separate creative fiction.</p>
            <div className="channel-status"><StatusDot tone={state.adsPackage.status === "ready" ? "good" : "warning"} /><span>{state.adsPackage.status === "ready" ? "Feed ready · Campaign PAUSED" : "Projection not prepared"}</span></div>
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
          <button className="add-button" onClick={() => appStore.updateCart(state.cartQuantity + 1, "Merchant")}><span>Add to bag</span><span>{state.cartQuantity ? `${state.cartQuantity} in bag` : "£159"}</span></button>
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
  return <><AppHeader />{state.surface === "studio" ? <Studio /> : <Storefront />}</>;
}
