import {
  PDFDocument,
  PDFHexString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";
import type { PacketAttachment, PacketModel, PacketSection } from "./packet-model";
import { CLOSING_FIELD_MAP, closingTemplateBytes } from "./closing-template-data";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);

function ascii(value: string): string {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E\n]/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const paragraphs = ascii(text).split(/\n+/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= width) return [word];
      const chunks: string[] = [];
      let chunk = "";
      for (const char of word) {
        if (chunk && font.widthOfTextAtSize(`${chunk}${char}`, size) > width) {
          chunks.push(chunk);
          chunk = char;
        } else {
          chunk += char;
        }
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    });
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = words.shift() || "";
    for (const word of words) {
      const next = `${current} ${word}`;
      if (font.widthOfTextAtSize(next, size) <= width) current = next;
      else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
}

function splitFirstLine(text: string, font: PDFFont, size: number, width: number): [string, string] {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  let first = "";
  while (words.length) {
    const candidate = first ? `${first} ${words[0]}` : words[0];
    if (first && font.widthOfTextAtSize(candidate, size) > width) break;
    first = candidate;
    words.shift();
  }
  return [first, words.join(" ")];
}

function safeUrl(value: string | undefined): string {
  const url = String(value || "").trim();
  return /^https?:\/\//i.test(url) || (url.startsWith("/") && !url.startsWith("//")) ? url : "";
}

function packetValue(value: string | undefined): string {
  return ascii(String(value || "Not confirmed").split(" | confidence ")[0] || "Not confirmed");
}

function sectionById(sections: PacketSection[], id: string): PacketSection | undefined {
  return sections.find((section) => section.id === id);
}

function sectionValue(section: PacketSection | undefined, label: string, fallback = "Not confirmed"): string {
  const line = section?.lines.find((item) => item.label?.toLowerCase() === label.toLowerCase());
  return packetValue(line?.value || fallback);
}

function annotationLink(
  pdf: PDFDocument,
  page: PDFPage,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const href = safeUrl(url);
  if (!href || width <= 0 || height <= 0) return;
  const annotation = pdf.context.register(pdf.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFHexString.fromText(href),
    },
  }));
  page.node.addAnnot(annotation);
}

function drawLinkedText(input: {
  pdf: PDFDocument;
  page: PDFPage;
  text: string;
  url: string;
  x: number;
  y: number;
  font: PDFFont;
  size: number;
}): number {
  const text = ascii(input.text);
  const width = input.font.widthOfTextAtSize(text, input.size);
  input.page.drawText(text, {
    x: input.x,
    y: input.y,
    size: input.size,
    font: input.font,
    color: rgb(0, 0.2, 0.8),
  });
  input.page.drawLine({
    start: { x: input.x, y: input.y - 1 },
    end: { x: input.x + width, y: input.y - 1 },
    thickness: 0.45,
    color: rgb(0, 0.2, 0.8),
  });
  annotationLink(input.pdf, input.page, input.url, input.x, input.y - 2, width, input.size + 3);
  return width;
}

function centeredX(text: string, font: PDFFont, size: number): number {
  return Math.max(MARGIN, (PAGE_WIDTH - font.widthOfTextAtSize(ascii(text), size)) / 2);
}

function drawCenteredCellText(
  page: PDFPage,
  text: string,
  x: number,
  width: number,
  y: number,
  font: PDFFont,
  size: number,
): void {
  const value = ascii(text);
  page.drawText(value, {
    x: x + Math.max(4, (width - font.widthOfTextAtSize(value, size)) / 2),
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

function friendlyDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return ascii(value.slice(0, 10));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  }).format(parsed);
}

function matchingAttachment(section: PacketSection | undefined, pattern: RegExp): PacketAttachment | undefined {
  return section?.attachments?.find((attachment) => (
    pattern.test(attachment.label)
    || pattern.test(attachment.fileName || "")
    || pattern.test(attachment.url)
  ));
}

function drawOfferProfitTable(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  section: PacketSection | undefined,
  startY: number,
): number {
  const left = 72;
  const width = 332;
  const columns = [106, 115, 111];
  const rowHeight = 16.5;
  const rows = [
    "As-Is Value",
    "Taxes Due",
    "Liens",
    "Mortgages",
    "Selling Costs",
    "Probate Costs",
    "Partition Costs",
    "Post Equity Value",
    "Amount per heir $$",
    "# of heirs on board",
    "Profit",
    "Offer per heir",
    "",
    "",
    "",
    "Min Profit",
    "$100,000 Net",
    "",
    "",
  ];
  const normalizedLabel = (value: string): string => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  const values = new Map((section?.lines || []).map((line) => [normalizedLabel(String(line.label || "")), packetValue(line.value)]));
  const valueFor = (...labels: string[]): string => labels
    .map((label) => values.get(normalizedLabel(label)) || "")
    .find(Boolean) || "";
  let y = startY;
  page.drawRectangle({ x: left, y: y - rowHeight, width, height: rowHeight, color: rgb(0.25, 0.66, 0.84), borderWidth: 0.7, borderColor: rgb(0.05, 0.05, 0.05) });
  const heading = "Offer/Profit";
  drawCenteredCellText(page, heading, left, width, y - 11.8, bold, 11);
  y -= rowHeight;
  const headerLabels = ["Description", "Percentage", "Total"];
  let x = left;
  headerLabels.forEach((label, index) => {
    page.drawRectangle({ x, y: y - rowHeight, width: columns[index], height: rowHeight, borderWidth: 0.7, borderColor: rgb(0.05, 0.05, 0.05) });
    drawCenteredCellText(page, label, x, columns[index], y - 11.8, bold, 11);
    x += columns[index];
  });
  y -= rowHeight;
  rows.forEach((label, rowIndex) => {
    const fill = label === "Min Profit"
      ? rgb(0.04, 0.67, 0.86)
      : rowIndex >= rows.length - 3
        ? rgb(1, 0.75, 0)
        : undefined;
    x = left;
    columns.forEach((column, index) => {
      page.drawRectangle({
        x,
        y: y - rowHeight,
        width: column,
        height: rowHeight,
        ...(fill && index === 0 ? { color: fill } : {}),
        borderWidth: 0.7,
        borderColor: rgb(0.05, 0.05, 0.05),
      });
      x += column;
    });
    if (label) {
      const labelFont = ["As-Is Value", "Post Equity Value", "Profit", "Min Profit"].includes(label) ? bold : regular;
      drawCenteredCellText(page, label, left, columns[0], y - 11.8, labelFont, 11);
      const value = label === "Post Equity Value"
        ? valueFor("Post-equity value", "Post equity value")
        : label === "Amount per heir $$"
          ? valueFor("Equity per heir", "Amount per heir")
          : label === "# of heirs on board"
            ? valueFor("Number of heirs", "Heir count")
            : label === "Profit"
              ? valueFor("Estimated profit", "Profit")
              : label === "Offer per heir"
                ? valueFor("Offer amount", "Offer per heir")
                : label === "Min Profit"
                  ? valueFor("Minimum net profit", "Min profit")
                  : valueFor(label);
      const percentage = label === "Offer per heir" ? valueFor("Buy percentage") : "";
      const total = value;
      if (percentage) drawCenteredCellText(page, percentage, left + columns[0], columns[1], y - 11.8, regular, 10);
      if (total && total !== "Not confirmed") drawCenteredCellText(page, total.slice(0, 24), left + columns[0] + columns[1], columns[2], y - 11.8, regular, 10);
    }
    y -= rowHeight;
  });
  return y;
}

async function renderDiscoveryPacketPdf(model: PacketModel): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(model.title);
  pdf.setAuthor("HeirRight");
  pdf.setSubject("HeirRight estate discovery document package");
  pdf.setProducer("HeirRight deterministic example-format renderer");
  pdf.setCreator("HeirRight");
  pdf.setCreationDate(new Date(model.generatedAt));

  const addPage = (): PDFPage => pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const drawSection = (estateName: string, section: PacketSection): void => {
    let page = addPage();
    let cursor = PAGE_HEIGHT - 66;
    const newPage = (): void => {
      page = addPage();
      cursor = PAGE_HEIGHT - 66;
    };
    for (const titleLine of wrap(section.title, bold, 15, CONTENT_WIDTH)) {
      page.drawText(titleLine, { x: MARGIN, y: cursor, size: 15, font: bold, color: rgb(0, 0, 0) });
      cursor -= 20;
    }
    page.drawText(ascii(estateName), { x: MARGIN, y: cursor, size: 9, font: regular, color: rgb(0.24, 0.24, 0.24) });
    cursor -= 25;
    for (const line of section.lines) {
      const label = line.label ? `${line.label}: ` : "";
      const text = `${label}${packetValue(line.value)}`;
      const lines = wrap(text, line.label ? bold : regular, 9.5, CONTENT_WIDTH);
      if (cursor - (lines.length * 13) < 62) newPage();
      lines.forEach((wrappedLine, index) => {
        page.drawText(wrappedLine, {
          x: MARGIN + (index ? 8 : 0),
          y: cursor,
          size: 9.5,
          font: index === 0 && line.label ? bold : regular,
          color: line.tone === "warning" ? rgb(0.48, 0.22, 0.05) : rgb(0, 0, 0),
        });
        cursor -= 13;
      });
      cursor -= 5;
    }
    const storedAttachments = section.attachments || [];
    const links: PacketAttachment[] = storedAttachments.length
      ? storedAttachments
      : section.sourceUrls.map((url, index): PacketAttachment => ({
        id: `source-${index}`,
        label: `Source ${index + 1}`,
        url,
        source: "document_packet" as const,
        fileKind: "link" as const,
        reviewFlags: [],
      }));
    if (links.length) {
      if (cursor < 110) newPage();
      page.drawText("Evidence", { x: MARGIN, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
      cursor -= 18;
      for (const link of links) {
        const label = ascii(link.label || link.fileName || "Source evidence");
        const wrapped = wrap(label, regular, 9, CONTENT_WIDTH - 16);
        if (cursor - (wrapped.length * 12) < 62) newPage();
        wrapped.forEach((item, index) => {
          if (index === 0) drawLinkedText({ pdf, page, text: item, url: link.url, x: MARGIN + 8, y: cursor, font: regular, size: 9 });
          else page.drawText(item, { x: MARGIN + 16, y: cursor, size: 9, font: regular, color: rgb(0, 0.2, 0.8) });
          cursor -= 12;
        });
        cursor -= 3;
      }
    }
  };

  for (const estate of model.estates) {
    const sections = estate.sections;
    const summary = sectionById(sections, "estate-summary");
    const offer = sectionById(sections, "offer-profit");
    const vital = sectionById(sections, "vital-records");
    const backstory = sectionById(sections, "backstory");
    const contacts = sectionById(sections, "family-contacts");
    const familyTreeFormat = Boolean(summary && (offer || backstory || contacts));

    if (familyTreeFormat) {
      let page = addPage();
      const addressSuffix = ` - ${estate.propertyAddress}`.toLowerCase();
      const displayName = estate.displayName.toLowerCase().endsWith(addressSuffix)
        ? estate.displayName.slice(0, estate.displayName.length - addressSuffix.length)
        : estate.displayName;
      const title = ascii(displayName).toUpperCase();
      const titleLines = wrap(title, regular, 26, 430);
      let cursor = 695.6;
      for (const titleLine of titleLines) {
        page.drawText(titleLine, { x: centeredX(titleLine, regular, 26), y: cursor, size: 26, font: regular, color: rgb(0, 0, 0) });
        cursor -= 44.2;
      }
      const subtitle = "Family Tree";
      page.drawText(subtitle, { x: centeredX(subtitle, regular, 26), y: cursor, size: 26, font: regular, color: rgb(0, 0, 0) });
      cursor -= 29.3;
      const date = `Date added: ${friendlyDate(model.generatedAt)}`;
      page.drawText(date, { x: centeredX(date, regular, 10), y: cursor, size: 10, font: regular, color: rgb(0, 0, 0) });
      cursor -= 40.2;

      const propertyPrefix = "Property Address: ";
      const propertyLink = matchingAttachment(summary, /property|appraiser|parcel/i) || summary?.attachments?.[0];
      page.drawText(propertyPrefix, { x: 72, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
      const propertyX = 72 + regular.widthOfTextAtSize(propertyPrefix, 11);
      if (propertyLink) drawLinkedText({ pdf, page, text: estate.propertyAddress, url: propertyLink.url, x: propertyX, y: cursor, font: regular, size: 11 });
      else page.drawText(ascii(estate.propertyAddress), { x: propertyX, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
      cursor -= 9.6;
      if (offer) cursor = drawOfferProfitTable(page, regular, bold, offer, cursor);
      else cursor -= 12;
      cursor -= 25.3;

      const owner = ascii(sectionValue(summary, "Owner of record", estate.displayName)).toUpperCase();
      const ownerLabel = "Owner:";
      page.drawText(ownerLabel, { x: 72, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
      page.drawText(owner, { x: 72 + bold.widthOfTextAtSize(ownerLabel, 11) + 4, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
      cursor -= 17.5;
      page.drawText(`DOB: ${sectionValue(vital, "Date of birth", "Needs review")}`, { x: 72, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
      cursor -= 17.5;
      page.drawText(`DOD: ${sectionValue(vital, "Date of death", "Needs review")}`, { x: 72, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
      cursor -= 17.5;
      const obituary = matchingAttachment(vital, /obituar|eulogy|memorial/i)
        || matchingAttachment(backstory, /obituar|eulogy|memorial/i);
      if (obituary) {
        const obituaryWidth = drawLinkedText({ pdf, page, text: "Obituary", url: obituary.url, x: 72, y: cursor, font: regular, size: 11 });
        page.drawText(" - ", { x: 72 + obituaryWidth, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
        drawLinkedText({ pdf, page, text: obituary.label || "Source", url: obituary.url, x: 80 + obituaryWidth, y: cursor, font: regular, size: 11 });
      } else {
        page.drawText("Obituary - Needs review", { x: 72, y: cursor, size: 11, font: regular, color: rgb(0.48, 0.22, 0.05) });
      }

      if (backstory || contacts) {
        page = addPage();
        cursor = 718;
        const familyLeft = 72;
        const familyWidth = 468;
        const familyLineHeight = 17.5;
        const ensureFamilySpace = (height: number): void => {
          if (cursor - height >= 54) return;
          page = addPage();
          cursor = 718;
        };
        const drawFamilyText = (text: string, options: {
          font?: PDFFont;
          size?: number;
          color?: ReturnType<typeof rgb>;
          indent?: number;
        } = {}): void => {
          const font = options.font || regular;
          const size = options.size || 11;
          const indent = options.indent || 0;
          const lines = wrap(text, font, size, familyWidth - indent);
          ensureFamilySpace(lines.length * familyLineHeight);
          for (const item of lines) {
            page.drawText(item, {
              x: familyLeft + indent,
              y: cursor,
              size,
              font,
              color: options.color || rgb(0, 0, 0),
            });
            cursor -= familyLineHeight;
          }
        };
        const storyParagraphs = backstory
          ? backstory.lines.flatMap((line) => (
            packetValue(line.value).split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
          ))
          : [];
        storyParagraphs.forEach((paragraph, paragraphIndex) => {
          ensureFamilySpace(42);
          if (paragraphIndex === 0) {
            const heading = "Back Story:";
            const headingWidth = bold.widthOfTextAtSize(heading, 11);
            const [firstLine, remainder] = splitFirstLine(paragraph, regular, 11, familyWidth - headingWidth - 4);
            page.drawText(heading, { x: familyLeft, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
            page.drawText(firstLine, { x: familyLeft + headingWidth + 4, y: cursor, size: 11, font: regular, color: rgb(0, 0, 0) });
            cursor -= familyLineHeight;
            if (remainder) drawFamilyText(remainder);
          } else {
            drawFamilyText(paragraph);
          }
          cursor -= 10;
        });
        if (backstory?.attachments?.length) {
          ensureFamilySpace(42);
          page.drawText("Back Story evidence:", { x: familyLeft, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
          cursor -= familyLineHeight;
          for (const attachment of backstory.attachments) {
            ensureFamilySpace(familyLineHeight);
            drawLinkedText({ pdf, page, text: attachment.label, url: attachment.url, x: familyLeft + 10, y: cursor, font: regular, size: 10 });
            cursor -= familyLineHeight;
          }
          cursor -= 10;
        }

        if (contacts) {
          // Keep the section heading with at least one normal contact block.
          ensureFamilySpace(262);
          page.drawText("Heirs:", { x: familyLeft, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
          cursor -= familyLineHeight;
          for (const line of contacts.lines) {
            const label = String(line.label || "");
            const value = packetValue(line.value);
            const contactMatch = label.match(/^Contact\s+(\d+)/i);
            if (contactMatch) {
              cursor -= 5;
              // Keep the opening identity, address history, phone, and email
              // together for the common one-to-two-address contact profile.
              // Longer profiles can still paginate within the block, but a
              // normal contact must never strand phone/email on its own page.
              ensureFamilySpace(210);
              const parts = value.split(/\s+\|\s+/);
              const name = parts[0] || `Possible heir ${contactMatch[1]}`;
              const relationship = parts.find((part) => /^relationship\s+/i.test(part))?.replace(/^relationship\s+/i, "");
              const interest = parts.find((part) => /^interest\s+/i.test(part))?.replace(/^interest\s+/i, "");
              const age = parts.find((part) => /^age\s+/i.test(part))?.replace(/^age\s+/i, "");
              const relationshipCopy = [relationship, interest].filter(Boolean).join(" - ");
              drawFamilyText(`${contactMatch[1]}. ${name.toUpperCase()}${relationshipCopy ? ` (${relationshipCopy})` : ""}`, { font: bold });
              if (age) drawFamilyText(`(${age})`);
              continue;
            }
            if (/^Likely Current Address$/i.test(label)) {
              ensureFamilySpace(familyLineHeight * 2);
              drawFamilyText(`Likely Current Address: ${value}`);
              cursor -= 10;
              continue;
            }
            if (/^Address \(County\/Parish\/Borough\) History$/i.test(label)) {
              ensureFamilySpace(familyLineHeight * 2);
              drawFamilyText(`${label}:`, { font: bold });
              value.split(/\n+/).filter(Boolean).forEach((item) => drawFamilyText(item));
              cursor -= 7;
              continue;
            }
            if (/^Phone number$/i.test(label)) {
              ensureFamilySpace(familyLineHeight * 2);
              drawFamilyText("Phone number:", { font: bold });
              value.split(/\n+/).filter(Boolean).forEach((item) => drawFamilyText(item));
              continue;
            }
            if (/^Email Address$/i.test(label)) {
              const emails = value.split(/\n+/).filter(Boolean);
              ensureFamilySpace(familyLineHeight * Math.max(1, emails.length));
              const emailHeading = "Email Address:";
              const emailHeadingWidth = bold.widthOfTextAtSize(emailHeading, 11);
              page.drawText(emailHeading, { x: familyLeft, y: cursor, size: 11, font: bold, color: rgb(0, 0, 0) });
              if (emails[0]) {
                page.drawText(emails[0], { x: familyLeft + emailHeadingWidth + 4, y: cursor, size: 11, font: regular, color: rgb(0, 0.35, 0.82) });
              }
              cursor -= familyLineHeight;
              emails.slice(1).forEach((item) => drawFamilyText(item, { color: rgb(0, 0.35, 0.82) }));
              continue;
            }
            if (/^Review$/i.test(label)) {
              // Review gates remain in the operator packet. The separated
              // completed report is a client-facing family-tree document and
              // must not leak internal workflow language or create an orphaned
              // review-only page.
              continue;
            }
            drawFamilyText(`${label ? `${label}: ` : ""}${value}`);
          }
        }
      }

      for (const section of sections) {
        if (["estate-summary", "offer-profit", "vital-records", "backstory", "family-contacts"].includes(section.id)) continue;
        drawSection(estate.displayName, section);
      }
      if (vital && !backstory) drawSection(estate.displayName, vital);
      continue;
    }

    for (const section of sections) drawSection(estate.displayName, section);
  }

  return pdf.save({ useObjectStreams: false });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function fittedText(value: string, font: PDFFont, preferred: number, width: number, height: number): { size: number; lines: string[] } | null {
  let size = Math.min(preferred, Math.max(5.5, height * 0.7));
  while (size >= 5.5) {
    const lines = wrap(value, font, size, width);
    const maxLines = Math.max(1, Math.floor(height / (size + 1)));
    if (lines.length <= maxLines) return { size, lines };
    size -= 0.25;
  }
  return null;
}

async function renderClosingPacketPdf(model: PacketModel): Promise<Uint8Array> {
  if (!model.closingTemplate) throw new Error("closing_template_metadata_missing");
  const templateBytes = closingTemplateBytes();
  const templateBuffer = templateBytes.buffer.slice(
    templateBytes.byteOffset,
    templateBytes.byteOffset + templateBytes.byteLength,
  ) as ArrayBuffer;
  const templateHash = hex(await crypto.subtle.digest("SHA-256", templateBuffer));
  if (templateHash !== CLOSING_FIELD_MAP.templateHash || templateHash !== model.closingTemplate.templateHash) {
    throw new Error("closing_template_integrity_failed");
  }
  const source = await PDFDocument.load(templateBytes);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(model.title);
  pdf.setAuthor("HeirRight");
  pdf.setSubject("Closing Prep legal-template packet");
  pdf.setProducer("HeirRight deterministic template-fill service");
  pdf.setCreator("HeirRight");
  pdf.setCreationDate(new Date(model.generatedAt));

  let cover = pdf.addPage([596, 842]);
  cover.drawText("HEIRRIGHT", { x: 48, y: 800, size: 10, font: bold, color: rgb(0.08, 0.28, 0.24) });
  cover.drawText("Closing Prep", { x: 48, y: 784, size: 8, font: regular, color: rgb(0.42, 0.44, 0.43) });
  cover.drawLine({ start: { x: 48, y: 772 }, end: { x: 548, y: 772 }, thickness: 0.7, color: rgb(0.78, 0.8, 0.78) });
  let y = 720;
  for (const titleLine of wrap(model.title, bold, 22, 500)) {
    cover.drawText(titleLine, { x: 48, y, size: 22, font: bold, color: rgb(0.07, 0.11, 0.1) });
    y -= 27;
  }
  cover.drawText(`${model.estates.length} estate${model.estates.length === 1 ? "" : "s"} | ${model.sections.length} selected form${model.sections.length === 1 ? "" : "s"}`, { x: 48, y: y - 3, size: 10, font: regular, color: rgb(0.35, 0.38, 0.37) });
  y -= 48;
  cover.drawText("PACKET CONTENTS", { x: 48, y, size: 9, font: bold, color: rgb(0.08, 0.28, 0.24) });
  y -= 20;
  const continueContents = (estateName = ""): void => {
    cover = pdf.addPage([596, 842]);
    cover.drawText("HEIRRIGHT", { x: 48, y: 800, size: 10, font: bold, color: rgb(0.08, 0.28, 0.24) });
    cover.drawText("Packet contents (continued)", { x: 48, y: 784, size: 8, font: regular, color: rgb(0.42, 0.44, 0.43) });
    cover.drawLine({ start: { x: 48, y: 772 }, end: { x: 548, y: 772 }, thickness: 0.7, color: rgb(0.78, 0.8, 0.78) });
    y = 744;
    if (estateName) {
      cover.drawText(ascii(estateName), { x: 48, y, size: 11, font: bold, color: rgb(0.08, 0.1, 0.09) });
      y -= 18;
    }
  };
  for (const estate of model.estates) {
    if (y < 70) continueContents();
    cover.drawText(ascii(estate.displayName), { x: 48, y, size: 11, font: bold, color: rgb(0.08, 0.1, 0.09) });
    y -= 15;
    for (const section of estate.sections) {
      if (y < 54) continueContents(estate.displayName);
      cover.drawText(ascii(section.title), { x: 62, y, size: 8.5, font: regular, color: rgb(0.3, 0.32, 0.31) });
      y -= 12;
    }
    y -= 8;
  }
  cover.drawText(`Template ${model.closingTemplate.templateId} | hash ${model.closingTemplate.templateHash.slice(0, 16)}`, { x: 48, y: 32, size: 7, font: regular, color: rgb(0.46, 0.47, 0.46) });

  const forms = new Map<string, (typeof CLOSING_FIELD_MAP.forms)[number]>(CLOSING_FIELD_MAP.forms.map((form) => [form.id, form]));
  const placements = CLOSING_FIELD_MAP.fields as unknown as Record<string, ReadonlyArray<{
    page: number;
    rect: readonly [number, number, number, number];
    fontSize: number;
  }>>;
  for (const [estateIndex, estate] of model.estates.entries()) {
    const closing = estate.closing;
    if (!closing) throw new Error("closing_estate_metadata_missing");
    if (model.estates.length > 1) {
      const divider = pdf.addPage([596, 842]);
      divider.drawText(`ESTATE ${estateIndex + 1} OF ${model.estates.length}`, { x: 48, y: 760, size: 9, font: bold, color: rgb(0.08, 0.28, 0.24) });
      divider.drawText(ascii(estate.displayName), { x: 48, y: 720, size: 20, font: bold, color: rgb(0.07, 0.1, 0.09) });
      let addressY = 694;
      for (const line of wrap(estate.propertyAddress, regular, 10, 500)) {
        divider.drawText(line, { x: 48, y: addressY, size: 10, font: regular, color: rgb(0.35, 0.37, 0.36) });
        addressY -= 13;
      }
    }
    for (const templateId of closing.templateIds) {
      const form = forms.get(templateId);
      if (!form) throw new Error(`closing_template_unknown:${templateId}`);
      const copied = await pdf.copyPages(source, [...form.pages]);
      const copiedBySourcePage = new Map<number, PDFPage>();
      copied.forEach((page, index) => {
        pdf.addPage(page);
        copiedBySourcePage.set(form.pages[index], page);
      });
      for (const [field, value] of Object.entries(closing.fields)) {
        if (!value) continue;
        for (const placement of placements[field] ?? []) {
          const page = copiedBySourcePage.get(placement.page);
          if (!page) continue;
          const [x, top, width, height] = placement.rect;
          const fitted = fittedText(value, regular, placement.fontSize, width, height);
          if (!fitted) throw new Error(`closing_field_overflow:${field}:${placement.page}`);
          fitted.lines.forEach((line, index) => {
            page.drawText(line, {
              x,
              y: page.getHeight() - top - fitted.size - (index * (fitted.size + 1)),
              size: fitted.size,
              font: regular,
              color: rgb(0.02, 0.02, 0.02),
            });
          });
        }
      }
    }
  }
  return pdf.save({ useObjectStreams: false });
}

export async function renderPacketPdf(model: PacketModel): Promise<Uint8Array> {
  if (model.flow === "closing-docs") return renderClosingPacketPdf(model);
  return renderDiscoveryPacketPdf(model);
}
