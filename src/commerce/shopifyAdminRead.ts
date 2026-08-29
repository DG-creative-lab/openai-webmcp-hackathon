import {
  COMMERCE_CONTRACT_VERSION,
  type CommerceIdentity,
  type CommerceSnapshot,
  type EvidenceRecord,
  type SourceProvenance,
} from "./contracts";
import {
  createShopifyIdentity,
  shopifyAdminEndpoint,
  SHOPIFY_ADMIN_API_VERSION,
} from "./shopifyIdentity";

export interface ShopifyMetafieldSelector {
  namespace: string;
  key: string;
}

interface ShopifyFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type ShopifyFetch = (
  url: string,
  init: RequestInit,
) => Promise<ShopifyFetchResponse>;

export interface ShopifyProductReadInput {
  shopDomain: string;
  productId: string;
  accessToken: string;
  metafields?: readonly ShopifyMetafieldSelector[];
  fetcher?: ShopifyFetch;
  now?: () => Date;
}

const SHOPIFY_PRODUCT_READ_QUERY = `query ConversionLabProductRead(
  $id: ID!
  $metafieldIdentifiers: [HasMetafieldsIdentifier!]!
) {
  shop { currencyCode }
  product(id: $id) {
    id
    title
    description
    descriptionHtml
    handle
    vendor
    totalInventory
    updatedAt
    featuredMedia {
      ... on MediaImage { image { url altText } }
    }
    variants(first: 2) { nodes { id sku price inventoryQuantity } }
    metafields(first: 20, identifiers: $metafieldIdentifiers) {
      nodes { id namespace key value type updatedAt }
    }
  }
}`;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, field: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`Shopify product read failed: invalid ${field} response.`);
  return value;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Shopify product read failed: ${field} is missing or invalid.`);
  }
  return value;
}

function optionalString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function requirePrice(value: unknown): number {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) {
    throw new Error("Shopify product read failed: the first variant price is missing or invalid.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Shopify product read failed: the first variant price is missing or invalid.");
  }
  return parsed;
}

function requireInventory(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("Shopify product read failed: total inventory is missing or invalid.");
  }
  return value;
}

function requireAccessToken(value: unknown): string {
  const token = typeof value === "string" ? value.trim() : "";
  if (!token || /[\r\n]/.test(token)) {
    throw new Error("Shopify product read blocked: a valid server-side Admin API access token is required.");
  }
  return token;
}

function normalizeSelectors(selectors: unknown): ShopifyMetafieldSelector[] {
  if (!Array.isArray(selectors)) {
    throw new Error("Shopify product read blocked: metafield selectors must be an array.");
  }
  if (selectors.length > 20) {
    throw new Error("Shopify product read blocked: at most 20 metafield selectors are supported.");
  }
  const normalized = selectors.map((selector) => {
    if (!isRecord(selector)) {
      throw new Error("Shopify product read blocked: every metafield selector requires a namespace and key.");
    }
    return {
      namespace: typeof selector.namespace === "string" ? selector.namespace.trim() : "",
      key: typeof selector.key === "string" ? selector.key.trim() : "",
    };
  });
  if (normalized.some(({ namespace, key }) => !namespace || !key)) {
    throw new Error("Shopify product read blocked: every metafield selector requires a namespace and key.");
  }
  const identities = normalized.map(({ namespace, key }) => `${namespace}:${key}`);
  if (new Set(identities).size !== identities.length) {
    throw new Error("Shopify product read blocked: metafield selectors must be unique.");
  }
  return normalized;
}

function observedAt(clock: () => Date): string {
  const value = clock();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Shopify product read failed: the observation clock is invalid.");
  }
  return value.toISOString();
}

function provenance(target: CommerceIdentity, timestamp: string): SourceProvenance {
  return {
    source: `Shopify Admin GraphQL ${SHOPIFY_ADMIN_API_VERSION}`,
    reference: `${target.storeId}:${target.productId}`,
    observedAt: timestamp,
    freshness: "live",
  };
}

function evidenceRecord(input: {
  target: CommerceIdentity;
  timestamp: string;
  id: string;
  label: string;
  value: string;
  tags: string[];
  reference: string;
}): EvidenceRecord {
  const source = `Shopify Admin GraphQL ${SHOPIFY_ADMIN_API_VERSION}`;
  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    productIdentity: { ...input.target },
    id: input.id,
    label: input.label,
    value: input.value,
    source,
    verified: true,
    tags: input.tags,
    provenance: {
      source,
      reference: input.reference,
      observedAt: input.timestamp,
      freshness: "live",
    },
  };
}

function parseMetafields(
  value: unknown,
  selectors: readonly ShopifyMetafieldSelector[],
  target: CommerceIdentity,
  timestamp: string,
): EvidenceRecord[] {
  const connection = requireRecord(value, "product metafields");
  if (!Array.isArray(connection.nodes)) {
    throw new Error("Shopify product read failed: product metafields are missing or invalid.");
  }
  const selected = new Set(selectors.map(({ namespace, key }) => `${namespace}:${key}`));
  const records = connection.nodes.map((raw, index) => {
    const record = requireRecord(raw, `metafield ${index + 1}`);
    const namespace = requireString(record.namespace, `metafield ${index + 1} namespace`);
    const key = requireString(record.key, `metafield ${index + 1} key`);
    const selector = `${namespace}:${key}`;
    if (!selected.has(selector)) {
      throw new Error("Shopify product read failed: the response included an unrequested metafield.");
    }
    const metafieldId = requireString(record.id, `metafield ${selector} identity`);
    const metafieldValue = requireString(record.value, `metafield ${selector} value`);
    return evidenceRecord({
      target,
      timestamp,
      id: `shopify-metafield:${selector}`,
      label: `Shopify metafield ${namespace}.${key}`,
      value: metafieldValue,
      tags: ["metafield", namespace, key],
      reference: metafieldId,
    });
  });
  if (new Set(records.map((record) => record.id)).size !== records.length) {
    throw new Error("Shopify product read failed: the response included duplicate metafields.");
  }
  return records;
}

function mapSnapshot(
  payload: unknown,
  target: CommerceIdentity,
  selectors: readonly ShopifyMetafieldSelector[],
  timestamp: string,
): CommerceSnapshot {
  const root = requireRecord(payload, "GraphQL");
  if (Array.isArray(root.errors) && root.errors.length > 0) {
    throw new Error("Shopify product read failed: Shopify returned GraphQL errors.");
  }
  const data = requireRecord(root.data, "GraphQL data");
  const shop = requireRecord(data.shop, "shop");
  if (shop.currencyCode !== "GBP") {
    throw new Error("Shopify product read failed: commerce contract v1 supports GBP products only.");
  }
  if (data.product === null) {
    throw new Error("Shopify product read failed: the configured product was not found.");
  }
  const product = requireRecord(data.product, "product");
  const returnedId = requireString(product.id, "product identity");
  if (returnedId !== target.productId) {
    throw new Error("Shopify product read failed: the returned product identity did not match the configured target.");
  }

  const variants = requireRecord(product.variants, "product variants");
  if (!Array.isArray(variants.nodes) || variants.nodes.length !== 1) {
    throw new Error("Shopify product read failed: commerce contract v1 requires a single-variant product.");
  }
  const firstVariant = requireRecord(variants.nodes[0], "first variant");
  const variantId = requireString(firstVariant.id, "first variant identity");
  const sku = requireString(firstVariant.sku, "first variant SKU");
  const price = requirePrice(firstVariant.price);
  const inventory = requireInventory(product.totalInventory);

  const media = product.featuredMedia === null
    ? null
    : requireRecord(product.featuredMedia, "featured media");
  const image = media === null || media.image === null
    ? ""
    : requireString(requireRecord(media.image, "featured image").url, "featured image URL");
  const metafieldEvidence = parseMetafields(product.metafields, selectors, target, timestamp);
  const sourceProvenance = provenance(target, timestamp);
  const evidence = [
    evidenceRecord({
      target,
      timestamp,
      id: "shopify-price",
      label: "Shopify variant price",
      value: `GBP ${price.toFixed(2)}`,
      tags: ["price"],
      reference: variantId,
    }),
    evidenceRecord({
      target,
      timestamp,
      id: "shopify-inventory",
      label: "Shopify total inventory",
      value: String(inventory),
      tags: ["inventory", inventory > 0 ? "in-stock" : "out-of-stock"],
      reference: target.productId,
    }),
    ...metafieldEvidence,
  ];

  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    mode: "shopify",
    product: {
      contractVersion: COMMERCE_CONTRACT_VERSION,
      identity: { ...target },
      sku,
      handle: requireString(product.handle, "product handle"),
      brand: optionalString(product.vendor).trim() || target.storeId,
      price,
      currency: "GBP",
      inventory,
      image,
      baseline: {
        title: requireString(product.title, "product title"),
        description: optionalString(product.description),
        bullets: [],
      },
      provenance: sourceProvenance,
    },
    evidence,
    readReceipt: {
      contractVersion: COMMERCE_CONTRACT_VERSION,
      effect: "commerce_product_read",
      status: "succeeded",
      target: { ...target },
      externalEffect: false,
      nativeId: target.productId,
      payloadDigest: null,
      occurredAt: timestamp,
      rollbackReference: null,
    },
  };
}

export async function readShopifyProduct(input: ShopifyProductReadInput): Promise<CommerceSnapshot> {
  const target = createShopifyIdentity(input.shopDomain, input.productId);
  const token = requireAccessToken(input.accessToken);
  const selectors = normalizeSelectors(input.metafields ?? []);
  const timestamp = observedAt(input.now ?? (() => new Date()));
  const fetcher = input.fetcher ?? globalThis.fetch;
  let response: ShopifyFetchResponse;

  try {
    response = await fetcher(shopifyAdminEndpoint(target.storeId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: SHOPIFY_PRODUCT_READ_QUERY,
        variables: {
          id: target.productId,
          metafieldIdentifiers: selectors,
        },
      }),
    });
  } catch {
    throw new Error("Shopify product read failed: the network request could not be completed.");
  }

  if (!response.ok) {
    throw new Error(`Shopify product read failed: Shopify returned HTTP ${response.status}.`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("Shopify product read failed: Shopify returned invalid JSON.");
  }
  return mapSnapshot(payload, target, selectors, timestamp);
}
