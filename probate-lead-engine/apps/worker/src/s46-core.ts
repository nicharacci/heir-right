import { getDocumentProxy } from "unpdf";

export const S46_REQUIRED_SOURCES = [
  "idi_core",
  "idi_contacts",
  "property_appraiser",
  "tax_collector",
  "official_records",
  "direct_obituary",
] as const;

export type S46SourceName = typeof S46_REQUIRED_SOURCES[number];
export type S46SourceOutcome =
  | "found"
  | "checked_not_found"
  | "unattempted"
  | "unconfigured"
  | "blocked"
  | "provider_failed"
  | "identity_mismatch"
  | "conflict"
  | "retry_exhausted";

export type S46Evidence = {
  source: S46SourceName | "nous";
  page?: number;
  sourceUrl?: string;
  retrievedAt: string;
  sha256: string;
  excerpt: string;
};

export type S46Heir = {
  name: string;
  age: string;
  email: string;
  phone: string;
  addresses: string[];
  evidence: Partial<Record<"name" | "age" | "email" | "phone" | "addresses", S46Evidence>>;
};

export type S46MappedDocument = {
  owner: string;
  dateOfBirth: string;
  dateOfDeath: string;
  obituaryUrl: string;
  propertyAddress: string;
  mailingAddress: string;
  folio: string;
  county: string;
  taxReceiptUrl: string;
  taxSummary: string;
  deedSummary: string;
  backStory: string;
  heirs: S46Heir[];
  evidence: Partial<Record<string, S46Evidence>>;
};

export type S46SourceDocument = {
  version: 1;
  provider: "manual_pdf" | "idi_api";
  sourceVersionId: string;
  objectKey: string;
  mimeType: "application/pdf";
  byteCount: number;
  sha256: string;
  pageCount: number;
  originalOrder: number;
};

export type S46PdfInspection = {
  pageCount: number;
  pages: string[];
};

export const S46_MAX_SINGLE_BYTES = 12 * 1024 * 1024;
export const S46_MAX_BATCH_FILES = 5;
export const S46_MAX_BATCH_BYTES = 24 * 1024 * 1024;
export const S46_MAX_PAGES = 100;

export function safeFilename(value: string): string {
  const base = String(value || "discovery-source.pdf")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return `${base.replace(/\.pdf$/i, "") || "discovery-source"}.pdf`;
}

export function validIdempotencyKey(value: string): boolean {
  return /^[A-Za-z0-9._:-]{16,128}$/.test(value);
}

export async function sha256(value: ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function assertPdfEnvelope(bytes: Uint8Array, mimeType: string): void {
  if (mimeType.toLowerCase() !== "application/pdf") throw new Error("wrong_mime_type");
  if (bytes.byteLength < 8 || bytes.byteLength > S46_MAX_SINGLE_BYTES) throw new Error("invalid_pdf_size");
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") throw new Error("invalid_pdf_magic");
}

export async function inspectPdf(bytes: Uint8Array): Promise<S46PdfInspection> {
  let document;
  try {
    // unpdf can transfer its input buffer. Parse a copy so custody bytes remain
    // available for R2 storage and SHA-256 readback.
    document = await getDocumentProxy(bytes.slice(), { maxImageSize: 16 * 1024 * 1024 });
  } catch {
    throw new Error("unreadable_pdf");
  }
  if (document.numPages < 1 || document.numPages > S46_MAX_PAGES) throw new Error("unsupported_page_count");
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const content = await (await document.getPage(pageNumber)).getTextContent();
    const rows = new Map<number, Array<{ x: number; value: string }>>();
    const fallback: string[] = [];
    for (const item of content.items) {
      const value = "str" in item ? item.str.replace(/\s+/g, " ").trim() : "";
      if (!value) continue;
      const transform = "transform" in item && Array.isArray(item.transform) ? item.transform : [];
      const x = typeof transform[4] === "number" ? transform[4] : 0;
      const y = typeof transform[5] === "number" ? Math.round(transform[5] * 2) / 2 : null;
      if (y === null) fallback.push(value);
      else {
        const row = rows.get(y) || [];
        row.push({ x, value });
        rows.set(y, row);
      }
    }
    const lines = [...rows.entries()]
      .sort((left, right) => right[0] - left[0])
      .map(([, row]) => row.sort((left, right) => left.x - right.x).map((cell) => cell.value).join(" ").replace(/\s+/g, " ").trim())
      .filter(Boolean);
    pages.push(lines.length ? lines.join("\n") : fallback.join(" "));
  }
  return { pageCount: document.numPages, pages };
}

function normalizedIdentity(value: string): string[] {
  return value.toUpperCase().replace(/\b(ESTATE|EST|OF|THE|DECEASED|DECEDENT)\b/g, " ").replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 1).sort();
}

export function identitiesMatch(left: string, right: string): boolean {
  const a = normalizedIdentity(left);
  const b = normalizedIdentity(right);
  if (!a.length || !b.length) return false;
  const common = a.filter((token) => b.includes(token));
  return common.length >= Math.min(2, a.length, b.length) && common.length / Math.max(a.length, b.length) >= 0.5;
}

export function obituaryIdentityMatches(subject: string, destination: string): boolean {
  const tokens = subject.toLowerCase().replace(/\b(estate|est|of|the|deceased|decedent)\b/g, " ").replace(/[^a-z0-9\s'-]/g, " ").split(/\s+/).filter((token) => token.length > 1);
  if (tokens.length < 2) return false;
  const haystack = ` ${destination.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ")} `;
  const phrases = [tokens, [...tokens].reverse(), [...tokens.slice(1), tokens[0]]].map((parts) => ` ${parts.join(" ")} `);
  return [...new Set(phrases)].some((phrase) => haystack.includes(phrase));
}

function fieldFromPages(pages: string[], labels: string[], limit = 240): { value: string; page: number; excerpt: string } | null {
  for (let index = 0; index < pages.length; index += 1) {
    for (const label of labels) {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const match = pages[index].match(new RegExp(`(?:^|\\n|\\b)${escaped}\\s*[:#-]?\\s*([^\\n]{1,${limit}})`, "i"));
      const value = match?.[1]?.replace(/\s+/g, " ").trim().replace(/\s+(?:date of death|dod|date of birth|dob|county|mailing address|property address|phone|email|report date|generated on|search criteria)\s*[:#-].*$/i, "");
      if (value) return { value: value.slice(0, limit), page: index + 1, excerpt: match![0].replace(/\s+/g, " ").trim().slice(0, 1000) };
    }
  }
  return null;
}

function allUnique(value: Iterable<string>, limit = 5): string[] {
  return [...new Set([...value].map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))].slice(0, limit);
}

function countyFromPages(pages: string[]): { value: string; page: number; excerpt: string } | null {
  for (let index = 0; index < pages.length; index += 1) {
    const match = pages[index].match(/\((MIAMI[- ]DADE)\)/i);
    if (match?.[1]) return { value: "Miami-Dade", page: index + 1, excerpt: match[0] };
  }
  return null;
}

export async function mapIdiPages(pages: string[], sourceSha256: string, retrievedAt: string): Promise<S46MappedDocument> {
  const fields = {
    owner: fieldFromPages(pages, ["decedent name", "subject name", "owner of record", "owner", "report result"]),
    dateOfBirth: fieldFromPages(pages, ["date of birth", "dob"]),
    dateOfDeath: fieldFromPages(pages, ["date of death", "dod"]),
    propertyAddress: fieldFromPages(pages, ["property address", "current address", "address"]),
    mailingAddress: fieldFromPages(pages, ["mailing address"]),
    folio: fieldFromPages(pages, ["folio", "parcel id", "parcel number"]),
    county: countyFromPages(pages) || fieldFromPages(pages, ["county"]),
  };
  const evidence: S46MappedDocument["evidence"] = {};
  for (const [key, match] of Object.entries(fields)) {
    if (!match) continue;
    evidence[key] = { source: "idi_core", page: match.page, retrievedAt, sha256: sourceSha256, excerpt: match.excerpt };
  }
  const heirs: S46Heir[] = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    const starts = [...page.matchAll(/(?:potential\s+heir|relative|associate|possible\s+relative)\b\s*[:#-]\s*([A-Z][A-Za-z .,'-]{2,90})/gi)];
    for (const start of starts) {
      const excerpt = page.slice(start.index || 0, (start.index || 0) + 2600);
      const name = start[1].replace(/\s+/g, " ").trim().replace(/\s+(?:age|born|phone|email|address)\b.*$/i, "");
      if (!name || /^(information|search|history|section|s\s+and\s+associates)$/i.test(name)) continue;
      const age = excerpt.match(/\bage\s*[:#-]?\s*(\d{1,3})\b/i)?.[1] || "";
      const email = excerpt.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0] || "";
      const phone = excerpt.match(/\b(?:\+?1[-. ]?)?(?:\(\d{3}\)|\d{3})[-. ]?\d{3}[-. ]?\d{4}\b/)?.[0] || "";
      const addresses = allUnique([...excerpt.matchAll(/\b\d{1,6}\s+[A-Za-z0-9 .,'#-]{2,90}\b(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Boulevard|Blvd|Place|Pl|Way|Terrace|Ter|Circle|Cir)\b(?:[ ,]+[A-Za-z .'-]+)?(?:[ ,]+(?:FL|Florida)\s+\d{5}(?:-\d{4})?)?/gi)].map((match) => match[0]), 5);
      const proof: S46Evidence = { source: "idi_contacts", page: pageIndex + 1, retrievedAt, sha256: sourceSha256, excerpt: excerpt.replace(/\s+/g, " ").trim().slice(0, 1200) };
      heirs.push({
        name,
        age,
        email,
        phone,
        addresses,
        evidence: {
          name: proof,
          ...(age ? { age: proof } : {}),
          ...(email ? { email: proof } : {}),
          ...(phone ? { phone: proof } : {}),
          ...(addresses.length ? { addresses: proof } : {}),
        },
      });
    }
  }
  const uniqueHeirs = [...new Map(heirs.map((heir) => [heir.name.toLowerCase().replace(/[^a-z0-9]/g, ""), heir])).values()];
  return {
    owner: fields.owner?.value.replace(/^report result\s*/i, "").replace(/\bshow alias\b.*$/i, "").replace(/\s+\(\d{1,3}\).*$/, "").trim() || "",
    dateOfBirth: fields.dateOfBirth?.value || "",
    dateOfDeath: fields.dateOfDeath?.value || "",
    obituaryUrl: "",
    propertyAddress: fields.propertyAddress?.value || "",
    mailingAddress: fields.mailingAddress?.value || "",
    folio: fields.folio?.value.replace(/\D/g, "") || "",
    county: fields.county?.value || "Miami-Dade",
    taxReceiptUrl: "",
    taxSummary: "",
    deedSummary: "",
    backStory: "",
    heirs: uniqueHeirs,
    evidence,
  };
}

export function applyVerifiedValue(document: S46MappedDocument, field: "owner" | "dateOfBirth" | "dateOfDeath" | "obituaryUrl", value: string, evidence: S46Evidence): void {
  const candidate = value.trim();
  if (!candidate) return;
  const current = document[field].trim();
  const parsedCurrent = field === "dateOfBirth" || field === "dateOfDeath" ? Date.parse(current) : Number.NaN;
  const parsedCandidate = field === "dateOfBirth" || field === "dateOfDeath" ? Date.parse(candidate) : Number.NaN;
  const same = field === "owner"
    ? identitiesMatch(current, candidate)
    : Number.isFinite(parsedCurrent) && Number.isFinite(parsedCandidate)
      ? new Date(parsedCurrent).toISOString().slice(0, 10) === new Date(parsedCandidate).toISOString().slice(0, 10)
      : current.replace(/\/+$/, "").toLowerCase() === candidate.replace(/\/+$/, "").toLowerCase();
  if (current && !same) throw new Error(`conflict:${field}`);
  document[field] = current || candidate;
  document.evidence[field] = document.evidence[field] || evidence;
}

export function publicMappingReceipt(document: S46MappedDocument): Record<string, unknown> {
  const field = (key: keyof S46MappedDocument, sourceKey = String(key)) => ({
    field: key,
    populated: Boolean(Array.isArray(document[key]) ? (document[key] as unknown[]).length : String(document[key] || "").trim()),
    evidenceSource: document.evidence[sourceKey]?.source || null,
    evidencePage: document.evidence[sourceKey]?.page || null,
    reason: document.evidence[sourceKey] ? null : "completed_check_no_supported_value",
  });
  return {
    version: 1,
    automatic: true,
    fields: ["owner", "dateOfBirth", "dateOfDeath", "obituaryUrl", "propertyAddress", "mailingAddress", "folio", "county", "taxReceiptUrl", "taxSummary", "deedSummary", "backStory"].map((key) => field(key as keyof S46MappedDocument)),
    heirs: document.heirs.map((heir, index) => ({
      index,
      cells: ["name", "age", "email", "phone", "addresses"].map((key) => ({ key, populated: Boolean(Array.isArray(heir[key as keyof S46Heir]) ? (heir[key as "addresses"] as string[]).length : String(heir[key as keyof S46Heir] || "")), evidenceSource: heir.evidence[key as keyof S46Heir["evidence"]]?.source || null })),
    })),
  };
}
