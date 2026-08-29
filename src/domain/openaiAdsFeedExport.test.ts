import { describe, expect, it } from "vitest";
import { serializeOpenAIAdsFeedRows } from "./openaiAdsFeedExport";
import type { OpenAIProductFeedRow } from "./types";

const validRow: OpenAIProductFeedRow = {
  id: "URB-24-BLK",
  title: "Verified commuter pack",
  description: "Evidence-led product description.",
  link: "https://conversion-lab-webmcp.vercel.app/",
  image_link: "https://conversion-lab-webmcp.vercel.app/commuter-pack.png",
  availability: "in_stock",
  price: "159.00 GBP",
  brand: "Fieldwork Supply",
  identifier_exists: "no",
  is_ads_eligible: true,
};

async function independentDigest(contents: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(contents));
  return `sha256-v1-${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

describe("OpenAI Ads Google-compatible feed export", () => {
  it("serializes a deterministic UTF-8 CSV package with fixed canonical columns", async () => {
    const result = await serializeOpenAIAdsFeedRows({ rows: [validRow] });

    expect(result).toMatchObject({
      format: "google-compatible-csv",
      filename: "conversion-lab-openai-ads-feed.csv",
      mediaType: "text/csv;charset=utf-8",
      encoding: "UTF-8",
      rowCount: 1,
      contentDigest: expect.stringMatching(/^sha256-v1-[a-f0-9]{64}$/),
      delivery: {
        transport: "SFTP",
        requiresAdsManagerFeedConnection: true,
        advertiserApiUploadSupported: false,
      },
    });
    expect(result.contents.split("\r\n")[0]).toBe("id,title,description,link,image_link,availability,availability_date,price,brand,identifier_exists,gtin,mpn,is_ads_eligible");
    expect(result.contents).toContain('"URB-24-BLK","Verified commuter pack"');
    expect(result.contents).toContain(',"no","","","true"\r\n');
    expect(result.contentDigest).toBe(await independentDigest(result.contents));
  });

  it("quotes commas, quotes, and line breaks without changing product text", async () => {
    const title = 'Pack, "Weather"\nEdition';
    const result = await serializeOpenAIAdsFeedRows({ rows: [{ ...validRow, title }] });

    expect(result.contents).toContain('"Pack, ""Weather""\nEdition"');
  });

  it("produces identical content digests for identical rows and a different digest after a row change", async () => {
    const first = await serializeOpenAIAdsFeedRows({ rows: [validRow] });
    const repeated = await serializeOpenAIAdsFeedRows({ rows: [validRow] });
    const changed = await serializeOpenAIAdsFeedRows({ rows: [{ ...validRow, title: "Changed title" }] });

    expect(repeated.contentDigest).toBe(first.contentDigest);
    expect(changed.contentDigest).not.toBe(first.contentDigest);
  });

  it("fails closed for empty feeds or invalid rows", async () => {
    await expect(serializeOpenAIAdsFeedRows({ rows: [] })).rejects.toThrow(/at least one product row/i);
    await expect(serializeOpenAIAdsFeedRows({ rows: [{ ...validRow, is_ads_eligible: false as never }] })).rejects.toThrow(/value:is_ads_eligible/i);
    await expect(serializeOpenAIAdsFeedRows({
      rows: [{ ...validRow, identifier_exists: "yes", mpn: "X".repeat(71) }],
    })).rejects.toThrow(/length:mpn/i);
  });
});
