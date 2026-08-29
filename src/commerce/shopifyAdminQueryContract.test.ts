import { buildSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";
import { readShopifyProduct, type ShopifyFetch } from "./shopifyAdminRead";

const productId = "gid://shopify/Product/108828309";

// Independent executable subset of the pinned Admin GraphQL 2026-07 schema.
// In that schema HasMetafields.metafields accepts keys: [String!], with each
// selector encoded as namespace.key. It does not accept identifiers.
const shopifyAdmin202607Schema = buildSchema(`
  scalar DateTime
  scalar Decimal
  scalar HTML
  scalar URL

  type Query {
    shop: Shop!
    product(id: ID!): Product
  }

  type Shop { currencyCode: CurrencyCode! }
  enum CurrencyCode { GBP USD }

  type Product {
    id: ID!
    title: String!
    description: String!
    descriptionHtml: HTML!
    handle: String!
    vendor: String!
    totalInventory: Int!
    updatedAt: DateTime!
    featuredMedia: Media
    variants(first: Int): ProductVariantConnection!
    metafields(first: Int, keys: [String!]): MetafieldConnection!
  }

  interface Media { id: ID! }
  type MediaImage implements Media {
    id: ID!
    image: Image
  }
  type Image {
    url: URL!
    altText: String
  }

  type ProductVariantConnection { nodes: [ProductVariant!]! }
  type ProductVariant {
    id: ID!
    sku: String
    price: Decimal!
    inventoryQuantity: Int
  }

  type MetafieldConnection { nodes: [Metafield!]! }
  type Metafield {
    id: ID!
    namespace: String!
    key: String!
    value: String!
    type: String!
    updatedAt: DateTime!
  }
`);

function successPayload() {
  return {
    data: {
      shop: { currencyCode: "GBP" },
      product: {
        id: productId,
        title: "Schema-contract product",
        description: "Controlled product",
        descriptionHtml: "<p>Controlled product</p>",
        handle: "schema-contract-product",
        vendor: "Fieldwork Supply",
        totalInventory: 1,
        updatedAt: "2026-08-29T10:00:00Z",
        featuredMedia: null,
        variants: {
          nodes: [{
            id: "gid://shopify/ProductVariant/1",
            sku: "SCHEMA-1",
            price: "10.00",
            inventoryQuantity: 1,
          }],
        },
        metafields: { nodes: [] },
      },
    },
  };
}

describe("Shopify Admin GraphQL 2026-07 query contract", () => {
  it("validates the actual submitted query and rejects the former identifiers shape", async () => {
    let submittedBody = "";
    const fetcher: ShopifyFetch = async (_url, init) => {
      submittedBody = String(init.body);
      return { ok: true, status: 200, json: async () => successPayload() };
    };

    await readShopifyProduct({
      shopDomain: "controlled-store.myshopify.com",
      productId,
      accessToken: "shpat_schema-contract-test",
      metafields: [
        { namespace: "custom", key: "waterproof_rating" },
        { namespace: "custom", key: "laptop_size" },
      ],
      fetcher,
      now: () => new Date("2026-08-29T10:00:00.000Z"),
    });

    const submitted = JSON.parse(submittedBody) as {
      query: string;
      variables: { metafieldKeys: string[] };
    };
    const validationErrors = validate(shopifyAdmin202607Schema, parse(submitted.query));

    expect(validationErrors.map((error) => error.message)).toEqual([]);
    expect(submitted.variables.metafieldKeys).toEqual([
      "custom.waterproof_rating",
      "custom.laptop_size",
    ]);

    const formerQuery = submitted.query
      .replace("$metafieldKeys: [String!]", "$metafieldIdentifiers: [HasMetafieldsIdentifier!]!")
      .replace("keys: $metafieldKeys", "identifiers: $metafieldIdentifiers");
    const formerErrors = validate(shopifyAdmin202607Schema, parse(formerQuery));

    expect(formerErrors.map((error) => error.message)).toEqual(expect.arrayContaining([
      expect.stringMatching(/Unknown type "HasMetafieldsIdentifier"/),
      expect.stringMatching(/Unknown argument "identifiers"/),
    ]));
  });
});
