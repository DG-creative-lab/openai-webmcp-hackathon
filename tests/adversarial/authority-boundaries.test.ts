import { beforeEach, describe, expect, it } from "vitest";
import { appStore } from "../../src/store/appStore";
import { registerWebMCPTools } from "../../src/webmcp/registerTools";

type Checkpoint = "draft" | "evaluated" | "staged" | "approved" | "published";
type ToolDefinition = {
  name: string;
  description?: string;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

function reach(checkpoint: Checkpoint) {
  appStore.reset();
  appStore.generateVariant("Agent");
  if (checkpoint === "draft") return;
  appStore.runEvaluation("Agent");
  if (checkpoint === "evaluated") return;
  appStore.stageVariant("Agent");
  if (checkpoint === "staged") return;
  appStore.recordVisibleApproval();
  if (checkpoint === "approved") return;
  appStore.publishVariant("Agent");
}

async function registeredTools(): Promise<ToolDefinition[]> {
  const definitions: ToolDefinition[] = [];
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      modelContext: {
        registerTool: async (definition: ToolDefinition) => {
          definitions.push(definition);
        },
      },
    },
  });
  await registerWebMCPTools();
  return definitions;
}

describe("adversarial authority and lifecycle boundaries", () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, "document");
    appStore.reset();
  });

  it.each([
    ["draft", "stage", /evaluated draft/i],
    ["draft", "approve", /staged/i],
    ["draft", "publish", /approval/i],
    ["draft", "ads", /digest-approved/i],
    ["evaluated", "approve", /staged/i],
    ["evaluated", "publish", /approval/i],
    ["staged", "stage", /evaluated draft/i],
    ["staged", "publish", /approval/i],
    ["staged", "ads", /digest-approved/i],
    ["approved", "stage", /evaluated draft/i],
    ["approved", "ads", /digest-approved/i],
    ["published", "stage", /evaluated draft/i],
    ["published", "approve", /staged/i],
  ] as const)("blocks %s → %s as an illegal transition", (checkpoint, action, message) => {
    reach(checkpoint);
    const before = appStore.getState().variant.status;
    const attempt = () => {
      if (action === "stage") appStore.stageVariant("Agent");
      if (action === "approve") appStore.recordVisibleApproval();
      if (action === "publish") appStore.publishVariant("Agent");
      if (action === "ads") appStore.prepareAds("Agent");
    };

    expect(attempt).toThrow(message);
    expect(appStore.getState().variant.status).toBe(before);
  });

  it("invalidates approval when the agent regenerates the variant", () => {
    reach("approved");
    const approvedDigest = appStore.getState().variant.approvedDigest;

    appStore.generateVariant("Agent");

    expect(approvedDigest).toMatch(/^fnv1a-/);
    expect(appStore.getState().variant.approvedDigest).toBeNull();
    expect(() => appStore.publishVariant("Agent")).toThrow(/approval/i);
  });

  it("invalidates a stale paid projection when a new draft is generated", () => {
    reach("published");
    appStore.prepareAds("Agent");
    expect(appStore.getState().adsPackage.status).toBe("ready");

    appStore.generateVariant("Agent");

    expect(appStore.getState().variant.status).toBe("draft");
    expect(appStore.getState().adsPackage).toMatchObject({
      status: "not_prepared",
      campaignStatus: "not_created",
      feed: null,
    });
  });

  it("does not expose mutable authoritative state to a caller", () => {
    const snapshot = appStore.getState();
    const originalTitle = snapshot.variant.title;

    expect(() => {
      snapshot.variant.title = "Unverified miracle backpack";
    }).toThrow(TypeError);
    expect(appStore.getState().variant.title).toBe(originalTitle);
  });

  it.each([
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [-4, 0],
    [2.9, 2],
    [999, 18],
  ])("normalizes hostile cart quantity %s to %s", (input, expected) => {
    expect(appStore.updateCart(input, "Agent")).toBe(expected);
    expect(appStore.getState().cartQuantity).toBe(expected);
  });

  it("keeps approval and reset outside the site-tool surface without claiming browser authority", async () => {
    const tools = await registeredTools();
    const names = tools.map((tool) => tool.name);

    expect(names).toHaveLength(9);
    expect(names).not.toContain("approve_variant");
    expect(names.some((name) => name.startsWith("approve_") || name.startsWith("reset_"))).toBe(false);
    expect(tools.find((tool) => tool.name === "publish_approved_variant")?.description).toMatch(/does not authenticate|not authenticated/i);
    expect(tools.find((tool) => tool.name === "get_growth_workspace")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "audit_channel_readiness")?.annotations?.readOnlyHint).toBe(true);
    expect(tools.find((tool) => tool.name === "search_product_by_need")?.annotations?.readOnlyHint).toBe(true);
  });

  it("returns an explicit no-match instead of inventing support", async () => {
    const tools = await registeredTools();
    const search = tools.find((tool) => tool.name === "search_product_by_need");
    const result = await search?.execute({ query: "solar powered self-cleaning backpack" }) as {
      match: boolean;
      evidence: unknown[];
      note: string;
    };

    expect(result.match).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.note).toMatch(/contradicted or unknown/i);
  });

  it("records accurate provenance for the unauthenticated browser approval gesture", () => {
    reach("staged");
    appStore.recordVisibleApproval();

    expect(appStore.getState().activities[0]).toMatchObject({
      actor: "Browser user",
      action: "Visible approval recorded",
      detail: expect.stringMatching(/does not authenticate the actor/i),
    });
  });

  it.each([
    ["waterproof bag for a 17-inch laptop", ["supported", "contradicted"]],
    ["waterproof bag under £150", ["supported", "contradicted"]],
    ["not waterproof", ["contradicted"]],
    ["waterproof 16-inch laptop with solar charging", ["supported", "supported", "unknown"]],
  ])("does not recommend when one material constraint in %s is unmet", async (query, statuses) => {
    reach("published");
    const tools = await registeredTools();
    const search = tools.find((tool) => tool.name === "search_product_by_need");
    const result = await search?.execute({ query }) as {
      match: boolean;
      constraints: Array<{ status: string }>;
      nextAction: string;
    };

    expect(result.match).toBe(false);
    expect(result.constraints.map((constraint) => constraint.status)).toEqual(statuses);
    expect(result.nextAction).toMatch(/do not recommend or update the cart/i);
  });

  it("does not expose verified but hidden facts as shopper matches before publication", async () => {
    const tools = await registeredTools();
    const search = tools.find((tool) => tool.name === "search_product_by_need");
    const before = await search?.execute({ query: "waterproof bag for a 16-inch laptop" }) as {
      match: boolean;
      evidence: unknown[];
      note: string;
      constraints: Array<{ status: string; explanation: string }>;
    };

    expect(before).toMatchObject({ match: false, evidence: [] });
    expect(before.constraints).toEqual([
      expect.objectContaining({ status: "unknown", explanation: expect.stringMatching(/current visible copy/i) }),
      expect.objectContaining({ status: "unknown", explanation: expect.stringMatching(/current visible copy/i) }),
    ]);

    reach("published");
    const after = await search?.execute({ query: "waterproof bag for a 16-inch laptop" }) as {
      match: boolean;
      evidence: unknown[];
    };
    expect(after.match).toBe(true);
    expect(after.evidence).toHaveLength(2);
  });

  it("prepares only a PAUSED, zero-spend projection after exact publication", () => {
    reach("published");
    const ads = appStore.prepareAds("Agent");

    expect(ads.status).toBe("ready");
    expect(ads.campaignStatus).toBe("PAUSED");
    expect(ads.disclaimer).toMatch(/No Ads API call|No.*spend/i);
    expect(ads.feed).toMatchObject({ identifier_exists: "no", is_ads_eligible: true });
    expect(ads.validation).toMatchObject({ scope: "local_schema", valid: true, errors: [] });
  });

  it("keeps the Shopify adapter at a credential-free, non-executing preview boundary", () => {
    reach("published");
    const preview = appStore.getState().commerce.updatePreview;

    expect(preview).toMatchObject({
      mode: "preview",
      operation: "update_product",
      status: "preview_ready",
      externalWrite: false,
      payload: { requiredScopes: ["write_products"], execution: "blocked_preview" },
    });
    expect(JSON.stringify(preview)).not.toMatch(/access[_-]?token|secret|authorization/i);
  });
});
