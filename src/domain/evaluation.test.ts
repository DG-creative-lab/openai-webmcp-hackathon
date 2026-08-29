import { describe, expect, it } from "vitest";
import { createFieldworkFixtureSnapshot } from "../commerce/fieldworkFixture";
import { evaluateCopy } from "./evaluation";
import type { ProductCopy } from "./types";

const fixture = createFieldworkFixtureSnapshot();
const evidence = fixture.evidence;
const target = fixture.product.identity;

describe("evidence-led evaluation", () => {
  it("does not award a match when evidence is absent from the copy", () => {
    const generic: ProductCopy = { title: "Good bag", description: "Made for every day", bullets: [] };
    expect(evaluateCopy(generic, evidence, "generic", target).score).toBe(0);
  });

  it("requires evidence to be verified, product-bound, fresh, and actually observed", () => {
    const copy: ProductCopy = { title: "IPX6 waterproof bag", description: "", bullets: [] };
    const unverified = evidence.map((item) => item.id === "ev-waterproof" ? { ...item, verified: false } : item);
    const wrongProduct = evidence.map((item) => item.id === "ev-waterproof"
      ? { ...item, productIdentity: { ...item.productIdentity, productId: "gid://shopify/Product/999" } }
      : item);
    const missingFreshness = evidence.map((item) => {
      if (item.id !== "ev-waterproof") return item;
      const provenance = { ...item.provenance } as Partial<typeof item.provenance>;
      delete provenance.freshness;
      return { ...item, provenance };
    }) as typeof evidence;
    const impossibleObservedAt = evidence.map((item) => item.id === "ev-waterproof"
      ? { ...item, provenance: { ...item.provenance, observedAt: "2099-02-30T00:00:00.000Z" } }
      : item);
    expect(evaluateCopy(copy, unverified, "unverified", target).score).toBe(0);
    expect(evaluateCopy(copy, wrongProduct, "wrong product", target).score).toBe(0);
    expect(evaluateCopy(copy, missingFreshness, "missing freshness", target).score).toBe(0);
    expect(evaluateCopy(copy, impossibleObservedAt, "impossible observedAt", target).score).toBe(0);
  });
});
