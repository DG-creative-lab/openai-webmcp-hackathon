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

  it("requires evidence to be verified and bound to the evaluated product", () => {
    const copy: ProductCopy = { title: "IPX6 waterproof bag", description: "", bullets: [] };
    const unverified = evidence.map((item) => item.id === "ev-waterproof" ? { ...item, verified: false } : item);
    const wrongProduct = evidence.map((item) => item.id === "ev-waterproof"
      ? { ...item, productIdentity: { ...item.productIdentity, productId: "gid://shopify/Product/999" } }
      : item);
    expect(evaluateCopy(copy, unverified, "unverified", target).score).toBe(0);
    expect(evaluateCopy(copy, wrongProduct, "wrong product", target).score).toBe(0);
  });
});
