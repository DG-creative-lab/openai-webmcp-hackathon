import { assertApprovalBinding } from "./approvalBinding";
import type { ApprovalEnvelope, CommerceIdentity, EvidenceRecord, RepresentationVariant } from "./contracts";
import { serializeOpenAIAdsFeedRows } from "../domain/openaiAdsFeedExport";
import { validateOpenAIProductFeedRow } from "../domain/openaiProductFeed";
import type { FeedValidation, OpenAIAdsFeedExport, OpenAIProductFeedRow } from "../domain/types";

interface AdsFeedProductSource {
  identity: Readonly<CommerceIdentity>;
  sku: string;
  brand: string;
  price: number;
  currency: "GBP";
  inventory: number;
  productUrl: string;
  imageUrl: string;
}

function sameIdentity(left: Readonly<CommerceIdentity>, right: Readonly<CommerceIdentity>): boolean {
  return left.provider === right.provider && left.storeId === right.storeId && left.productId === right.productId;
}

export async function prepareOpenAIAdsFeedProjection(input: {
  approval: Readonly<ApprovalEnvelope>;
  representation: Readonly<RepresentationVariant>;
  evidence: readonly EvidenceRecord[];
  product: Readonly<AdsFeedProductSource>;
  now?: Date;
}): Promise<{ feed: OpenAIProductFeedRow; validation: FeedValidation; feedExport: OpenAIAdsFeedExport }> {
  if (!sameIdentity(input.product.identity, input.approval.target)) {
    throw new Error("Ads preparation blocked: the product source does not match the approved target.");
  }
  const approvedDigest = await assertApprovalBinding(input);
  const feed: OpenAIProductFeedRow = {
    id: input.product.sku,
    title: input.representation.copy.title,
    description: input.representation.copy.description,
    price: `${input.product.price.toFixed(2)} ${input.product.currency}`,
    availability: input.product.inventory > 0 ? "in_stock" : "out_of_stock",
    link: input.product.productUrl,
    image_link: input.product.imageUrl,
    brand: input.product.brand,
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
