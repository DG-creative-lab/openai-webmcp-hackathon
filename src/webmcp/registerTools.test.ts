import { afterEach, describe, expect, it } from "vitest";
import { appStore } from "../store/appStore";
import { registerWebMCPTools, registerWebMCPToolsWithRetry } from "./registerTools";

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
    expect(definitions).toHaveLength(10);
    expect(definitions.map((item) => item.name)).toContain("publish_approved_variant");
    expect(definitions.map((item) => item.name)).toContain("get_optimization_receipt");
    expect(definitions.every((item) => item.inputSchema.additionalProperties === false)).toBe(true);
    expect(definitions.filter((item) => item.annotations?.readOnlyHint)).toHaveLength(4);
    expect(definitions.filter((item) => !item.annotations?.readOnlyHint)).toHaveLength(6);
    expect(definitions.every((item) => item.annotations?.destructiveHint === false)).toBe(true);
    expect(definitions.every((item) => item.annotations?.openWorldHint === false)).toBe(true);
    expect(definitions.every((item) => item.description.length >= 100)).toBe(true);
  });

  it("executes the complete tool contract around digest-bound visible approval", async () => {
    const definitions = await createToolRegistry();
    const execute = (name: string, input: Record<string, unknown> = {}) => {
      const tool = definitions.find((candidate) => candidate.name === name);
      if (!tool) throw new Error(`Missing test tool: ${name}`);
      return tool.execute(input);
    };

    const workspaceResult = await execute("get_growth_workspace") as { evidence: Array<Record<string, unknown>> };
    expect(workspaceResult).toMatchObject({
      ok: true,
      effect: { class: "read", changedState: false, externalWrite: false },
      workspace: { cartQuantity: 0, variant: { status: "baseline" } },
    });
    expect(workspaceResult.evidence[0]).toMatchObject({
      contractVersion: "conversion-lab.commerce.v1",
      productIdentity: { provider: "shopify", productId: "gid://shopify/Product/108828309" },
      provenance: { observedAt: expect.any(String), freshness: "fixture" },
    });
    await expect(execute("audit_channel_readiness")).resolves.toMatchObject({
      effect: { class: "read" },
      organic: { ready: false },
      paid: { ready: false },
    });
    await expect(execute("get_optimization_receipt")).rejects.toThrow(/unavailable/i);
    await expect(execute("create_evidence_led_variant")).resolves.toMatchObject({
      effect: { class: "draft", changedState: true, externalWrite: false },
      workspace: { variant: { status: "draft" } },
    });
    await expect(execute("run_buyer_intent_battery")).resolves.toMatchObject({
      effect: { class: "evaluation" },
      evaluation: { score: 8, total: 8 },
    });
    await expect(execute("stage_variant_for_review")).resolves.toMatchObject({
      effect: { class: "stage", requiresApprovalState: false, approvalAssurance: "not_applicable" },
      nextAction: expect.stringMatching(/does not authenticate that actor/i),
    });
    await expect(execute("publish_approved_variant")).rejects.toThrow(/approval/i);

    await appStore.recordVisibleApproval();
    await expect(execute("publish_approved_variant")).resolves.toMatchObject({
      effect: { class: "demo_publish", requiresApprovalState: true, approvalAssurance: "demo_ui_gesture", externalWrite: false },
      surface: "demo Shopify storefront",
      liveExternalWrite: false,
    });
    await expect(execute("prepare_openai_ads_package")).resolves.toMatchObject({
      effect: { class: "paid_projection", requiresApprovalState: true, externalWrite: false },
      adsPackage: {
        campaignStatus: "PAUSED",
        feed: { identifier_exists: "no", is_ads_eligible: true },
        feedExport: {
          format: "google-compatible-csv",
          rowCount: 1,
          sourcePayloadDigest: expect.stringMatching(/^sha256-v1-[a-f0-9]{64}$/),
          delivery: { transport: "SFTP", advertiserApiUploadSupported: false },
        },
        validation: { scope: "local_schema", valid: true, errors: [] },
      },
      projectedSpend: "GBP 0",
    });
    await expect(execute("get_optimization_receipt")).resolves.toMatchObject({
      effect: { class: "read", changedState: false, externalWrite: false },
      receipt: {
        contractVersion: "conversion-lab.optimization-receipt.v1",
        assurance: { cryptographicallySigned: false },
        evaluation: { baseline: { score: 0 }, optimized: { score: 8 } },
        receiptDigest: expect.stringMatching(/^sha256-v1-[a-f0-9]{64}$/),
      },
      artifact: {
        filename: "conversion-lab-optimization-receipt.json",
        mediaType: "application/json",
        localDownloadOnly: true,
      },
    });
    await expect(execute("search_product_by_need", { query: "I need a waterproof bag that fits a 16-inch laptop" })).resolves.toMatchObject({
      effect: { class: "read" },
      match: true,
      constraints: [
        { id: "weather-protection", status: "supported" },
        { id: "laptop-size", status: "supported" },
      ],
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

  it("registers when the browser host appears during the bounded retry window", async () => {
    const definitions: ToolDefinition[] = [];
    const browserDocument: { modelContext?: { registerTool: (definition: ToolDefinition) => Promise<void> } } = {};
    Object.defineProperty(globalThis, "document", { configurable: true, value: browserDocument });
    const wait = async () => {
      browserDocument.modelContext = {
        registerTool: async (definition) => {
          definitions.push(definition);
        },
      };
    };

    await expect(registerWebMCPToolsWithRetry({ maxAttempts: 3, delayMs: 0, wait })).resolves.toBe(true);
    expect(definitions).toHaveLength(10);
    expect(appStore.getState().webmcpAvailable).toBe(true);
  });

  it("stops after the configured number of unavailable-host attempts", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
    let waits = 0;

    await expect(registerWebMCPToolsWithRetry({
      maxAttempts: 3,
      delayMs: 0,
      wait: async () => { waits += 1; },
    })).resolves.toBe(false);
    expect(waits).toBe(2);
    expect(appStore.getState().webmcpAvailable).toBe(false);
  });

  it("does not duplicate tools across concurrent or repeated registration", async () => {
    const definitions: ToolDefinition[] = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        modelContext: {
          registerTool: async (definition: ToolDefinition) => {
            await Promise.resolve();
            definitions.push(definition);
          },
        },
      },
    });

    await expect(Promise.all([registerWebMCPTools(), registerWebMCPTools()])).resolves.toEqual([true, true]);
    await expect(registerWebMCPTools()).resolves.toBe(true);
    expect(definitions).toHaveLength(10);
  });

  it("stops at the first rejected tool and permanently disables that host without duplicates", async () => {
    const attemptedNames: string[] = [];
    const registeredNames: string[] = [];
    const host = {
      registerTool: async (definition: ToolDefinition) => {
        attemptedNames.push(definition.name);
        if (definition.name === "run_buyer_intent_battery") {
          throw new Error("host rejected tool");
        }
        registeredNames.push(definition.name);
      },
    };
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { modelContext: host },
    });

    await expect(registerWebMCPTools()).rejects.toThrow(/permanently disabled/i);
    expect(attemptedNames).toEqual([
      "get_growth_workspace",
      "audit_channel_readiness",
      "get_optimization_receipt",
      "create_evidence_led_variant",
      "run_buyer_intent_battery",
    ]);
    expect(registeredNames).toEqual([
      "get_growth_workspace",
      "audit_channel_readiness",
      "get_optimization_receipt",
      "create_evidence_led_variant",
    ]);
    expect(registeredNames).not.toContain("publish_approved_variant");
    expect(registeredNames).not.toContain("prepare_openai_ads_package");
    expect(registeredNames).not.toContain("update_demo_cart");
    expect(appStore.getState().webmcpAvailable).toBe(false);

    await expect(registerWebMCPTools()).resolves.toBe(false);
    let waits = 0;
    await expect(registerWebMCPToolsWithRetry({
      maxAttempts: 3,
      delayMs: 0,
      wait: async () => { waits += 1; },
    })).resolves.toBe(false);
    expect(waits).toBe(0);
    expect(attemptedNames).toHaveLength(5);
    expect(registeredNames).toHaveLength(4);
  });

  it("rejects invalid retry configuration without attempting registration", async () => {
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });

    await expect(registerWebMCPToolsWithRetry({ maxAttempts: 0 })).rejects.toThrow(/positive integer/i);
    await expect(registerWebMCPToolsWithRetry({ delayMs: -1 })).rejects.toThrow(/non-negative/i);
  });
});
