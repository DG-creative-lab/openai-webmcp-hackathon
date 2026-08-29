import type { CommerceIdentity } from "./contracts";

export const SHOPIFY_ADMIN_API_VERSION = "2026-07" as const;

export function createShopifyIdentity(shopDomain: string, productId: string): CommerceIdentity {
  const normalizedDomain = shopDomain.trim().toLowerCase();
  const suffix = ".myshopify.com";
  const shopLabel = normalizedDomain.endsWith(suffix)
    ? normalizedDomain.slice(0, -suffix.length)
    : "";

  if (
    shopLabel.length < 1
    || shopLabel.length > 63
    || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(shopLabel)
  ) {
    throw new Error("Invalid Shopify shop domain: expected a canonical *.myshopify.com hostname.");
  }
  if (!/^gid:\/\/shopify\/Product\/\d+$/.test(productId)) {
    throw new Error("Invalid Shopify product identity: expected a numeric Product GID.");
  }

  return { provider: "shopify", storeId: normalizedDomain, productId };
}

export function shopifyAdminEndpoint(shopDomain: string): string {
  return `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`;
}
