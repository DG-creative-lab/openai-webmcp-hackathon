import type { FeedValidation, OpenAIProductFeedRow } from "./types";

const requiredTextFields = ["id", "title", "description", "link", "image_link", "brand"] as const;
const allowedAvailability = new Set(["in_stock", "out_of_stock", "preorder", "backorder"]);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateOpenAIProductFeedRow(row: Partial<OpenAIProductFeedRow>): FeedValidation {
  const errors: string[] = [];

  requiredTextFields.forEach((field) => {
    if (typeof row[field] !== "string" || row[field].trim().length === 0) errors.push(`required:${field}`);
  });
  if (typeof row.price !== "string" || !/^\d+(?:\.\d{2}) [A-Z]{3}$/.test(row.price) || Number.parseFloat(row.price) <= 0) errors.push("format:price");
  if (typeof row.availability !== "string" || !allowedAvailability.has(row.availability)) errors.push("value:availability");
  if (typeof row.link !== "string" || !isHttpUrl(row.link)) errors.push("format:link");
  if (typeof row.image_link !== "string" || !isHttpUrl(row.image_link)) errors.push("format:image_link");
  if (row.identifier_exists !== undefined && row.identifier_exists !== "yes" && row.identifier_exists !== "no") errors.push("value:identifier_exists");
  if (row.identifier_exists !== "no" && !row.gtin?.trim() && !row.mpn?.trim()) errors.push("required:gtin_or_mpn");
  if (row.identifier_exists === "no" && (row.gtin?.trim() || row.mpn?.trim())) errors.push("conflict:identifier_exists");
  if (row.gtin && !/^\d{8,14}$/.test(row.gtin)) errors.push("format:gtin");
  if (row.is_ads_eligible !== true) errors.push("value:is_ads_eligible");

  return {
    scope: "local_schema",
    valid: errors.length === 0,
    errors,
    unverified: [
      "Product and image URLs resolve with HTTP 200",
      "Registered merchant name and feed configuration are accepted by OpenAI",
      "The row is accepted during OpenAI feed processing",
    ],
  };
}
