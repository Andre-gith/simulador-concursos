import type { ContestSourceAdapter, DiscoveredDocument, SourceAnalysis } from "./types";

function classify(title: string, href: string): DiscoveredDocument["documentType"] {
  const text = `${title} ${href}`.toLowerCase();
  if (/gabarito.*final|definitiv/.test(text)) return "ANSWER_KEY_FINAL";
  if (/gabarito/.test(text)) return "ANSWER_KEY_PRELIMINARY";
  if (/prova|caderno/.test(text)) return "EXAM";
  if (/retifica/.test(text)) return "RECTIFICATION";
  if (/anula/.test(text)) return "ANNULMENT_NOTICE";
  if (/edital/.test(text)) return "NOTICE";
  if (/resultado/.test(text)) return "RESULT";
  return "OTHER";
}

function links(base: URL, html: string) {
  const output: DiscoveredDocument[] = [];
  const pattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(pattern)) {
    try {
      const url = new URL(match[1], base);
      const title = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || url.pathname;
      if (url.protocol === "https:" && (/\.pdf(?:$|\?)/i.test(url.href) ||
        /prova|caderno|gabarito|edital|retifica|anula|resultado/i.test(title))) {
        output.push({ url: url.href, title, documentType: classify(title, url.href), confidence: "MEDIUM" });
      }
    } catch { /* href inválido é ignorado */ }
  }
  return [...new Map(output.map((item) => [item.url, item])).values()];
}

class PageAdapter implements ContestSourceAdapter {
  constructor(readonly name: string, private readonly hostPattern: RegExp, private readonly board?: string) {}
  supports(url: URL) { return this.hostPattern.test(url.hostname); }
  async analyze(url: URL, html: string): Promise<SourceAnalysis> {
    const documents = links(url, html);
    const hasExam = documents.some((item) => item.documentType === "EXAM");
    const hasKey = documents.some((item) => item.documentType.startsWith("ANSWER_KEY"));
    return {
      adapter: this.name, detectedBoard: this.board,
      status: hasExam && hasKey ? "READY" : "MANUAL_REVIEW_REQUIRED",
      warning: hasExam && hasKey ? undefined : "Prova e gabarito não foram identificados com segurança.",
      documents,
    };
  }
}

export class CebraspeSourceAdapter extends PageAdapter {
  constructor() { super("CebraspeSourceAdapter", /(?:cebraspe|cespe)\./i, "Cebraspe"); }
}
export class CesgranrioSourceAdapter extends PageAdapter {
  constructor() { super("CesgranrioSourceAdapter", /cesgranrio\./i, "Cesgranrio"); }
}
export class GenericOfficialPageAdapter extends PageAdapter {
  constructor() { super("GenericOfficialPageAdapter", /.*/); }
}
export class ManualSourceAdapter implements ContestSourceAdapter {
  readonly name = "ManualSourceAdapter";
  supports() { return true; }
  async analyze(url: URL): Promise<SourceAnalysis> {
    return { adapter: this.name, status: "MANUAL_REVIEW_REQUIRED",
      warning: "Informe e classifique manualmente as URLs HTTPS dos PDFs.", documents:
      /\.pdf(?:$|\?)/i.test(url.href) ? [{ url: url.href, title: url.pathname.split("/").at(-1) ?? "PDF", documentType: "OTHER", confidence: "LOW" }] : [] };
  }
}

export const sourceAdapters: ContestSourceAdapter[] = [
  new CebraspeSourceAdapter(), new CesgranrioSourceAdapter(), new GenericOfficialPageAdapter(),
];
