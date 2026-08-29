import { describe, expect, it } from "vitest";
import { readShopifyProduct, type ShopifyFetch } from "../../src/commerce/shopifyAdminRead";

const configuredProduct = "gid://shopify/Product/108828309";
const secret = "shpat_adversarial-secret";

function payload(productId = configuredProduct) {
  return {
    data: {
      shop: { currencyCode: "GBP" },
      product: {
        id: productId,
        title: "Controlled product",
        description: "Controlled description",
        handle: "controlled-product",
        vendor: "Fieldwork Supply",
        totalInventory: 1,
        featuredMedia: null,
        variants: { nodes: [{ id: "gid://shopify/ProductVariant/1", sku: "CONTROLLED-1", price: "10.00" }] },
        metafields: { nodes: [] },
      },
    },
  };
}

function run(fetcher: ShopifyFetch) {
  return readShopifyProduct({
    shopDomain: "controlled-store.myshopify.com",
    productId: configuredProduct,
    accessToken: secret,
    fetcher,
    now: () => new Date("2026-08-29T10:00:00.000Z"),
  });
}

describe("Shopify live-read adversarial boundaries", () => {
  it("does not permit a response to substitute another native product identity", async () => {
    await expect(run(async () => ({
      ok: true,
      status: 200,
      json: async () => payload("gid://shopify/Product/999"),
    }))).rejects.toThrow(/identity did not match/i);
  });

  it("never copies credentials or hostile upstream error text into results or errors", async () => {
    const snapshot = await run(async () => ({ ok: true, status: 200, json: async () => payload() }));
    expect(JSON.stringify(snapshot)).not.toContain(secret);

    try {
      await run(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: `stolen ${secret}` }] }),
      }));
      throw new Error("Expected GraphQL error response to fail");
    } catch (error) {
      expect((error as Error).message).toMatch(/GraphQL errors/i);
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it("issues only the pinned read query and never an Admin mutation", async () => {
    let requestBody = "";
    await run(async (_url, init) => {
      requestBody = String(init.body);
      return { ok: true, status: 200, json: async () => payload() };
    });
    const request = JSON.parse(requestBody) as { query: string };
    expect(request.query).toContain("query ConversionLabProductRead");
    expect(request.query).toContain("variants(first: 2)");
    expect(request.query).not.toMatch(/\bmutation\b|productUpdate/);
  });
});
