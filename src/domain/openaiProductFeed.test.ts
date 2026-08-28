import { describe, expect, it } from "vitest";
import type { OpenAIProductFeedRow } from "./types";
import { validateOpenAIProductFeedRow } from "./openaiProductFeed";

const validRow: OpenAIProductFeedRow = {
  id: "SKU-1",
  title: "Verified product",
  description: "A plain-text product description.",
  price: "159.00 GBP",
  availability: "in_stock",
  link: "https://merchant.example/products/sku-1",
  image_link: "https://merchant.example/images/sku-1.png",
  brand: "Example Merchant",
  identifier_exists: "no",
  is_ads_eligible: true,
};

describe("OpenAI product-feed local schema validator", () => {
  it("accepts a complete row that truthfully declares no product identifier", () => {
    expect(validateOpenAIProductFeedRow(validRow)).toMatchObject({ scope: "local_schema", valid: true, errors: [] });
  });

  it("independently rejects omission of every identifier alternative", () => {
    const { identifier_exists: _omitted, ...withoutIdentifierDeclaration } = validRow;
    expect(validateOpenAIProductFeedRow(withoutIdentifierDeclaration)).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["required:gtin_or_mpn"]),
    });
  });

  it("accepts an omitted identifier_exists field when a valid GTIN is supplied", () => {
    const { identifier_exists: _omitted, ...row } = validRow;
    expect(validateOpenAIProductFeedRow({ ...row, gtin: "123456789012" })).toMatchObject({ valid: true, errors: [] });
  });

  it.each(["preorder", "backorder"] as const)("rejects %s without an availability date", (availability) => {
    expect(validateOpenAIProductFeedRow({ ...validRow, availability })).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["required:availability_date"]),
    });
  });

  it.each(["preorder", "backorder"] as const)("accepts %s with a valid ISO availability date", (availability) => {
    expect(validateOpenAIProductFeedRow({ ...validRow, availability, availability_date: "2099-12-01" })).toMatchObject({
      valid: true,
      errors: [],
    });
  });

  it("rejects a malformed availability date", () => {
    expect(validateOpenAIProductFeedRow({ ...validRow, availability: "preorder", availability_date: "2099-02-30" })).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["format:availability_date"]),
    });
  });

  it("rejects conflicting identifier declarations and malformed contract fields", () => {
    expect(validateOpenAIProductFeedRow({
      ...validRow,
      identifier_exists: "no",
      gtin: "invalid-gtin",
      price: "GBP 0",
      link: "javascript:alert(1)",
    })).toMatchObject({
      valid: false,
      errors: expect.arrayContaining(["conflict:identifier_exists", "format:gtin", "format:price", "format:link"]),
    });
  });
});
