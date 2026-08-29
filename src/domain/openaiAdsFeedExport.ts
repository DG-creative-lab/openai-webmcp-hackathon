import type { OpenAIAdsFeedExport, OpenAIProductFeedRow } from "./types";
import { validateOpenAIProductFeedRow } from "./openaiProductFeed";

const columns = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "availability",
  "availability_date",
  "price",
  "brand",
  "identifier_exists",
  "gtin",
  "mpn",
  "is_ads_eligible",
] as const;

type FeedColumn = typeof columns[number];

function cell(row: OpenAIProductFeedRow, column: FeedColumn): string {
  const value = row[column];
  if (value === undefined) return "";
  return typeof value === "boolean" ? String(value) : value;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function digestContents(contents: string): Promise<string> {
  const bytes = new TextEncoder().encode(contents);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256-v1-${hex}`;
}

export async function serializeOpenAIAdsFeedRows(input: {
  rows: readonly OpenAIProductFeedRow[];
  now?: Date;
}): Promise<Omit<OpenAIAdsFeedExport, "sourcePayloadDigest">> {
  if (input.rows.length === 0) {
    throw new Error("Ads feed export blocked: at least one product row is required.");
  }

  input.rows.forEach((row, index) => {
    const validation = validateOpenAIProductFeedRow(row, input.now);
    if (!validation.valid) {
      throw new Error(`Ads feed export blocked: row ${index + 1} failed local schema validation (${validation.errors.join(", ")}).`);
    }
  });

  const lines = [
    columns.join(","),
    ...input.rows.map((row) => columns.map((column) => csvCell(cell(row, column))).join(",")),
  ];
  const contents = `${lines.join("\r\n")}\r\n`;

  return {
    format: "google-compatible-csv",
    filename: "conversion-lab-openai-ads-feed.csv",
    mediaType: "text/csv;charset=utf-8",
    encoding: "UTF-8",
    rowCount: input.rows.length,
    contentDigest: await digestContents(contents),
    contents,
    delivery: {
      transport: "SFTP",
      requiresAdsManagerFeedConnection: true,
      advertiserApiUploadSupported: false,
    },
  };
}
