import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { PacketLine, PacketModel } from "./packet-model";

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

export async function renderPacketPdf(model: PacketModel): Promise<Uint8Array> {
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
