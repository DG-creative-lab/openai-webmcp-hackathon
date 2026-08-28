import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectTargets } from "../../scripts/test-impact.mjs";

describe("change-impact selector", () => {
  it("keeps documentation-only changes to diff hygiene", () => {
    assert.deepEqual(selectTargets(["README.md", "docs/TESTING.md"]), ["verify-diff"]);
  });

  it("selects control-plane coverage, build and smoke for store changes", () => {
    assert.deepEqual(selectTargets(["src/store/appStore.ts"]), [
      "verify-diff",
      "test-coverage",
      "build",
      "test-smoke",
    ]);
  });

  it("selects build and browser evidence for UI changes", () => {
    assert.deepEqual(selectTargets(["src/App.tsx"]), [
      "verify-diff",
      "check",
      "build",
      "test-smoke",
    ]);
  });

  it("runs only the relevant focused suite for isolated test changes", () => {
    assert.deepEqual(selectTargets(["tests/adversarial/authority.test.ts"]), [
      "verify-diff",
      "test-adversarial",
    ]);
    assert.deepEqual(selectTargets(["tests/infrastructure/selector.test.mjs"]), [
      "verify-diff",
      "test-infrastructure",
    ]);
  });

  it("fails safe to the complete gate for config and unknown paths", () => {
    assert.deepEqual(selectTargets(["package.json"]), ["test-all"]);
    assert.deepEqual(selectTargets(["new-runtime/adapter.ts"]), ["test-all"]);
  });
});
