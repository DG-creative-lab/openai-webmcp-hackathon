import { assertApprovalBinding } from "./approvalBinding";
import type { ApprovalEnvelope, EvidenceRecord, RepresentationVariant } from "./contracts";
import { serializeOpenAIAdsFeedRows } from "../domain/openaiAdsFeedExport";
import { validateOpenAIProductFeedRow } from "../domain/openaiProductFeed";
import type { FeedValidation, OpenAIAdsFeedExport, OpenAIProductFeedRow } from "../domain/types";

export async function prepareOpenAIAdsFeedProjection(input: {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
  now?: Date;
}): Promise<{ feed: OpenAIProductFeedRow; validation: FeedValidation; feedExport: OpenAIAdsFeedExport }> {
  const approvedDigest = await assertApprovalBinding(input);
  const product = input.approval.productSnapshot;
  const feed: OpenAIProductFeedRow = {
    id: product.sku,
    title: input.representation.copy.title,
    description: input.representation.copy.description,
    price: `${product.price.toFixed(2)} ${product.currency}`,
    availability: product.inventory > 0 ? "in_stock" : "out_of_stock",
    link: product.productUrl,
    image_link: product.imageUrl,
    brand: product.brand,
    identifier_exists: "no",
    is_ads_eligible: true,
  };
  const validation = validateOpenAIProductFeedRow(feed, input.now);
  if (!validation.valid) {
    throw new Error(`Ads preparation blocked: local feed schema failed (${validation.errors.join(", ")}).`);
  }
  const serialized = await serializeOpenAIAdsFeedRows({ rows: [feed], now: input.now });
  return {
    feed,
    validation,
    feedExport: { ...serialized, sourcePayloadDigest: approvedDigest },
  };
}
