export interface IdiSourceLocator {
  kind: "page" | "row" | "paragraph" | "ocr" | "text";
  index: number;
  label: string;
  text?: string;
}

export interface IdiUploadExtraction {
  status: "extracted";
  method: "pdf_text" | "docx_text" | "csv_rows" | "google_drive_ocr" | "operator_paste";
  fileKind: "pdf" | "docx" | "csv" | "image" | "text";
  text: string;
  sourceLocators: IdiSourceLocator[];
  extractedAt: string;
}

export interface IdiUploadCandidate {
  id: string;
  name: string;
  relationship: string;
  group: "primary" | "alternative";
  phones: string[];
  emails: string[];
  currentAddress: string;
  addressHistory: string[];
  ownerLastNameMatch: boolean;
  confidence: number;
  confidenceReason: string;
  reviewStatus: "auto_accepted_high_confidence" | "needs_review";
  sourceLocator: Pick<IdiSourceLocator, "kind" | "index" | "label">;
}

export interface IdiReportSubjectMatch {
  matched: boolean;
  signals: Array<"owner" | "address" | "folio">;
  requiredSignals: Array<"owner" | "address" | "folio">;
  missingSignals: Array<"owner" | "address" | "folio">;
  reviewRequired: boolean;
}

function compact(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizedSubject(value: unknown): string {
  return compact(value)
    .toLowerCase()
    .replace(/\b(northwest)\b/g, "nw")
    .replace(/\b(northeast)\b/g, "ne")
    .replace(/\b(southwest)\b/g, "sw")
    .replace(/\b(southeast)\b/g, "se")
    .replace(/\b(north)\b/g, "n")
    .replace(/\b(south)\b/g, "s")
    .replace(/\b(east)\b/g, "e")
    .replace(/\b(west)\b/g, "w")
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/\b(\d+)(?:st|nd|rd|th)\b/g, "$1")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ownerSubjectTokens(value: unknown): string[] {
  const ignored = new Set([
    "est", "estate", "of", "the", "property", "owner", "report", "asset", "search", "idi", "core",
    "jr", "sr", "ii", "iii", "iv", "v",
  ]);
  return normalizedSubject(value).split(" ").filter((token) => token.length >= 1 && !ignored.has(token));
}

function containsTokenSequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  return haystack.some((_, start) => needle.every((token, offset) => haystack[start + offset] === token));
}

function delimitedCells(line: string): string[] {
  const delimiter = line.includes("\t") ? "\t" : line.includes("|") ? "|" : ",";
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      cells.push(compact(current));
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(compact(current));
  return cells;
}

function reportFieldContexts(value: unknown, labels: string[]): string[] {
  const labelSet = new Set(labels.map(normalizedSubject));
  const patternFor = (values: string[]) => values
    .slice()
    .sort((left, right) => right.length - left.length)
    .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+"))
    .join("|");
  const labelPattern = patternFor(labels);
  const boundaryPattern = patternFor([
    "property owner", "record owner", "owner", "subject name", "subject", "decedent", "estate name",
    "subject property", "property address", "subject address", "property", "address history", "address",
    "folio number", "folio no", "folio", "parcel number", "parcel no", "parcel id", "parcel",
    "possible relative", "relative", "associate", "spouse", "child", "son", "daughter", "contact",
    "relationship", "review status", "status", "phone", "email", "name",
  ]);
  const lines = String(value || "").split(/\r?\n/);
  const contexts: string[] = [];
  for (const line of lines) {
    const fieldPattern = new RegExp(`(?:^|\\s)(${labelPattern})\\s*[:#]\\s*`, "gi");
    let fieldMatch: RegExpExecArray | null;
    while ((fieldMatch = fieldPattern.exec(line)) !== null) {
      const valueStart = fieldPattern.lastIndex;
      const remainder = line.slice(valueStart);
      const nextField = new RegExp(`\\s+(?:${boundaryPattern})\\s*[:#]`, "i").exec(remainder);
      const context = compact(remainder.slice(0, nextField?.index ?? remainder.length));
      if (context && labelSet.has(normalizedSubject(fieldMatch[1]))) contexts.push(context);
      if (fieldPattern.lastIndex <= fieldMatch.index) fieldPattern.lastIndex = fieldMatch.index + 1;
    }
  }
  for (let headerIndex = 0; headerIndex < lines.length; headerIndex += 1) {
    const headerLine = lines[headerIndex];
    if (!/[\t|,]/.test(headerLine)) continue;
    const headers = delimitedCells(headerLine).map(normalizedSubject);
    const fieldIndexes = headers
      .map((header, index) => labelSet.has(header) ? index : -1)
      .filter((index) => index >= 0);
    if (!fieldIndexes.length) continue;
    for (let rowIndex = headerIndex + 1; rowIndex < lines.length; rowIndex += 1) {
      if (!compact(lines[rowIndex])) break;
      const cells = delimitedCells(lines[rowIndex]);
      for (const fieldIndex of fieldIndexes) {
        if (compact(cells[fieldIndex])) contexts.push(compact(cells[fieldIndex]));
      }
    }
  }
  return Array.from(new Set(contexts));
}

function reportStandaloneOwnerContexts(value: unknown): string[][] {
  const lines = String(value || "").split(/\r?\n/).map(compact).filter(Boolean).slice(0, 8);
  const boundary = lines.findIndex((line) => /^\s*(?:subject\s+property|property(?:\s+address)?|subject\s+address|address|folio|parcel)\s*[:#]/i.test(line));
  return (boundary >= 0 ? lines.slice(0, boundary) : lines)
    .filter((line) => !/^\s*(?:possible\s+relative|relative|associate|spouse|child|son|daughter|contact|phone|email|address\s+history)\s*[:#-]/i.test(line))
    .map((line) => line.split(/\b(?:subject\s+property|property\s+address|subject\s+address|property|address|folio|parcel)\s*[:#]/i)[0])
    .map(ownerSubjectTokens)
    .filter((tokens) => tokens.length > 0);
}

export function matchIdiReportSubject(input: {
  extraction: Pick<IdiUploadExtraction, "text">;
  ownerName?: string;
  propertyAddress?: string;
  parcelId?: string;
}): IdiReportSubjectMatch {
  const signals: IdiReportSubjectMatch["signals"] = [];
  const requiredSignals: IdiReportSubjectMatch["requiredSignals"] = [];
  const ownerTokens = ownerSubjectTokens(input.ownerName);
  const ownerFamilyName = ownerTokens.at(-1) || "";
  const reversedOwnerTokens = ownerTokens.length > 1
    ? [ownerFamilyName, ...ownerTokens.slice(0, -1)]
    : ownerTokens;
  const ownerContexts = reportFieldContexts(input.extraction.text, [
    "property owner", "record owner", "owner", "subject", "subject name", "decedent", "estate name",
  ]).map(ownerSubjectTokens);
  const standaloneOwnerContexts = ownerContexts.length ? [] : reportStandaloneOwnerContexts(input.extraction.text);
  if (ownerFamilyName && (ownerContexts.length || standaloneOwnerContexts.length)) {
    requiredSignals.push("owner");
    const matchesOwnerContext = (context: string[]) => ownerTokens.length === 1
      ? context.length === 1 && context[0] === ownerFamilyName
      : containsTokenSequence(context, ownerTokens)
        || containsTokenSequence(context, reversedOwnerTokens)
        || ownerTokens.every((token) => context.includes(token));
    const ownerMatches = ownerContexts.length
      ? ownerContexts.every(matchesOwnerContext)
      : standaloneOwnerContexts.some((context) => (
        context.length === ownerTokens.length
        && (context.every((token, index) => token === ownerTokens[index])
          || context.every((token, index) => token === reversedOwnerTokens[index]))
      ));
    if (ownerMatches) signals.push("owner");
  }
  const streetLine = compact(input.propertyAddress).split(",")[0] || "";
  const addressTokens = normalizedSubject(streetLine).split(" ").filter(Boolean);
  const houseNumber = addressTokens.find((token) => /^\d{1,8}$/.test(token));
  const streetTokens = addressTokens.filter((token) => token !== houseNumber);
  const addressContexts = reportFieldContexts(input.extraction.text, [
    "subject property", "property address", "subject address", "property",
  ]).map((context) => normalizedSubject(context).split(" ").filter(Boolean));
  if (houseNumber && streetTokens.length && addressContexts.length) {
    requiredSignals.push("address");
    if (addressContexts.every((context) => containsTokenSequence(context, addressTokens))) signals.push("address");
  }
  const folio = normalizedSubject(input.parcelId).replace(/\s+/g, "");
  const folioContexts = reportFieldContexts(input.extraction.text, [
    "folio", "folio number", "folio no", "parcel", "parcel id", "parcel number", "parcel no",
  ]).map((context) => normalizedSubject(context).replace(/\s+/g, ""));
  if (folio.length >= 6 && folioContexts.length) {
    requiredSignals.push("folio");
    if (folioContexts.every((context) => context === folio)) signals.push("folio");
  }
  const missingSignals = requiredSignals.filter((signal) => !signals.includes(signal));
  return {
    matched: signals.length >= 2 && missingSignals.length === 0,
    signals,
    requiredSignals,
    missingSignals,
    reviewRequired: missingSignals.length > 0 || signals.length < 2,
  };
}

function ownerLastName(value: unknown): string {
  return compact(value)
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)?.toLowerCase() || "";
}

function phones(text: string): string[] {
  return Array.from(new Set(text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g) || []));
}

function emails(text: string): string[] {
  return Array.from(new Set(text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || []));
}

function addresses(text: string): string[] {
  const matches = text.match(/\b\d{2,6}\s+[A-Z0-9 .'-]+,\s*[A-Z .'-]+,\s*[A-Z]{2}\s*\d{5}\b/gi) || [];
  return Array.from(new Set(matches.map(compact)));
}

function relationship(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(wife|husband|spouse)\b/.test(lower)) return "spouse";
  if (/\bdaughter\b/.test(lower)) return "daughter";
  if (/\bson\b/.test(lower)) return "son";
  if (/\b(child|children)\b/.test(lower)) return "child";
  if (/\b(parent|mother|father)\b/.test(lower)) return "parent";
  if (/\b(brother|sister|sibling)\b/.test(lower)) return "sibling";
  if (/\b(representative|personal representative|executor|administrator)\b/.test(lower)) return "representative";
  if (/\b(associate|neighbor)\b/.test(lower)) return "associate";
  return "relative";
}

function candidateName(text: string): string {
  const lines = text.split(/\n+/).map(compact).filter(Boolean);
  const csvName = lines
    .map((line) => line.match(/^\s*([A-Z][A-Za-z .'-]{2,}?)(?:\s*[,|]\s*)/)?.[1])
    .find((value) => value && !/^name$/i.test(value));
  if (csvName) return compact(csvName);
  const labeled = lines
    .map((line) => line.match(/(?:name|relative|associate|spouse|child|son|daughter|representative)\s*[:\-]\s*([A-Z][A-Z .'-]{2,}?)(?=\s*(?:(?:[-–—|,])\s*)?(?:phone|email|address|relationship|review\s+status|status)\s*[:\-]|\s*$)/i)?.[1])
    .find(Boolean);
  if (labeled) return compact(labeled);
  const heading = lines.find((line) => /^[0-9.)\s-]*[A-Z][A-Z .'-]{3,}$/.test(line) && !/\d{3}|\b(address|phone|email)\b/i.test(line));
  return heading ? compact(heading.replace(/^[0-9.)\s-]+/, "")) : "Unnamed contact";
}

function sourceBlocks(locator: IdiSourceLocator): string[] {
  const value = String(locator.text || "").trim();
  if (!value) return [];
  return value
    .split(/\n{2,}|(?=\n\s*(?:relative|associate|spouse|child|son|daughter|representative)\s*[:\-])/i)
    .map((block) => block.trim())
    .filter((block) => block.length > 8
      && !(/\bname\b/i.test(block) && /\b(relationship|phone|email|address)\b/i.test(block) && !phones(block).length && !emails(block).length)
      && (/\b(phone|email|address|relative|associate|spouse|child|son|daughter|representative)\b/i.test(block) || phones(block).length || emails(block).length));
}

function candidateFromBlock(
  block: string,
  owner: string,
  assetKey: string,
  ordinal: number,
  sourceLocator: IdiSourceLocator,
): IdiUploadCandidate {
  const name = candidateName(block);
  const relation = relationship(block);
  const foundPhones = phones(block);
  const foundEmails = emails(block);
  const foundAddresses = addresses(block);
  const sameLastName = Boolean(ownerLastName(owner) && ownerLastName(name) === ownerLastName(owner));
  const specificRelationship = ["spouse", "daughter", "son", "child", "parent", "sibling", "representative"].includes(relation);
  const contactSignal = Boolean(foundPhones.length || foundEmails.length || foundAddresses.length);
  const validName = name !== "Unnamed contact";
  const autoAccepted = validName && contactSignal && (specificRelationship || sameLastName);
  const score = Math.min(100,
    (validName ? 28 : 0)
    + (specificRelationship ? 30 : 0)
    + (sameLastName ? 20 : 0)
    + (foundPhones.length ? 12 : 0)
    + (foundEmails.length ? 10 : 0)
    + (foundAddresses.length ? 8 : 0),
  );
  const reasons = [
    validName ? "named contact" : "name needs review",
    specificRelationship ? `${relation} relationship` : sameLastName ? "matching family name" : "relationship needs review",
    contactSignal ? "contact or address signal" : "contact signal missing",
  ];
  return {
    id: `${assetKey}:idi:${ordinal}`,
    name,
    relationship: relation,
    group: specificRelationship ? "primary" : "alternative",
    phones: foundPhones,
    emails: foundEmails,
    currentAddress: foundAddresses[0] || "",
    addressHistory: foundAddresses,
    ownerLastNameMatch: sameLastName,
    confidence: score,
    confidenceReason: reasons.join("; "),
    reviewStatus: autoAccepted ? "auto_accepted_high_confidence" : "needs_review",
    sourceLocator: { kind: sourceLocator.kind, index: sourceLocator.index, label: sourceLocator.label },
  };
}

export function buildIdiUploadCandidates(input: {
  assetKey: string;
  ownerName: string;
  extraction: IdiUploadExtraction;
}): IdiUploadCandidate[] {
  const locators = input.extraction.sourceLocators.length
    ? input.extraction.sourceLocators.slice(0, 256)
    : [{ kind: "text" as const, index: 1, label: "Imported report", text: input.extraction.text }];
  const output: IdiUploadCandidate[] = [];
  const fingerprints = new Set<string>();
  for (const locator of locators) {
    for (const block of sourceBlocks(locator)) {
      if (output.length >= 256) return output;
      const candidate = candidateFromBlock(block, input.ownerName, input.assetKey, output.length + 1, locator);
      const fingerprint = `${candidate.name.toLowerCase()}\u0000${candidate.phones.join("|")}\u0000${candidate.emails.join("|")}`;
      if (fingerprints.has(fingerprint)) continue;
      fingerprints.add(fingerprint);
      output.push(candidate);
    }
  }
  return output;
}

export function safeIdiExtractionMetadata(extraction: IdiUploadExtraction): Omit<IdiUploadExtraction, "text" | "sourceLocators"> & {
  sourceLocators: Array<Pick<IdiSourceLocator, "kind" | "index" | "label">>;
  characterCount: number;
} {
  return {
    status: extraction.status,
    method: extraction.method,
    fileKind: extraction.fileKind,
    extractedAt: extraction.extractedAt,
    characterCount: extraction.text.length,
    sourceLocators: extraction.sourceLocators.map(({ kind, index, label }) => ({ kind, index, label })),
  };
}
