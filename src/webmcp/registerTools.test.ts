import { afterEach, describe, expect, it } from "vitest";
import { registerWebMCPTools } from "./registerTools";

describe("WebMCP registration", () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, "document");
  });

  it("registers the complete narrow tool surface", async () => {
    const definitions: Array<{ name: string; inputSchema: Record<string, unknown>; annotations?: { readOnlyHint?: boolean } }> = [];
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        modelContext: {
          registerTool: async (definition: typeof definitions[number]) => {
            definitions.push(definition);
          },
        },
      },
    });

    await expect(registerWebMCPTools()).resolves.toBe(true);
    expect(definitions).toHaveLength(9);
    expect(definitions.map((item) => item.name)).toContain("publish_merchant_approved_variant");
    expect(definitions.every((item) => item.inputSchema.additionalProperties === false)).toBe(true);
    expect(definitions.find((item) => item.name === "get_growth_workspace")?.annotations?.readOnlyHint).toBe(true);
  });
});
