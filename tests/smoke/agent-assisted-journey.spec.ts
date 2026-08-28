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

test("an agent discovers the tools and completes the journey with merchant approval", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("9 site tools live")).toBeVisible();

  const toolNames = await page.evaluate(() => (window as unknown as {
    __webmcpTools: Array<{ name: string }>;
  }).__webmcpTools.map((tool) => tool.name));
  expect(toolNames).toEqual(expect.arrayContaining([
    "get_growth_workspace",
    "create_evidence_led_variant",
    "run_buyer_intent_battery",
    "stage_variant_for_merchant_review",
    "publish_merchant_approved_variant",
    "prepare_openai_ads_package",
    "search_product_by_need",
    "update_demo_cart",
  ]));
  expect(toolNames).toHaveLength(9);
  expect(toolNames.some((name) => name.startsWith("approve_") || name.startsWith("reset_"))).toBe(false);

  await executeTool(page, "create_evidence_led_variant");
  const evaluation = await executeTool(page, "run_buyer_intent_battery") as { score: number; total: number };
  expect(evaluation).toMatchObject({ score: 8, total: 8 });
  await executeTool(page, "stage_variant_for_merchant_review");

  await expect(executeTool(page, "publish_merchant_approved_variant")).rejects.toThrow(/approval/i);
  await expect(page.getByRole("button", { name: "Approve exact variant" })).toBeVisible();
  await page.getByRole("button", { name: "Approve exact variant" }).click();

  await executeTool(page, "publish_merchant_approved_variant");
  const ads = await executeTool(page, "prepare_openai_ads_package") as {
    campaignStatus: string;
    disclaimer: string;
  };
  expect(ads.campaignStatus).toBe("PAUSED");
  expect(ads.disclaimer).toMatch(/No Ads API call/);
  await expect(page.getByText("Feed ready · Campaign PAUSED")).toBeVisible();

  const recommendation = await executeTool(page, "search_product_by_need", {
    query: "I need a waterproof bag for a 16-inch laptop",
  }) as { match: boolean; evidence: unknown[] };
  expect(recommendation.match).toBe(true);
  expect(recommendation.evidence.length).toBeGreaterThanOrEqual(2);

  const cart = await executeTool(page, "update_demo_cart", { quantity: 2 }) as {
    quantity: number;
    checkoutStarted: boolean;
    paymentAttempted: boolean;
  };
  expect(cart).toEqual({ quantity: 2, checkoutStarted: false, paymentAttempted: false });

  await page.getByRole("button", { name: /Shopper view 2/ }).click();
  await expect(page.getByRole("heading", { name: "24L Waterproof Commuter Backpack + Pannier" })).toBeVisible();
  await expect(page.getByText("This page exposes verified fit, weather, repair, price and delivery facts through 9 WebMCP site tools.")).toBeVisible();
});
