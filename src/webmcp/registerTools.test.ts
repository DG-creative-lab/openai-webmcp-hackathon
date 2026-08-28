import { afterEach, describe, expect, it } from "vitest";
import { appStore } from "../store/appStore";
import { registerWebMCPTools } from "./registerTools";

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => Promise<unknown>;
};

async function createToolRegistry() {
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

describe("WebMCP registration", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
    appStore.reset();
  });

  it("registers the complete narrow tool surface", async () => {
    const definitions = await createToolRegistry();
    expect(definitions).toHaveLength(9);
    expect(definitions.map((item) => item.name)).toContain("publish_merchant_approved_variant");
    expect(definitions.every((item) => item.inputSchema.additionalProperties === false)).toBe(true);
    expect(definitions.filter((item) => item.annotations?.readOnlyHint)).toHaveLength(3);
    expect(definitions.filter((item) => !item.annotations?.readOnlyHint)).toHaveLength(6);
    expect(definitions.every((item) => item.annotations?.destructiveHint === false)).toBe(true);
    expect(definitions.every((item) => item.annotations?.openWorldHint === false)).toBe(true);
    expect(definitions.every((item) => item.description.length >= 100)).toBe(true);
  });

  it("executes the complete tool contract while preserving merchant approval", async () => {
    const definitions = await createToolRegistry();
    const execute = (name: string, input: Record<string, unknown> = {}) => {
      const tool = definitions.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing test tool: ${name}`);
      return tool.execute(input);
    };

    await expect(execute("get_growth_workspace")).resolves.toMatchObject({
      ok: true,
      effect: { class: "read", changedState: false, externalWrite: false },
      workspace: { cartQuantity: 0, variant: { status: "baseline" } },
    });
    await expect(execute("audit_channel_readiness")).resolves.toMatchObject({
      effect: { class: "read" },
      organic: { ready: false },
      paid: { ready: false },
    });
    await expect(execute("create_evidence_led_variant")).resolves.toMatchObject({
      effect: { class: "draft", changedState: true, externalWrite: false },
      workspace: { variant: { status: "draft" } },
    });
    await expect(execute("run_buyer_intent_battery")).resolves.toMatchObject({
      effect: { class: "evaluation" },
      evaluation: { score: 8, total: 8 },
    });
    await expect(execute("stage_variant_for_merchant_review")).resolves.toMatchObject({
      effect: { class: "stage", requiresMerchantApproval: false },
      nextAction: expect.stringMatching(/merchant must select Approve exact variant/i),
    });
    await expect(execute("publish_merchant_approved_variant")).rejects.toThrow(/approval/i);

    appStore.approveVariant();
    await expect(execute("publish_merchant_approved_variant")).resolves.toMatchObject({
      effect: { class: "demo_publish", requiresMerchantApproval: true, externalWrite: false },
      surface: "demo Shopify storefront",
      liveExternalWrite: false,
    });
    await expect(execute("prepare_openai_ads_package")).resolves.toMatchObject({
      effect: { class: "paid_projection", requiresMerchantApproval: true, externalWrite: false },
      adsPackage: { campaignStatus: "PAUSED" },
      projectedSpend: "GBP 0",
    });
    await expect(execute("search_product_by_need", { query: "waterproof 16-inch laptop bag" })).resolves.toMatchObject({
      effect: { class: "read" },
      match: true,
    });
    await expect(execute("update_demo_cart", { quantity: 2 })).resolves.toMatchObject({
      effect: { class: "demo_cart", externalWrite: false },
      quantity: 2,
      checkoutStarted: false,
      paymentAttempted: false,
    });
    await expect(execute("audit_channel_readiness")).resolves.toMatchObject({
      organic: { ready: true },
      paid: { ready: true },
    });
  });

  it("rejects malformed or over-broad tool inputs with recovery guidance", async () => {
    const definitions = await createToolRegistry();
    const execute = (name: string, input: Record<string, unknown>) => {
      const tool = definitions.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing test tool: ${name}`);
      return tool.execute(input);
    };

    await expect(execute("get_growth_workspace", { includeSecrets: true })).rejects.toThrow(/remove unsupported field includeSecrets/i);
    await expect(execute("search_product_by_need", { query: "x" })).rejects.toThrow(/between 3 and 240/i);
    await expect(execute("search_product_by_need", { query: "waterproof", persona: "everyone" })).rejects.toThrow(/remove unsupported field persona/i);
    await expect(execute("update_demo_cart", { quantity: 2.5 })).rejects.toThrow(/whole number/i);
    await expect(execute("update_demo_cart", { quantity: 19 })).rejects.toThrow(/whole number/i);
  });

  it("reports WebMCP as unavailable when the browser host is absent", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });

    await expect(registerWebMCPTools()).resolves.toBe(false);
    expect(appStore.getState().webmcpAvailable).toBe(false);
  });
});
