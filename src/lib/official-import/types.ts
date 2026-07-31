import type { DocumentType } from "@prisma/client";

export type DiscoveredDocument = {
  url: string;
  title: string;
  documentType: DocumentType;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  selected?: boolean;
};

export type SourceAnalysis = {
  adapter: string;
  detectedBoard?: string;
  status: "READY" | "MANUAL_REVIEW_REQUIRED";
  warning?: string;
  documents: DiscoveredDocument[];
};

export interface ContestSourceAdapter {
  readonly name: string;
  supports(url: URL): boolean;
  analyze(url: URL, html: string): Promise<SourceAnalysis>;
}

export type OfficialImportMetadata = {
  officialUrl: string;
  board?: string;
  institution: string;
  position: string;
  specialty?: string;
  year?: number;
  edition?: string;
  paperCode?: string;
  adminNotes?: string;
};
