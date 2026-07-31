import { timingSafeEqual } from "node:crypto";

export function isCatalogCronAuthorized(value: string | null, secret = process.env.CATALOG_SYNC_SECRET) {
  const supplied = Buffer.from(value?.replace(/^Bearer\s+/i, "") ?? "");
  const expected = Buffer.from(secret ?? "");
  if (!secret || supplied.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(supplied, expected);
}
