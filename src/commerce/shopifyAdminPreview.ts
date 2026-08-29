import {
  COMMERCE_CONTRACT_VERSION,
  type ApprovalEnvelope,
  type ChannelProjection,
  type EvidenceRecord,
  type RepresentationVariant,
} from "./contracts";
import { assertApprovalBinding } from "./approvalBinding";
import {
  createShopifyIdentity,
  shopifyAdminEndpoint,
  SHOPIFY_ADMIN_API_VERSION,
} from "./shopifyIdentity";

export { SHOPIFY_ADMIN_API_VERSION } from "./shopifyIdentity";

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

export function previewShopifyProductRead(shopDomain: string, productId: string): ShopifyOperationPreview {
  const previewTarget = createShopifyIdentity(shopDomain, productId);
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
      endpoint: shopifyAdminEndpoint(previewTarget.storeId),
      query: productReadQuery,
      variables: { id: previewTarget.productId },
      requiredScopes: ["read_products"],
      requiredUserPermission: "Authorized Shopify user with product access",
      execution: "blocked_preview",
    },
  };
}

export async function previewShopifyProductUpdate(input: {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
}): Promise<ShopifyOperationPreview> {
  if (input.approval.target.provider !== "shopify") {
    throw new Error("Shopify update preview blocked: approval must target a Shopify product identity.");
  }
  const previewTarget = createShopifyIdentity(input.approval.target.storeId, input.approval.target.productId);
  const approvedDigest = await assertApprovalBinding(input);
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
      endpoint: shopifyAdminEndpoint(previewTarget.storeId),
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
