import {
  COMMERCE_CONTRACT_VERSION,
  type ApprovalEnvelope,
  type ChannelProjection,
  type CommerceIdentity,
  type EvidenceRecord,
  type RepresentationVariant,
} from "./contracts";
import { assertApprovalBinding } from "./approvalBinding";

export const SHOPIFY_ADMIN_API_VERSION = "2026-07" as const;

const productReadQuery = `query ConversionLabProductRead($id: ID!) {
  product(id: $id) {
    id
    title
    descriptionHtml
    handle
    vendor
    featuredMedia { preview { image { url altText } } }
    variants(first: 20) { nodes { id sku price inventoryQuantity } }
    metafields(first: 20) { nodes { id namespace key value type updatedAt } }
    updatedAt
  }
}`;

const productUpdateMutation = `mutation ConversionLabProductUpdate($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product { id title descriptionHtml handle updatedAt }
    userErrors { field message }
  }
}`;

interface ShopifyGraphQLPayload {
  method: "POST";
  endpoint: string;
  query: string;
  variables: Record<string, unknown>;
  requiredScopes: ("read_products" | "write_products")[];
  requiredUserPermission: string;
  execution: "blocked_preview";
}

export type ShopifyOperationPreview = ChannelProjection<ShopifyGraphQLPayload> & {
  channel: "shopify_admin";
  mode: "preview";
  status: "preview_ready";
  externalWrite: false;
  operation: "read_product" | "update_product";
  apiVersion: typeof SHOPIFY_ADMIN_API_VERSION;
};

function assertShopDomain(shopDomain: string): string {
  const normalized = shopDomain.trim().toLowerCase();
  const suffix = ".myshopify.com";
  const shopLabel = normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : "";
  if (shopLabel.length < 1 || shopLabel.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(shopLabel)) {
    throw new Error("Invalid Shopify shop domain: expected a canonical *.myshopify.com hostname.");
  }
  return normalized;
}

function assertProductId(productId: string): string {
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(productId)) {
    throw new Error("Invalid Shopify product identity: expected a numeric Product GID.");
  }
  return productId;
}

function target(shopDomain: string, productId: string): CommerceIdentity {
  return { provider: "shopify", storeId: assertShopDomain(shopDomain), productId: assertProductId(productId) };
}

function endpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
}

export function previewShopifyProductRead(shopDomain: string, productId: string): ShopifyOperationPreview {
  const previewTarget = target(shopDomain, productId);
  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    channel: "shopify_admin",
    mode: "preview",
    status: "preview_ready",
    operation: "read_product",
    apiVersion: SHOPIFY_ADMIN_API_VERSION,
    target: previewTarget,
    payloadDigest: null,
    externalWrite: false,
    payload: {
      method: "POST",
      endpoint: endpoint(previewTarget.storeId),
      query: productReadQuery,
      variables: { id: previewTarget.productId },
      requiredScopes: ["read_products"],
      requiredUserPermission: "Authorized Shopify user with product access",
      execution: "blocked_preview",
    },
  };
}

export function previewShopifyProductUpdate(input: {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
}): ShopifyOperationPreview {
  if (input.approval.target.provider !== "shopify") {
    throw new Error("Shopify update preview blocked: approval must target a Shopify product identity.");
  }
  const previewTarget = target(input.approval.target.storeId, input.approval.target.productId);
  const approvedDigest = assertApprovalBinding(input);
  if (!input.representation.copy.title.trim() || !input.representation.copy.description.trim()) {
    throw new Error("Shopify update preview blocked: title and description must be non-empty.");
  }

  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    channel: "shopify_admin",
    mode: "preview",
    status: "preview_ready",
    operation: "update_product",
    apiVersion: SHOPIFY_ADMIN_API_VERSION,
    target: previewTarget,
    payloadDigest: approvedDigest,
    externalWrite: false,
    payload: {
      method: "POST",
      endpoint: endpoint(previewTarget.storeId),
      query: productUpdateMutation,
      variables: {
        product: {
          id: previewTarget.productId,
          title: input.representation.copy.title,
          descriptionHtml: input.representation.copy.description,
        },
      },
      requiredScopes: ["write_products"],
      requiredUserPermission: "Authorized Shopify user permitted to update products",
      execution: "blocked_preview",
    },
  };
}
