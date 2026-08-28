import { appStore } from "../store/appStore";
import { evaluateCopy } from "../domain/evaluation";
import { evaluateShopperNeed } from "../domain/shopperMatch";

const emptySchema = { type: "object", properties: {}, additionalProperties: false };

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const stateChangeAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

type ToolEffectClass = "read" | "draft" | "evaluation" | "stage" | "demo_publish" | "paid_projection" | "demo_cart";

interface ToolEffect {
  class: ToolEffectClass;
  changedState: boolean;
  externalWrite: boolean;
  requiresApprovalState: boolean;
  approvalAssurance: "not_applicable" | "demo_ui_gesture";
  authority: string;
}

const effects = {
  read: {
    class: "read",
    changedState: false,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may inspect verified merchant-controlled state.",
  },
  draft: {
    class: "draft",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may change draft state using verified evidence only.",
  },
  evaluation: {
    class: "evaluation",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may store deterministic evaluation evidence; this is not observed commercial lift.",
  },
  stage: {
    class: "stage",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may stage an evaluated draft; approval state is absent from the site-tool surface.",
  },
  publish: {
    class: "demo_publish",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: true,
    approvalAssurance: "demo_ui_gesture",
    authority: "Requires exact digest-bound demo approval state. The credential-free demo does not authenticate the browser actor.",
  },
  paid: {
    class: "paid_projection",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: true,
    approvalAssurance: "demo_ui_gesture",
    authority: "Requires digest-approved published copy; creates a PAUSED projection with no API call or spend.",
  },
  cart: {
    class: "demo_cart",
    changedState: true,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may set visible demo cart quantity; checkout and payment are unavailable.",
  },
} as const satisfies Record<string, ToolEffect>;

function snapshot() {
  const state = appStore.getState();
  return {
    product: { id: state.product.id, sku: state.product.sku, price: state.product.price, inventory: state.product.inventory },
    variant: { id: state.variant.id, status: state.variant.status, approvedDigest: state.variant.approvedDigest },
    evaluation: state.variantEvaluation ? { score: state.variantEvaluation.score, total: state.variantEvaluation.total } : null,
    ads: { status: state.adsPackage.status, campaignStatus: state.adsPackage.campaignStatus, validation: state.adsPackage.validation },
    cartQuantity: state.cartQuantity,
  };
}

function success<T extends Record<string, unknown>>(effect: ToolEffect, payload: T, nextAction: string | null) {
  return {
    ok: true as const,
    effect,
    ...payload,
    workspace: snapshot(),
    nextAction,
  };
}

function inputObject(input: unknown, allowedKeys: string[]): Record<string, unknown> {
  const value = input ?? {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid tool input: provide one JSON object matching the documented schema.");
  }
  const record = value as Record<string, unknown>;
  const unexpected = Object.keys(record).filter((key) => !allowedKeys.includes(key));
  if (unexpected.length) {
    throw new Error(`Invalid tool input: remove unsupported field${unexpected.length === 1 ? "" : "s"} ${unexpected.join(", ")}.`);
  }
  return record;
}

function noInput<T>(handler: () => T | Promise<T>) {
  return async (input: Record<string, unknown> = {}) => {
    inputObject(input, []);
    return handler();
  };
}

function shopperQuery(input: unknown): string {
  const record = inputObject(input, ["query"]);
  if (typeof record.query !== "string") {
    throw new Error("Invalid shopper need: query must be a plain-language string between 3 and 240 characters.");
  }
  const query = record.query.trim();
  if (query.length < 3 || query.length > 240) {
    throw new Error("Invalid shopper need: query must contain between 3 and 240 characters.");
  }
  return query;
}

function cartQuantity(input: unknown): number {
  const record = inputObject(input, ["quantity"]);
  if (typeof record.quantity !== "number" || !Number.isInteger(record.quantity) || record.quantity < 0 || record.quantity > 18) {
    throw new Error("Invalid demo cart quantity: use a whole number from 0 to the available inventory of 18.");
  }
  return record.quantity;
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
      description: "Inspect the current product identity, verified evidence, variant lifecycle, approval, paid projection and demo cart. Read-only; start here before changing anything.",
      inputSchema: emptySchema,
      annotations: readOnlyAnnotations,
      execute: noInput(async () => {
        const state = appStore.getState();
        return success(effects.read, {
          product: state.product,
          evidence: state.evidence,
          currentCopy: state.variant.status === "baseline" ? state.product.baseline : state.variant,
        }, "Create an evidence-led draft, or audit channel readiness before deciding what is needed.");
      }),
    },
    {
      name: "audit_channel_readiness",
      description: "Audit whether verified evidence and exact approval are sufficient for organic agent discovery and an OpenAI Ads projection. Read-only; does not change any channel.",
      inputSchema: emptySchema,
      annotations: readOnlyAnnotations,
      execute: noInput(async () => {
        const state = appStore.getState();
        return success(effects.read, {
          organic: { ready: state.variant.status === "published", reason: state.variant.status === "published" ? "Approved variant published" : "Approved demo publication required" },
          paid: { ready: state.adsPackage.status === "ready", reason: state.adsPackage.status === "ready" ? "Ads-eligible PAUSED feed projection prepared" : "Prepare the projection after approved publication" },
          verifiedEvidence: `${state.evidence.filter((item) => item.verified).length}/${state.evidence.length}`,
          safety: "Paid activation, spend, checkout and payment are outside this demo's authority.",
        }, state.variant.status === "baseline" ? "Create an evidence-led draft." : "Continue the lifecycle shown in workspace.variant.status.");
      }),
    },
    {
      name: "create_evidence_led_variant",
      description: "Create or regenerate a product-copy draft using only the eight verified merchant evidence records. Changes draft state and invalidates prior evaluation, approval and paid projections; never publishes.",
      inputSchema: emptySchema,
      annotations: stateChangeAnnotations,
      execute: noInput(async () => success(effects.draft, {
        variant: appStore.generateVariant("Agent"),
        invalidated: ["prior evaluation", "prior approval", "prior paid projection"],
      }, "Run the buyer-intent battery on this draft.")),
    },
    {
      name: "run_buyer_intent_battery",
      description: "Evaluate the current evidence-led draft against eight fixed buyer needs and store the evidence-level result. This is deterministic simulation, not observed conversion lift.",
      inputSchema: emptySchema,
      annotations: stateChangeAnnotations,
      execute: noInput(async () => success(effects.evaluation, {
        evaluation: appStore.runEvaluation("Agent"),
      }, "If the result is acceptable, stage the evaluated draft at the visible review checkpoint.")),
    },
    {
      name: "stage_variant_for_review",
      description: "Stage the evaluated draft at the visible browser review checkpoint. Changes review state only; this site tool cannot approve or publish the variant.",
      inputSchema: emptySchema,
      annotations: stateChangeAnnotations,
      execute: noInput(async () => success(effects.stage, {
        variant: appStore.stageVariant("Agent"),
      }, "Stop. Approval is absent from the site-tool surface. A browser user may review and select Approve exact variant; this demo does not authenticate that actor.")),
    },
    {
      name: "publish_approved_variant",
      description: "Publish only the exact variant with current digest-bound demo approval state to the visible storefront. The approval is a credential-free UI gesture, not authenticated merchant authority; no live Shopify write occurs.",
      inputSchema: emptySchema,
      annotations: stateChangeAnnotations,
      execute: noInput(async () => success(effects.publish, {
        variant: appStore.publishVariant("Agent"),
        surface: "demo Shopify storefront",
        liveExternalWrite: false,
      }, "Prepare the PAUSED OpenAI Ads projection from the same approved copy.")),
    },
    {
      name: "prepare_openai_ads_package",
      description: "Prepare an Ads-eligible product-feed row and PAUSED campaign projection from the exact approved published copy. Changes demo projection state only; no Ads API request, activation or spend can occur.",
      inputSchema: emptySchema,
      annotations: stateChangeAnnotations,
      execute: noInput(async () => success(effects.paid, {
        adsPackage: appStore.prepareAds("Agent"),
        liveExternalWrite: false,
        projectedSpend: "GBP 0",
      }, "Use verified product search for the shopper need, then set the visible demo cart quantity.")),
    },
    {
      name: "search_product_by_need",
      description: "Match one plain-language shopper need against verified product facts and the current published copy. Read-only; returns source evidence or an explicit no-match without inventing support.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 3, maxLength: 240, description: "One shopper need, including the important fit, use, budget or delivery constraints." } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: readOnlyAnnotations,
      execute: async (input: Record<string, unknown>) => {
        const query = shopperQuery(input);
        const state = appStore.getState();
        const visibleCopy = state.variant.status === "published" ? state.variant : state.product.baseline;
        const representedEvidence = new Set(
          evaluateCopy(visibleCopy, state.evidence, "Current visible representation").results
            .flatMap((result) => result.matched && result.evidenceId ? [result.evidenceId] : []),
        );
        const result = evaluateShopperNeed(query, state.product, state.evidence, representedEvidence);
        return success(effects.read, {
          product: state.product.id,
          match: result.match,
          constraints: result.constraints,
          evidence: result.evidence,
          price: `${state.product.currency} ${state.product.price}`,
          note: result.match ? "Every material constraint is supported by verified evidence represented in the current published copy." : "At least one material constraint is contradicted or unknown; overall fit is not established.",
        }, result.match ? "Set the desired demo cart quantity if the shopper chooses this product." : "Explain each contradicted or unknown constraint; do not recommend or update the cart as though fit were established.");
      },
    },
    {
      name: "update_demo_cart",
      description: "Set the exact quantity of the featured product in the visible demo cart from 0 to 18. Changes only this page session; never starts checkout or payment.",
      inputSchema: {
        type: "object",
        properties: { quantity: { type: "integer", minimum: 0, maximum: 18, description: "Exact desired quantity, bounded by the available inventory of 18." } },
        required: ["quantity"],
        additionalProperties: false,
      },
      annotations: { ...stateChangeAnnotations, idempotentHint: true },
      execute: async (input: Record<string, unknown>) => success(effects.cart, {
        quantity: appStore.updateCart(cartQuantity(input), "Agent"),
        checkoutStarted: false,
        paymentAttempted: false,
      }, "Open Shopper view to verify the published copy and cart in the same page session."),
    },
  ];

  await Promise.all(tools.map((tool) => registerTool(tool)));
  appStore.setWebmcpAvailable(true);
  return true;
}
