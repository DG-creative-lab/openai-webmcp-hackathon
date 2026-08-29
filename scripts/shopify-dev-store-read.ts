import {
  readShopifyProduct,
  type ShopifyMetafieldSelector,
} from "../src/commerce/shopifyAdminRead.ts";

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function metafieldSelectors(value: string | undefined): ShopifyMetafieldSelector[] {
  if (!value?.trim()) return [];
  return value.split(",").map((entry) => {
    const separator = entry.indexOf(":");
    if (separator < 1 || separator === entry.length - 1) {
      throw new Error("SHOPIFY_METAFIELDS must be a comma-separated namespace:key list.");
    }
    return {
      namespace: entry.slice(0, separator).trim(),
      key: entry.slice(separator + 1).trim(),
    };
  });
}

try {
  const snapshot = await readShopifyProduct({
    shopDomain: requiredEnvironment("SHOPIFY_SHOP_DOMAIN"),
    productId: requiredEnvironment("SHOPIFY_PRODUCT_GID"),
    accessToken: requiredEnvironment("SHOPIFY_ADMIN_ACCESS_TOKEN"),
    metafields: metafieldSelectors(process.env.SHOPIFY_METAFIELDS),
  });
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "Shopify product read failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
