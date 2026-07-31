import { describe, expect, it } from "vitest";
import { isBlockedAddress, parseSecureUrl } from "./url-security";

describe("proteção SSRF de fontes oficiais", () => {
  it("aceita HTTPS em domínio aprovado", () => {
    expect(parseSecureUrl("https://www.cebraspe.org.br/concursos", ["cebraspe.org.br"]).hostname).toBe("www.cebraspe.org.br");
  });
  it.each(["http://example.com/a.pdf", "file:///tmp/a.pdf", "ftp://example.com/a.pdf"])("rejeita protocolo inseguro %s", (url) => {
    expect(() => parseSecureUrl(url)).toThrow(/HTTPS/);
  });
  it.each(["https://localhost/a.pdf", "https://127.0.0.1/a.pdf", "https://10.1.2.3/a.pdf", "https://192.168.1.2/a.pdf", "https://172.20.1.2/a.pdf", "https://[::1]/a.pdf"])("rejeita destino privado %s", (url) => {
    expect(() => parseSecureUrl(url)).toThrow(/privado/);
  });
  it("rejeita credenciais e domínio não aprovado", () => {
    expect(() => parseSecureUrl("https://user:pass@example.com/a.pdf")).toThrow(/credenciais/);
    expect(() => parseSecureUrl("https://example.com/a.pdf", ["gov.br"])).toThrow(/aprovadas/);
  });
  it("classifica faixas privadas e link-local", () => {
    expect(["127.0.0.1", "10.0.0.1", "172.16.0.1", "192.168.0.1", "169.254.1.1", "::1", "fd00::1", "fe80::1"].every(isBlockedAddress)).toBe(true);
  });
});
