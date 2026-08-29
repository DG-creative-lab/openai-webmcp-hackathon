import { describe, expect, it } from "vitest";
import { COMMERCE_CONTRACT_VERSION } from "./contracts";
import { createFieldworkFixtureSnapshot } from "./fieldworkFixture";
import { previewShopifyProductRead, previewShopifyProductUpdate, SHOPIFY_ADMIN_API_VERSION } from "./shopifyAdminPreview";

describe("versioned commerce adapter spine", () => {
  it("binds every fixture fact to one versioned native product identity", () => {
    const snapshot = createFieldworkFixtureSnapshot();
    expect(snapshot).toMatchObject({
      contractVersion: COMMERCE_CONTRACT_VERSION,
      mode: "fixture",
      product: {
        identity: { provider: "fixture", storeId: "fieldwork-demo.myshopify.com", productId: "gid://shopify/Product/108828309" },
        provenance: { freshness: "fixture" },
      },
      readReceipt: { status: "simulated", externalEffect: false },
    });
    expect(snapshot.evidence).toHaveLength(8);
    expect(snapshot.evidence.every((record) => record.productIdentity.productId === snapshot.product.identity.productId)).toBe(true);
    expect(snapshot.evidence.every((record) => record.contractVersion === COMMERCE_CONTRACT_VERSION && record.provenance.freshness === "fixture")).toBe(true);
  });

  it("returns a fresh fixture snapshot instead of sharing mutable adapter state", () => {
    const first = createFieldworkFixtureSnapshot();
    const second = createFieldworkFixtureSnapshot();
    first.evidence[0].tags.push("mutated");
    expect(second.evidence[0].tags).not.toContain("mutated");
  });

  it("builds a version-pinned, credential-free Shopify product read preview", () => {
    const preview = previewShopifyProductRead("fieldwork-demo.myshopify.com", "gid://shopify/Product/108828309");
    expect(preview).toMatchObject({
      apiVersion: SHOPIFY_ADMIN_API_VERSION,
      operation: "read_product",
      externalWrite: false,
      payload: {
        endpoint: `https://fieldwork-demo.myshopify.com/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`,
        variables: { id: "gid://shopify/Product/108828309" },
        requiredScopes: ["read_products"],
        execution: "blocked_preview",
      },
    });
    expect(JSON.stringify(preview)).not.toMatch(/access[_-]?token|secret|authorization/i);
  });

  it("binds an update preview to the exact product and approved digest without executing it", () => {
    const preview = previewShopifyProductUpdate({
      shopDomain: "fieldwork-demo.myshopify.com",
      productId: "gid://shopify/Product/108828309",
      approvedDigest: "fnv1a-deadbeef",
      copy: { title: "Approved title", description: "Approved description", bullets: ["Approved evidence"] },
    });
    expect(preview).toMatchObject({
      operation: "update_product",
      payloadDigest: "fnv1a-deadbeef",
      externalWrite: false,
      payload: {
        variables: { product: { id: "gid://shopify/Product/108828309", title: "Approved title", descriptionHtml: "Approved description" } },
        requiredScopes: ["write_products"],
        execution: "blocked_preview",
      },
    });
    expect(preview.payload.query).toContain("productUpdate(product: $product)");
  });

  it.each([
    ["evil.example.com", "gid://shopify/Product/108828309", /shop domain/i],
    ["fieldwork-demo.myshopify.com", "gid://shopify/Order/108828309", /product identity/i],
  ])("rejects an untrusted Shopify target", (shopDomain, productId, expected) => {
    expect(() => previewShopifyProductRead(shopDomain, productId)).toThrow(expected);
  });

  it("rejects an update preview without a valid approval digest or complete copy", () => {
    const base = { shopDomain: "fieldwork-demo.myshopify.com", productId: "gid://shopify/Product/108828309" };
    expect(() => previewShopifyProductUpdate({ ...base, approvedDigest: "missing", copy: { title: "Title", description: "Description", bullets: [] } })).toThrow(/approved payload digest/i);
    expect(() => previewShopifyProductUpdate({ ...base, approvedDigest: "fnv1a-deadbeef", copy: { title: " ", description: "Description", bullets: [] } })).toThrow(/non-empty/i);
  });
});
