import {
  COMMERCE_CONTRACT_VERSION,
  type CommerceIdentity,
  type CommerceSnapshot,
  type EvidenceRecord,
} from "./contracts";

const observedAt = "2026-08-28T00:00:00.000Z";
const identity: CommerceIdentity = {
  provider: "shopify",
  storeId: "fieldwork-demo.myshopify.com",
  productId: "gid://shopify/Product/108828309",
};

const evidence: Omit<EvidenceRecord, "contractVersion" | "productIdentity" | "provenance">[] = [
  { id: "ev-waterproof", label: "Weather protection", value: "IPX6 waterproof", source: "Independent spray test · LAB-117", verified: true, tags: ["waterproof", "rain"] },
  { id: "ev-laptop", label: "Laptop sleeve", value: "Fits up to 16-inch laptop", source: "Product specification · PS-24L", verified: true, tags: ["laptop", "commute"] },
  { id: "ev-repair", label: "Repair programme", value: "5 years for zips, buckles and seams", source: "Repair policy · RP-05", verified: true, tags: ["repair", "durability"] },
  { id: "ev-price", label: "Retail price", value: "£159", source: "Shopify price · fixture", verified: true, tags: ["price"] },
  { id: "ev-delivery", label: "Dispatch promise", value: "Dispatches today for Friday delivery", source: "Warehouse SLA · fixture", verified: true, tags: ["delivery"] },
  { id: "ev-weight", label: "Product weight", value: "1.2kg", source: "Product specification · PS-24L", verified: true, tags: ["weight"] },
  { id: "ev-rack", label: "Rack attachment", value: "Rack system tested to 12kg", source: "Load test · LAB-104", verified: true, tags: ["bike", "rack"] },
  { id: "ev-capacity", label: "Capacity", value: "24L", source: "Product specification · PS-24L", verified: true, tags: ["capacity"] },
];

export function createFieldworkFixtureSnapshot(): CommerceSnapshot {
  return {
    contractVersion: COMMERCE_CONTRACT_VERSION,
    mode: "fixture",
    product: {
      contractVersion: COMMERCE_CONTRACT_VERSION,
      identity: { ...identity },
      sku: "URB-24-BLK",
      handle: "modular-commuter-24",
      brand: "Fieldwork Supply",
      price: 159,
      currency: "GBP",
      inventory: 18,
      image: "/commuter-pack.png",
      baseline: {
        title: "Modular Commuter Pack",
        description: "A versatile technical bag designed for everyday movement through the city.",
        bullets: ["Flexible carry modes", "Durable construction", "Built for daily use"],
      },
      provenance: {
        source: "Fieldwork Supply deterministic judge fixture",
        reference: "fixtures/fieldwork-supply/URB-24-BLK",
        observedAt,
        freshness: "fixture",
      },
    },
    evidence: evidence.map((record) => ({
      ...record,
      tags: [...record.tags],
      contractVersion: COMMERCE_CONTRACT_VERSION,
      productIdentity: { ...identity },
      provenance: {
        source: record.source,
        reference: record.id,
        observedAt,
        freshness: "fixture",
      },
    })),
    readReceipt: {
      contractVersion: COMMERCE_CONTRACT_VERSION,
      effect: "commerce_product_read",
      status: "simulated",
      target: { ...identity },
      externalEffect: false,
      nativeId: identity.productId,
      payloadDigest: null,
      occurredAt: observedAt,
      rollbackReference: null,
    },
  };
}
