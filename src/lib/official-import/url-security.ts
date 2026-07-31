import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const DOWNLOAD_LIMITS = {
  timeoutMs: 20_000,
  maxRedirects: 3,
  maxBytes: 20 * 1024 * 1024,
  maxDocuments: 12,
} as const;

const blockedIpv4 = [
  /^127\./, /^10\./, /^192\.168\./, /^169\.254\./,
  /^0\./, /^224\./, /^255\./,
];

export function isBlockedAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") ||
      normalized.startsWith("fd") || normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") || normalized.startsWith("fea") ||
      normalized.startsWith("feb")) return true;
  if (blockedIpv4.some((pattern) => pattern.test(normalized))) return true;
  const parts = normalized.split(".").map(Number);
  return parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31;
}

export function parseSecureUrl(raw: string, approvedHosts: string[] = []) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("URL inválida."); }
  if (url.protocol !== "https:") throw new Error("Somente URLs HTTPS são permitidas.");
  if (url.username || url.password) throw new Error("URLs com credenciais são proibidas.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") ||
      isBlockedAddress(hostname) ||
      (isIP(hostname.replace(/^\[|\]$/g, "")) !== 0 && isBlockedAddress(hostname))) {
    throw new Error("Destino local ou privado é proibido.");
  }
  if (approvedHosts.length && !approvedHosts.some((host) =>
    hostname === host || hostname.endsWith(`.${host}`))) {
    throw new Error("O domínio não está na lista de fontes oficiais aprovadas.");
  }
  return url;
}

export async function validatePublicDns(url: URL, resolver = lookup) {
  const addresses = await resolver(url.hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isBlockedAddress(address))) {
    throw new Error("O domínio resolve para uma rede proibida.");
  }
  return addresses.map(({ address }) => address);
}

export function approvedOfficialHosts(environment = process.env) {
  return (environment.OFFICIAL_SOURCE_HOSTS ?? "")
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
}
