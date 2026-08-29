import { describe, expect, it, vi } from "vitest";
import {
  readShopifyProduct,
  type ShopifyFetch,
  type ShopifyProductReadInput,
} from "./shopifyAdminRead";
import { SHOPIFY_ADMIN_API_VERSION } from "./shopifyIdentity";

const token = "shpat_test-only-secret";
const productId = "gid://shopify/Product/108828309";
const timestamp = "2026-08-29T09:30:00.000Z";

function responsePayload() {
  return {
    data: {
      shop: { currencyCode: "GBP" },
      product: {
        id: productId,
        title: "Live commuter pack",
        description: "Live product description",
        descriptionHtml: "<p>Live product description</p>",
        handle: "live-commuter-pack",
        vendor: "Fieldwork Supply",
        totalInventory: 12,
        updatedAt: "2026-08-29T08:00:00Z",
        featuredMedia: {
          image: { url: "https://cdn.shopify.com/live-pack.png", altText: "Black commuter pack" },
        },
        variants: {
          nodes: [{ id: "gid://shopify/ProductVariant/201", sku: "LIVE-24-BLK", price: "159.00", inventoryQuantity: 12 }],
        },
        metafields: {
          nodes: [
            { id: "gid://shopify/Metafield/301", namespace: "custom", key: "waterproof_rating", value: "IPX6", type: "single_line_text_field", updatedAt: "2026-08-29T08:00:00Z" },
            { id: "gid://shopify/Metafield/302", namespace: "custom", key: "laptop_size", value: "16 inch", type: "single_line_text_field", updatedAt: "2026-08-29T08:00:00Z" },
          ],
        },
      },
    },
  };
}

function input(fetcher: ShopifyFetch): ShopifyProductReadInput {
  return {
    shopDomain: " Fieldwork-Demo.MyShopify.com ",
    productId,
    accessToken: token,
    metafields: [
      { namespace: " custom ", key: " waterproof_rating " },
      { namespace: "custom", key: "laptop_size" },
    ],
    fetcher,
    now: () => new Date(timestamp),
  };
}

function successfulFetcher(payload: unknown = responsePayload()): ShopifyFetch {
  return vi.fn(async () => ({ ok: true, status: 200, json: async () => payload }));
}

describe("Shopify dev-store product reader", () => {
  it("reads one configured product into the versioned commerce snapshot without exposing credentials", async () => {
    const fetcher = successfulFetcher();
    const snapshot = await readShopifyProduct(input(fetcher));

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, request] = vi.mocked(fetcher).mock.calls[0];
    expect(url).toBe(`https://fieldwork-demo.myshopify.com/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`);
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
    });
    const body = JSON.parse(String(request.body));
    expect(body).toMatchObject({
      variables: {
        id: productId,
        metafieldIdentifiers: [
          { namespace: "custom", key: "waterproof_rating" },
          { namespace: "custom", key: "laptop_size" },
        ],
      },
    });
    expect(body.query).toContain("query ConversionLabProductRead");

    expect(snapshot).toMatchObject({
      contractVersion: "conversion-lab.commerce.v1",
      mode: "shopify",
      product: {
        identity: { provider: "shopify", storeId: "fieldwork-demo.myshopify.com", productId },
        sku: "LIVE-24-BLK",
        handle: "live-commuter-pack",
        brand: "Fieldwork Supply",
        price: 159,
        currency: "GBP",
        inventory: 12,
        image: "https://cdn.shopify.com/live-pack.png",
        baseline: { title: "Live commuter pack", description: "Live product description", bullets: [] },
        provenance: { freshness: "live", observedAt: timestamp },
      },
      readReceipt: {
        effect: "commerce_product_read",
        status: "succeeded",
        externalEffect: false,
        nativeId: productId,
        occurredAt: timestamp,
      },
    });
    expect(snapshot.evidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "shopify-price", value: "GBP 159.00", verified: true }),
      expect.objectContaining({ id: "shopify-inventory", value: "12", tags: ["inventory", "in-stock"] }),
      expect.objectContaining({
        id: "shopify-metafield:custom:waterproof_rating",
        value: "IPX6",
        productIdentity: snapshot.product.identity,
        provenance: { source: `Shopify Admin GraphQL ${SHOPIFY_ADMIN_API_VERSION}`, reference: "gid://shopify/Metafield/301", observedAt: timestamp, freshness: "live" },
      }),
    ]));
    expect(JSON.stringify(snapshot)).not.toContain(token);
  });

  it("supports a product without featured media, vendor, description, or selected metafields", async () => {
    const payload = responsePayload();
    payload.data.product.featuredMedia = null as never;
    payload.data.product.vendor = "";
    payload.data.product.description = "";
    payload.data.product.totalInventory = 0;
    payload.data.product.metafields.nodes = [];
    const snapshot = await readShopifyProduct({
      ...input(successfulFetcher(payload)),
      metafields: [],
    });

    expect(snapshot.product).toMatchObject({
      brand: "fieldwork-demo.myshopify.com",
      image: "",
      baseline: { description: "" },
    });
    expect(snapshot.evidence).toHaveLength(2);
    expect(snapshot.evidence[1].tags).toEqual(["inventory", "out-of-stock"]);
  });

  it.each([
    ["wrong currency", (payload: ReturnType<typeof responsePayload>) => { payload.data.shop.currencyCode = "USD"; }, /supports GBP products only/i],
    ["missing product", (payload: ReturnType<typeof responsePayload>) => { payload.data.product = null as never; }, /not found/i],
    ["substituted product", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.id = "gid://shopify/Product/999"; }, /did not match/i],
    ["missing first variant", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.variants.nodes = []; }, /single-variant product/i],
    ["ambiguous variants", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.variants.nodes.push({ ...payload.data.product.variants.nodes[0], id: "gid://shopify/ProductVariant/202" }); }, /single-variant product/i],
    ["missing SKU", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.variants.nodes[0].sku = ""; }, /SKU is missing/i],
    ["invalid price", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.variants.nodes[0].price = "-1"; }, /price is missing or invalid/i],
    ["non-finite price", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.variants.nodes[0].price = "9".repeat(400); }, /price is missing or invalid/i],
    ["invalid inventory", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.totalInventory = 1.5; }, /inventory is missing or invalid/i],
    ["invalid featured media", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.featuredMedia = {} as never; }, /featured image response/i],
    ["unrequested metafield", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.metafields.nodes[0].key = "private_note"; }, /unrequested metafield/i],
    ["duplicate metafield", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.metafields.nodes.push({ ...payload.data.product.metafields.nodes[0] }); }, /duplicate metafields/i],
    ["invalid metafield value", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.metafields.nodes[0].value = ""; }, /metafield custom:waterproof_rating value/i],
    ["missing title", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.title = ""; }, /product title is missing/i],
    ["missing handle", (payload: ReturnType<typeof responsePayload>) => { payload.data.product.handle = ""; }, /product handle is missing/i],
  ])("fails closed for a live response with %s", async (_label, mutate, expected) => {
    const payload = responsePayload();
    mutate(payload);
    await expect(readShopifyProduct(input(successfulFetcher(payload)))).rejects.toThrow(expected);
  });

  it.each([
    ["missing token", { accessToken: " " }, /access token is required/i],
    ["non-string token", { accessToken: undefined as never }, /access token is required/i],
    ["header-injection token", { accessToken: "secret\nInjected: yes" }, /access token is required/i],
    ["too many selectors", { metafields: Array.from({ length: 21 }, (_, index) => ({ namespace: "custom", key: `key_${index}` })) }, /at most 20/i],
    ["blank selector", { metafields: [{ namespace: "custom", key: " " }] }, /requires a namespace and key/i],
    ["non-record selector", { metafields: [null] as never }, /requires a namespace and key/i],
    ["non-array selectors", { metafields: {} as never }, /must be an array/i],
    ["duplicate selector", { metafields: [{ namespace: "custom", key: "rating" }, { namespace: "custom", key: "rating" }] }, /must be unique/i],
    ["invalid clock", { now: () => new Date("invalid") }, /clock is invalid/i],
  ])("blocks invalid configuration: %s", async (_label, override, expected) => {
    await expect(readShopifyProduct({ ...input(successfulFetcher()), ...override })).rejects.toThrow(expected);
  });

  it("normalizes transport, HTTP, JSON, and GraphQL failures without leaking the access token", async () => {
    const cases: Array<[ShopifyFetch, RegExp]> = [
      [async () => { throw new Error(token); }, /network request could not be completed/i],
      [async () => ({ ok: false, status: 401, json: async () => ({ secret: token }) }), /HTTP 401/i],
      [async () => ({ ok: true, status: 200, json: async () => { throw new Error(token); } }), /invalid JSON/i],
      [successfulFetcher({ errors: [{ message: token }] }), /GraphQL errors/i],
    ];

    for (const [fetcher, expected] of cases) {
      try {
        await readShopifyProduct(input(fetcher));
        throw new Error("Expected Shopify read to fail");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(expected);
        expect((error as Error).message).not.toContain(token);
      }
    }
  });

  it("rejects malformed GraphQL containers and metafield connections", async () => {
    await expect(readShopifyProduct(input(successfulFetcher(null)))).rejects.toThrow(/invalid GraphQL response/i);
    await expect(readShopifyProduct(input(successfulFetcher({ data: null })))).rejects.toThrow(/GraphQL data response/i);
    const payload = responsePayload();
    payload.data.product.metafields = null as never;
    await expect(readShopifyProduct(input(successfulFetcher(payload)))).rejects.toThrow(/product metafields response/i);
    const missingNodes = responsePayload();
    missingNodes.data.product.metafields = {} as never;
    await expect(readShopifyProduct(input(successfulFetcher(missingNodes)))).rejects.toThrow(/metafields are missing or invalid/i);
  });
});
