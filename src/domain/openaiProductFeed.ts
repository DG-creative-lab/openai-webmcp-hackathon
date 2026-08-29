import type { FeedValidation, OpenAIProductFeedRow } from "./types";

const requiredTextFields = ["id", "title", "description", "link", "image_link", "brand"] as const;
const allowedAvailability = new Set(["in_stock", "out_of_stock", "preorder", "backorder"]);
const availabilityRequiringDate = new Set(["preorder", "backorder"]);

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:")
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function isCalendarDate(year: number, month: number, day: number): boolean {
  const daysByMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= daysByMonth[month - 1];
}

function toUtcTimestamp(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

function parseIsoAvailabilityDate(value: string): number | null {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, yearText, monthText, dayText] = dateOnly;
    const [year, month, day] = [yearText, monthText, dayText].map(Number);
    return isCalendarDate(year, month, day) ? toUtcTimestamp(year, month, day) : null;
  }

  const dateTime = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!dateTime) return null;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText = "0", fractionText = "", , offsetSign, offsetHourText = "0", offsetMinuteText = "0"] = dateTime;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText,
    offsetHourText,
    offsetMinuteText,
  ].map(Number);
  if (!isCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) return null;
  if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return null;

  const fractionMilliseconds = fractionText ? Number(`0.${fractionText}`) * 1_000 : 0;
  const offsetDirection = offsetSign === "+" ? 1 : offsetSign === "-" ? -1 : 0;
  const offsetMilliseconds = offsetDirection * (offsetHour * 60 + offsetMinute) * 60_000;
  return toUtcTimestamp(year, month, day, hour, minute, second) + fractionMilliseconds - offsetMilliseconds;
}

export function validateOpenAIProductFeedRow(row: Partial<OpenAIProductFeedRow>, now: Date = new Date()): FeedValidation {
  const errors: string[] = [];

  requiredTextFields.forEach((field) => {
    if (typeof row[field] !== "string" || row[field].trim().length === 0) errors.push(`required:${field}`);
  });
  if (typeof row.id === "string" && row.id.length > 100) errors.push("length:id");
  if (typeof row.title === "string" && row.title.length > 150) errors.push("length:title");
  if (typeof row.description === "string" && row.description.length > 5_000) errors.push("length:description");
  if (typeof row.brand === "string" && row.brand.length > 70) errors.push("length:brand");
  if (typeof row.price !== "string" || !/^\d+(?:\.\d{2}) [A-Z]{3}$/.test(row.price) || Number.parseFloat(row.price) <= 0) errors.push("format:price");
  if (typeof row.availability !== "string" || !allowedAvailability.has(row.availability)) errors.push("value:availability");
  const availabilityDate = typeof row.availability_date === "string" ? row.availability_date.trim() : "";
  if (typeof row.availability === "string" && availabilityRequiringDate.has(row.availability) && availabilityDate.length === 0) {
    errors.push("required:availability_date");
  } else if (row.availability_date !== undefined) {
    const availabilityTimestamp = availabilityDate.length > 0 ? parseIsoAvailabilityDate(availabilityDate) : null;
    if (availabilityTimestamp === null) errors.push("format:availability_date");
    else if (availabilityTimestamp <= now.getTime()) errors.push("value:availability_date_future");
  }
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
