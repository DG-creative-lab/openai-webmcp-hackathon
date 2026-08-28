import { afterEach, describe, expect, it } from "vitest";
import { appStore } from "../store/appStore";
import { registerWebMCPTools } from "./registerTools";

type ToolDefinition = {
  name: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean };
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
    expect(definitions.find((item) => item.name === "get_growth_workspace")?.annotations?.readOnlyHint).toBe(true);
  });

  it("executes the complete tool contract while preserving merchant approval", async () => {
    const definitions = await createToolRegistry();
    const execute = (name: string, input: Record<string, unknown> = {}) => {
      const tool = definitions.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing test tool: ${name}`);
      return tool.execute(input);
    };

    await expect(execute("get_growth_workspace")).resolves.toMatchObject({ cartQuantity: 0 });
    await expect(execute("audit_channel_readiness")).resolves.toMatchObject({
      organic: { ready: false },
      paid: { ready: false },
    });
    await execute("create_evidence_led_variant");
    await expect(execute("run_buyer_intent_battery")).resolves.toMatchObject({ score: 8, total: 8 });
    await expect(execute("stage_variant_for_merchant_review")).resolves.toMatchObject({
      nextRequiredAction: expect.stringMatching(/Merchant must approve/),
    });
    await expect(execute("publish_merchant_approved_variant")).rejects.toThrow(/approval/i);

    appStore.approveVariant();
    await expect(execute("publish_merchant_approved_variant")).resolves.toMatchObject({
      surface: "demo Shopify storefront",
      liveExternalWrite: false,
    });
    await expect(execute("prepare_openai_ads_package")).resolves.toMatchObject({ campaignStatus: "PAUSED" });
    await expect(execute("search_product_by_need", { query: "waterproof 16-inch laptop bag" })).resolves.toMatchObject({
      match: true,
    });
    await expect(execute("update_demo_cart", { quantity: 2 })).resolves.toEqual({
      quantity: 2,
      checkoutStarted: false,
      paymentAttempted: false,
    });
    await expect(execute("audit_channel_readiness")).resolves.toMatchObject({
      organic: { ready: true },
      paid: { ready: true },
    });
  });

  it("reports WebMCP as unavailable when the browser host is absent", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });

    await expect(registerWebMCPTools()).resolves.toBe(false);
    expect(appStore.getState().webmcpAvailable).toBe(false);
  });
});
