import { timingSafeEqual } from "node:crypto";

export function isValidCronAuthorization(header: string | null, secret: string | undefined) {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const supplied = Buffer.from(header.slice(7), "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (supplied.length !== expected.length) {
    timingSafeEqual(expected, expected);
    return false;
  }
  return timingSafeEqual(supplied, expected);
}
