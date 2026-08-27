import { appStore } from "../store/appStore";

const emptySchema = { type: "object", properties: {}, additionalProperties: false };

function snapshot() {
  const state = appStore.getState();
  return {
    product: { id: state.product.id, sku: state.product.sku, price: state.product.price, inventory: state.product.inventory },
    variant: { id: state.variant.id, status: state.variant.status, approvedDigest: state.variant.approvedDigest },
    evaluation: state.variantEvaluation ? { score: state.variantEvaluation.score, total: state.variantEvaluation.total } : null,
    ads: { status: state.adsPackage.status, campaignStatus: state.adsPackage.campaignStatus },
    cartQuantity: state.cartQuantity,
  };
}

export async function registerWebMCPTools(): Promise<boolean> {
  const registerTool = document.modelContext?.registerTool?.bind(document.modelContext);
  if (!registerTool) {
    appStore.setWebmcpAvailable(false);
    return false;
  }

  const tools = [
    {
      name: "get_growth_workspace",
      description: "Read the current product, evidence, evaluation, approval and channel-projection state in the merchant growth workspace.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: async () => ({ ...snapshot(), evidence: appStore.getState().evidence }),
    },
    {
      name: "audit_channel_readiness",
      description: "Audit whether verified evidence and approvals are sufficient for organic WebMCP discovery and an OpenAI Ads product-feed projection. This does not change a live channel.",
      inputSchema: emptySchema,
      annotations: { readOnlyHint: true },
      execute: async () => {
        const state = appStore.getState();
        return {
          organic: { ready: state.variant.status === "published", reason: state.variant.status === "published" ? "Approved variant published" : "Approved publication required" },
          paid: { ready: state.adsPackage.status === "ready", reason: state.adsPackage.status === "ready" ? "Ads-eligible feed package prepared" : "Prepare a feed package after publication" },
          verifiedEvidence: `${state.evidence.filter((item) => item.verified).length}/${state.evidence.length}`,
          safety: "Paid activation and spend are outside this demo's authority.",
        };
      },
    },
    {
      name: "create_evidence_led_variant",
      description: "Create a draft product variant using only verified merchant evidence. This changes draft state but does not publish to Shopify or Ads.",
      inputSchema: emptySchema,
      execute: async () => ({ variant: appStore.generateVariant("Agent"), nextRequiredAction: "Run the buyer-intent battery." }),
    },
    {
      name: "run_buyer_intent_battery",
      description: "Evaluate the current draft against eight deterministic buyer needs and return evidence-level results. Stores the evaluation in the live workspace.",
      inputSchema: emptySchema,
      execute: async () => appStore.runEvaluation("Agent"),
    },
    {
      name: "stage_variant_for_merchant_review",
      description: "Stage an evaluated variant for human merchant review. This does not approve or publish it.",
      inputSchema: emptySchema,
      execute: async () => ({ variant: appStore.stageVariant("Agent"), nextRequiredAction: "Merchant must approve in the visible interface." }),
    },
    {
      name: "publish_merchant_approved_variant",
      description: "Publish the exact hash-bound variant previously approved by the merchant to the demo storefront. Fails if approval is absent or stale.",
      inputSchema: emptySchema,
      execute: async () => ({ variant: appStore.publishVariant("Agent"), surface: "demo Shopify storefront", liveExternalWrite: false }),
    },
    {
      name: "prepare_openai_ads_package",
      description: "Prepare an Ads-eligible product-feed row and PAUSED campaign projection from the current channel copy. No Ads API request, activation or spend occurs.",
      inputSchema: emptySchema,
      execute: async () => appStore.prepareAds("Agent"),
    },
    {
      name: "search_product_by_need",
      description: "Match a shopper need against verified product facts and current published copy. Read-only; returns why the product is or is not a fit.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 3, maxLength: 240, description: "The shopper's plain-language product need." } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: async (input: Record<string, unknown>) => {
        const query = String(input.query ?? "").toLowerCase();
        const state = appStore.getState();
        const matches = state.evidence.filter((item) => item.tags.some((tag) => query.includes(tag)) || item.value.toLowerCase().split(/\s+/).some((term) => term.length > 3 && query.includes(term)));
        return {
          product: state.product.id,
          match: matches.length > 0,
          evidence: matches.map(({ id, label, value, source }) => ({ id, label, value, source })),
          price: `${state.product.currency} ${state.product.price}`,
          note: matches.length ? "Match is based only on verified merchant evidence." : "No verified evidence directly matched this need.",
        };
      },
    },
    {
      name: "update_demo_cart",
      description: "Set the quantity of the featured product in the demo cart. This changes visible session state but never starts checkout or payment.",
      inputSchema: {
        type: "object",
        properties: { quantity: { type: "integer", minimum: 0, maximum: 18, description: "Exact demo cart quantity." } },
        required: ["quantity"],
        additionalProperties: false,
      },
      execute: async (input: Record<string, unknown>) => ({ quantity: appStore.updateCart(Number(input.quantity), "Agent"), checkoutStarted: false, paymentAttempted: false }),
    },
  ];

  await Promise.all(tools.map((tool) => registerTool(tool)));
  appStore.setWebmcpAvailable(true);
  return true;
}
