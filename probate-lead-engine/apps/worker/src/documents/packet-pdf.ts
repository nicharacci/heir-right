import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PacketLine, PacketModel } from "./packet-model";
import { CLOSING_FIELD_MAP, closingTemplateBytes } from "./closing-template-data";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 54;
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2);
const FOOTER_Y = 28;

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

function lineText(line: PacketLine): string {
  return line.label ? `${line.label}: ${line.value}` : line.value;
}

function pageHeader(page: PDFPage, regular: PDFFont, title: string, packetLabel: string): void {
  page.drawText("HEIRRIGHT", { x: MARGIN, y: PAGE_HEIGHT - 34, size: 9, font: regular, color: rgb(0.08, 0.28, 0.24) });
  page.drawText(ascii(packetLabel), { x: MARGIN, y: PAGE_HEIGHT - 48, size: 7.5, font: regular, color: rgb(0.42, 0.44, 0.43) });
  page.drawLine({ start: { x: MARGIN, y: PAGE_HEIGHT - 58 }, end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 58 }, thickness: 0.7, color: rgb(0.78, 0.8, 0.78) });
  if (title) page.drawText(ascii(title), { x: MARGIN, y: PAGE_HEIGHT - 82, size: 9, font: regular, color: rgb(0.2, 0.22, 0.21) });
}

function pageFooter(page: PDFPage, regular: PDFFont, pageNumber: number, generatedAt: string): void {
  page.drawLine({ start: { x: MARGIN, y: FOOTER_Y + 12 }, end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_Y + 12 }, thickness: 0.5, color: rgb(0.82, 0.83, 0.82) });
  page.drawText(`Generated ${ascii(generatedAt.slice(0, 10))} | Internal review packet`, { x: MARGIN, y: FOOTER_Y, size: 7, font: regular, color: rgb(0.46, 0.47, 0.46) });
  page.drawText(`Page ${pageNumber}`, { x: PAGE_WIDTH - MARGIN - 38, y: FOOTER_Y, size: 7, font: regular, color: rgb(0.46, 0.47, 0.46) });
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
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(model.title);
  pdf.setAuthor("HeirRight");
  pdf.setSubject(`${model.flow} document preparation packet`);
  pdf.setProducer("HeirRight deterministic packet service");
  pdf.setCreator("HeirRight");
  pdf.setCreationDate(new Date(model.generatedAt));

  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pageHeader(page, regular, "", model.flow === "discovery" ? "Discovery Prep" : "Closing Prep");
  let coverY = PAGE_HEIGHT - 138;
  for (const titleLine of wrap(model.title, bold, 22, CONTENT_WIDTH)) {
    page.drawText(titleLine, { x: MARGIN, y: coverY, size: 22, font: bold, color: rgb(0.07, 0.11, 0.1) });
    coverY -= 27;
  }
  page.drawText(`${model.estates.length} estate${model.estates.length === 1 ? "" : "s"} | ${model.sections.length} sections`, { x: MARGIN, y: coverY - 4, size: 10, font: regular, color: rgb(0.35, 0.38, 0.37) });
  coverY -= 54;
  page.drawText("TABLE OF CONTENTS", { x: MARGIN, y: coverY, size: 9, font: bold, color: rgb(0.08, 0.28, 0.24) });
  let y = coverY - 22;
  for (const estate of model.estates) {
    if (y < 84) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageHeader(page, regular, "Table of contents", model.flow === "discovery" ? "Discovery Prep" : "Closing Prep");
      y = PAGE_HEIGHT - 100;
    }
    for (const estateLine of wrap(estate.displayName, bold, 11, CONTENT_WIDTH)) {
      page.drawText(estateLine, { x: MARGIN, y, size: 11, font: bold, color: rgb(0.08, 0.1, 0.09) });
      y -= 14;
    }
    y -= 2;
    for (const section of estate.sections) {
      if (y < 64) break;
      page.drawText(ascii(section.title), { x: MARGIN + 12, y, size: 8.5, font: regular, color: rgb(0.3, 0.32, 0.31) });
      y -= 13;
    }
    y -= 10;
  }

  for (const [estateIndex, estate] of model.estates.entries()) {
    for (const [sectionIndex, section] of estate.sections.entries()) {
      page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      pageHeader(page, regular, estate.displayName, model.flow === "discovery" ? "Discovery Prep" : "Closing Prep");
      let cursor = PAGE_HEIGHT - 112;
      if (sectionIndex === 0) {
        page.drawText(`ESTATE ${estateIndex + 1} OF ${model.estates.length}`, { x: MARGIN, y: cursor, size: 8, font: bold, color: rgb(0.08, 0.28, 0.24) });
        cursor -= 20;
        page.drawText(ascii(estate.displayName), { x: MARGIN, y: cursor, size: 17, font: bold, color: rgb(0.07, 0.1, 0.09) });
        cursor -= 18;
        for (const addressLine of wrap(estate.propertyAddress, regular, 9, CONTENT_WIDTH)) {
          page.drawText(addressLine, { x: MARGIN, y: cursor, size: 9, font: regular, color: rgb(0.35, 0.37, 0.36) });
          cursor -= 12;
        }
        cursor -= 8;
      }
      page.drawText(ascii(section.title), { x: MARGIN, y: cursor, size: 15, font: bold, color: rgb(0.08, 0.28, 0.24) });
      cursor -= 24;

      const newContentPage = (): void => {
        page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        pageHeader(page, regular, `${estate.displayName} / ${section.title}`, model.flow === "discovery" ? "Discovery Prep" : "Closing Prep");
        cursor = PAGE_HEIGHT - 92;
      };

      for (const line of section.lines) {
        const text = lineText(line);
        const wrapped = wrap(text, line.label ? bold : regular, line.label ? 8.7 : 9, CONTENT_WIDTH - 8);
        const needed = (wrapped.length * 12) + 8;
        if (cursor - needed < FOOTER_Y + 28) newContentPage();
        const color = line.tone === "warning"
          ? rgb(0.52, 0.24, 0.08)
          : line.tone === "muted" ? rgb(0.43, 0.45, 0.44) : rgb(0.13, 0.15, 0.14);
        for (const [index, wrappedLine] of wrapped.entries()) {
          page.drawText(wrappedLine, {
            x: MARGIN + (index ? 8 : 0),
            y: cursor,
            size: line.label ? 8.7 : 9,
            font: index === 0 && line.label ? bold : regular,
            color,
          });
          cursor -= 12;
        }
        cursor -= 7;
      }

      if (section.sourceUrls.length) {
        if (cursor < 100) newContentPage();
        page.drawText("SOURCE LINKS", { x: MARGIN, y: cursor, size: 8, font: bold, color: rgb(0.08, 0.28, 0.24) });
        cursor -= 15;
        for (const url of section.sourceUrls) {
          for (const sourceLine of wrap(url, regular, 7.5, CONTENT_WIDTH - 8)) {
            if (cursor < FOOTER_Y + 28) newContentPage();
            page.drawText(sourceLine, { x: MARGIN + 8, y: cursor, size: 7.5, font: regular, color: rgb(0.12, 0.32, 0.47) });
            cursor -= 10;
          }
          cursor -= 3;
        }
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((item, index) => pageFooter(item, regular, index + 1, model.generatedAt));
  return pdf.save({ useObjectStreams: false });
}
