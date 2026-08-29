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

async function reach(checkpoint: Checkpoint) {
  appStore.reset();
  appStore.generateVariant("Agent");
  if (checkpoint === "draft") return;
  appStore.runEvaluation("Agent");
  if (checkpoint === "evaluated") return;
  appStore.stageVariant("Agent");
  if (checkpoint === "staged") return;
  await appStore.recordVisibleApproval();
  if (checkpoint === "approved") return;
  await appStore.publishVariant("Agent");
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
  ] as const)("blocks %s → %s as an illegal transition", async (checkpoint, action, message) => {
    await reach(checkpoint);
    const before = appStore.getState().variant.status;
    const attempt = async () => {
      if (action === "stage") return appStore.stageVariant("Agent");
      if (action === "approve") return appStore.recordVisibleApproval();
      if (action === "publish") return appStore.publishVariant("Agent");
      return appStore.prepareAds("Agent");
    };

    await expect(attempt()).rejects.toThrow(message);
    expect(appStore.getState().variant.status).toBe(before);
  });

  it("invalidates approval when the agent regenerates the variant", async () => {
    await reach("approved");
    const approvedDigest = appStore.getState().variant.approvedDigest;

    appStore.generateVariant("Agent");

    expect(approvedDigest).toMatch(/^sha256-v1-[a-f0-9]{64}$/);
    expect(appStore.getState().variant.approvedDigest).toBeNull();
    await expect(appStore.publishVariant("Agent")).rejects.toThrow(/approval/i);
  });

  it("invalidates a stale paid projection when a new draft is generated", async () => {
    await reach("published");
    await appStore.prepareAds("Agent");
    expect(appStore.getState().adsPackage.status).toBe("ready");

    appStore.generateVariant("Agent");

    expect(appStore.getState().variant.status).toBe("draft");
    expect(appStore.getState().adsPackage).toMatchObject({
      status: "not_prepared",
      campaignStatus: "not_created",
      feed: null,
      feedExport: null,
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

  it("keeps the approval envelope, target, and evidence set immutable after recording", async () => {
    await reach("approved");
    const approval = appStore.getState().variant.approval;
    expect(approval).not.toBeNull();
    expect(Object.isFrozen(approval)).toBe(true);
    expect(Object.isFrozen(approval?.target)).toBe(true);
    expect(Object.isFrozen(approval?.productSnapshot)).toBe(true);
    expect(Object.isFrozen(approval?.evidenceIds)).toBe(true);
    expect(() => {
      (approval?.target as { productId: string }).productId = "gid://shopify/Product/999";
    }).toThrow(TypeError);
    expect(() => {
      (approval?.productSnapshot as { price: number }).price = 1;
    }).toThrow(TypeError);
  });

  it("keeps the prepared Ads row and downloadable artifact immutable", async () => {
    await reach("published");
    await appStore.prepareAds("Agent");
    const ads = appStore.getState().adsPackage;

    expect(Object.isFrozen(ads.feed)).toBe(true);
    expect(Object.isFrozen(ads.feedExport)).toBe(true);
    expect(Object.isFrozen(ads.feedExport?.delivery)).toBe(true);
    expect(() => {
      (ads.feedExport as { contents: string }).contents = "hostile replacement";
    }).toThrow(TypeError);
    expect(appStore.getState().adsPackage.feedExport?.contents).not.toBe("hostile replacement");
  });

  it("fails closed when workspace state changes during asynchronous digest verification", async () => {
    await reach("staged");
    const pendingApproval = appStore.recordVisibleApproval();
    appStore.generateVariant("Agent");
    await expect(pendingApproval).rejects.toThrow(/workspace changed/i);
    expect(appStore.getState().variant).toMatchObject({ status: "draft", approval: null, approvedDigest: null });

    await reach("approved");
    const pendingPublication = appStore.publishVariant("Agent");
    appStore.generateVariant("Agent");
    await expect(pendingPublication).rejects.toThrow(/workspace changed/i);
    expect(appStore.getState().commerce.updatePreview).toBeNull();

    await reach("published");
    const pendingAds = appStore.prepareAds("Agent");
    appStore.generateVariant("Agent");
    await expect(pendingAds).rejects.toThrow(/workspace changed/i);
    expect(appStore.getState().adsPackage.status).toBe("not_prepared");
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

  it("records accurate provenance for the unauthenticated browser approval gesture", async () => {
    await reach("staged");
    await appStore.recordVisibleApproval();

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
    await reach("published");
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

    await reach("published");
    const after = await search?.execute({ query: "waterproof bag for a 16-inch laptop" }) as {
      match: boolean;
      evidence: unknown[];
    };
    expect(after.match).toBe(true);
    expect(after.evidence).toHaveLength(2);
  });

  it("prepares only a PAUSED, zero-spend projection after exact publication", async () => {
    await reach("published");
    const ads = await appStore.prepareAds("Agent");

    expect(ads.status).toBe("ready");
    expect(ads.campaignStatus).toBe("PAUSED");
    expect(ads.disclaimer).toMatch(/No Ads API call|No.*spend/i);
    expect(ads.feed).toMatchObject({ identifier_exists: "no", is_ads_eligible: true });
    expect(ads.feedExport).toMatchObject({
      sourcePayloadDigest: appStore.getState().variant.approvedDigest,
      delivery: { transport: "SFTP", requiresAdsManagerFeedConnection: true, advertiserApiUploadSupported: false },
    });
    expect(ads.validation).toMatchObject({ scope: "local_schema", valid: true, errors: [] });
  });

  it("keeps the Shopify adapter at a credential-free, non-executing preview boundary", async () => {
    await reach("published");
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
