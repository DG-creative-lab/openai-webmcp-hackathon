import { expect, test, type Page } from "@playwright/test";

type ToolResult = Record<string, unknown>;

async function executeTool(page: Page, name: string, input: Record<string, unknown> = {}) {
  return page.evaluate(async ({ toolName, toolInput }) => {
    const tools = (window as unknown as {
      __webmcpTools: Array<{
        name: string;
        execute: (value: Record<string, unknown>) => Promise<ToolResult>;
      }>;
    }).__webmcpTools;
    const tool = tools.find((candidate) => candidate.name === toolName);
    if (!tool) throw new Error(`Tool not registered: ${toolName}`);
    return tool.execute(toolInput);
  }, { toolName: name, toolInput: input });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const tools: unknown[] = [];
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool: async (definition: unknown) => {
          tools.push(definition);
        },
      },
    });
    Object.defineProperty(window, "__webmcpTools", { configurable: true, value: tools });
  });
});

test("an agent discovers the tools and completes the journey around the visible approval checkpoint", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("9 site tools · 3 read / 6 state")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Start with one agent prompt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Modular Commuter Pack" })).toBeVisible();

  const toolNames = await page.evaluate(() => (window as unknown as {
    __webmcpTools: Array<{ name: string }>;
  }).__webmcpTools.map((tool) => tool.name));
  expect(toolNames).toEqual(expect.arrayContaining([
    "get_growth_workspace",
    "create_evidence_led_variant",
    "run_buyer_intent_battery",
    "stage_variant_for_review",
    "publish_approved_variant",
    "prepare_openai_ads_package",
    "search_product_by_need",
    "update_demo_cart",
  ]));
  expect(toolNames).toHaveLength(9);
  expect(toolNames.some((name) => name.startsWith("approve_") || name.startsWith("reset_"))).toBe(false);

  const workspace = await executeTool(page, "get_growth_workspace") as {
    effect: { class: string; changedState: boolean; externalWrite: boolean };
  };
  expect(workspace.effect).toEqual({
    class: "read",
    changedState: false,
    externalWrite: false,
    requiresApprovalState: false,
    approvalAssurance: "not_applicable",
    authority: "Agent may inspect verified merchant-controlled state.",
  });

  const draft = await executeTool(page, "create_evidence_led_variant") as {
    effect: { class: string };
  };
  expect(draft.effect.class).toBe("draft");
  await expect(page.getByRole("heading", { name: "24L Waterproof Commuter Backpack + Pannier" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Run the fixed buyer test" })).toBeVisible();

  const evaluation = await executeTool(page, "run_buyer_intent_battery") as {
    evaluation: { score: number; total: number };
  };
  expect(evaluation.evaluation).toMatchObject({ score: 8, total: 8 });
  await executeTool(page, "stage_variant_for_review");

  await expect(executeTool(page, "publish_approved_variant")).rejects.toThrow(/approval/i);
  await expect(page.getByRole("heading", { name: "Visible approval checkpoint" })).toBeVisible();
  await expect(page.getByText(/does not authenticate the browser actor/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve exact variant" })).toBeVisible();
  await page.getByRole("button", { name: "Approve exact variant" }).click();
  await expect(page.getByRole("heading", { name: "Continue after visible approval" })).toBeVisible();

  await executeTool(page, "publish_approved_variant");
  const ads = await executeTool(page, "prepare_openai_ads_package") as {
    adsPackage: { campaignStatus: string; disclaimer: string; feed: Record<string, unknown>; validation: { valid: boolean; unverified: string[] } };
    effect: { class: string; externalWrite: boolean };
  };
  expect(ads.adsPackage.campaignStatus).toBe("PAUSED");
  expect(ads.adsPackage.disclaimer).toMatch(/No Ads API call/);
  expect(ads.adsPackage.feed).toMatchObject({ identifier_exists: "no", is_ads_eligible: true });
  expect(ads.adsPackage.validation).toMatchObject({ valid: true });
  expect(ads.adsPackage.validation.unverified.length).toBeGreaterThan(0);
  expect(ads.effect).toMatchObject({ class: "paid_projection", externalWrite: false });
  await expect(page.getByText("Schema valid locally · Campaign PAUSED")).toBeVisible();

  const recommendation = await executeTool(page, "search_product_by_need", {
    query: "I need a waterproof bag for a 16-inch laptop",
  }) as { match: boolean; evidence: unknown[]; constraints: Array<{ status: string }> };
  expect(recommendation.match).toBe(true);
  expect(recommendation.evidence.length).toBeGreaterThanOrEqual(2);
  expect(recommendation.constraints.every((constraint) => constraint.status === "supported")).toBe(true);

  const cart = await executeTool(page, "update_demo_cart", { quantity: 2 }) as {
    quantity: number;
    checkoutStarted: boolean;
    paymentAttempted: boolean;
  };
  expect(cart).toMatchObject({ quantity: 2, checkoutStarted: false, paymentAttempted: false });
  await expect(page.getByRole("heading", { name: "Judge journey complete" })).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole("button", { name: /Shopper view 2/ }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByRole("heading", { name: "24L Waterproof Commuter Backpack + Pannier" })).toBeVisible();
  await expect(page.getByText("This page exposes verified fit, weather, repair, price and delivery facts through 9 WebMCP site tools.")).toBeVisible();
});
