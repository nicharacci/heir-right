import { PDFDocument, PDFHexString, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { S46MappedDocument } from "./s46-core";

const WIDTH = 612;
const HEIGHT = 792;
const LEFT = 72;
const RIGHT = 540;

function printable(value: string): string {
  return String(value || "").normalize("NFKD").replace(/[^\x20-\x7E\n]/g, " ").replace(/[ \t]+/g, " ").trim();
}

function wrap(value: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of printable(value).split(/\n+/)) {
    const words = paragraph.split(/\s+/).filter(Boolean).flatMap((word) => {
      if (font.widthOfTextAtSize(word, size) <= width) return [word];
      const chunks: string[] = [];
      let chunk = "";
      for (const character of word) {
        const candidate = chunk + character;
        if (chunk && font.widthOfTextAtSize(candidate, size) > width) {
          chunks.push(chunk);
          chunk = character;
        } else chunk = candidate;
      }
      if (chunk) chunks.push(chunk);
      return chunks;
    });
    if (!words.length) { lines.push(""); continue; }
    let line = words.shift() || "";
    for (const word of words) {
      const candidate = `${line} ${word}`;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else { lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

function addLink(pdf: PDFDocument, page: PDFPage, url: string, x: number, y: number, width: number, height: number): void {
  if (!/^https:\/\//i.test(url)) return;
  const annotation = pdf.context.register(pdf.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, y, x + width, y + height], Border: [0, 0, 0],
    A: { Type: "Action", S: "URI", URI: PDFHexString.fromText(url) },
  }));
  page.node.addAnnot(annotation);
}

export async function renderS46DiscoveryPdf(input: S46MappedDocument, generatedAt = new Date().toISOString()): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  pdf.setTitle(`HeirRight Discovery - ${printable(input.owner)}`);
  pdf.setAuthor("HeirRight");
  pdf.setSubject("Verified Discovery Packet");
  pdf.setProducer("HeirRight S46 deterministic renderer");
  pdf.setCreationDate(new Date(generatedAt));

  let page = pdf.addPage([WIDTH, HEIGHT]);
  let y = 722;
  const newPage = (): void => { page = pdf.addPage([WIDTH, HEIGHT]); y = 724; };
  const ensure = (height: number): void => { if (y - height < 52) newPage(); };
  const heading = (value: string): void => {
    ensure(26);
    page.drawText(printable(value), { x: LEFT, y, size: 11, font: bold, color: rgb(0, 0, 0) });
    y -= 19;
  };
  const line = (label: string, value = "", options: { boldValue?: boolean; link?: string } = {}): void => {
    const safeValue = printable(value);
    const prefix = label ? `${label}:` : "";
    const prefixWidth = prefix ? bold.widthOfTextAtSize(prefix, 10.5) + 5 : 0;
    const available = RIGHT - LEFT - prefixWidth;
    const rows = safeValue ? wrap(safeValue, options.boldValue ? bold : regular, 10.5, available) : [""];
    ensure(Math.max(17, rows.length * 15));
    if (prefix) page.drawText(prefix, { x: LEFT, y, size: 10.5, font: bold, color: rgb(0, 0, 0) });
    rows.forEach((row, index) => {
      const x = index === 0 ? LEFT + prefixWidth : LEFT + prefixWidth;
      page.drawText(row, { x, y: y - (index * 15), size: 10.5, font: options.boldValue ? bold : regular, color: options.link ? rgb(0, 0.28, 0.72) : rgb(0, 0, 0) });
      if (options.link && row) {
        const rowWidth = (options.boldValue ? bold : regular).widthOfTextAtSize(row, 10.5);
        addLink(pdf, page, options.link, x, y - (index * 15) - 2, rowWidth, 13);
      }
    });
    y -= Math.max(17, rows.length * 15);
  };

  const owner = printable(input.owner).toUpperCase();
  const titleLines = wrap(owner, regular, 26, 430);
  titleLines.forEach((item) => { page.drawText(item, { x: (WIDTH - regular.widthOfTextAtSize(item, 26)) / 2, y, size: 26, font: regular, color: rgb(0, 0, 0) }); y -= 38; });
  const subtitle = "Family Tree";
  page.drawText(subtitle, { x: (WIDTH - regular.widthOfTextAtSize(subtitle, 22)) / 2, y, size: 22, font: regular, color: rgb(0, 0, 0) });
  y -= 28;
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "2-digit" }).format(new Date(generatedAt));
  page.drawText(`Date added: ${date}`, { x: (WIDTH - regular.widthOfTextAtSize(`Date added: ${date}`, 9)) / 2, y, size: 9, font: regular, color: rgb(0.2, 0.2, 0.2) });
  y -= 32;

  const propertyPrefix = "Property Address: ";
  page.drawText(propertyPrefix, { x: LEFT, y, size: 11, font: regular, color: rgb(0, 0, 0) });
  const propertyX = LEFT + regular.widthOfTextAtSize(propertyPrefix, 11);
  const propertyUrl = input.evidence.propertyAddress?.sourceUrl || "";
  page.drawText(printable(input.propertyAddress), { x: propertyX, y, size: 11, font: regular, color: propertyUrl ? rgb(0, 0.28, 0.72) : rgb(0, 0, 0) });
  if (propertyUrl) addLink(pdf, page, propertyUrl, propertyX, y - 2, regular.widthOfTextAtSize(printable(input.propertyAddress), 11), 14);
  y -= 12;

  const tableX = LEFT;
  const columns = [106, 115, 111];
  const tableWidth = columns.reduce((sum, width) => sum + width, 0);
  const rowHeight = 16.5;
  const rows = ["As-Is Value", "Taxes Due", "Liens", "Mortgages", "Selling Costs", "Probate Costs", "Partition Costs", "Post Equity Value", "Amount per heir $$", "# of heirs on board", "Profit", "Offer per heir", "", "", "", "Min Profit", "", "", ""];
  const drawCell = (value: string, x: number, width: number, baseline: number, font: PDFFont, size: number): void => {
    const safe = printable(value);
    page.drawText(safe, { x: x + Math.max(4, (width - font.widthOfTextAtSize(safe, size)) / 2), y: baseline, size, font, color: rgb(0, 0, 0) });
  };
  page.drawRectangle({ x: tableX, y: y - rowHeight, width: tableWidth, height: rowHeight, color: rgb(0.25, 0.66, 0.84), borderColor: rgb(0.05, 0.05, 0.05), borderWidth: 0.7 });
  drawCell("Offer/Profit", tableX, tableWidth, y - 11.8, bold, 11);
  y -= rowHeight;
  const labels = ["Description", "Percentage", "Total"];
  let x = tableX;
  labels.forEach((label, index) => {
    page.drawRectangle({ x, y: y - rowHeight, width: columns[index], height: rowHeight, borderColor: rgb(0.05, 0.05, 0.05), borderWidth: 0.7 });
    drawCell(label, x, columns[index], y - 11.8, bold, 11);
    x += columns[index];
  });
  y -= rowHeight;
  rows.forEach((label, rowIndex) => {
    x = tableX;
    const fill = label === "Min Profit" ? rgb(0.04, 0.67, 0.86) : rowIndex >= 16 ? rgb(1, 0.75, 0) : undefined;
    columns.forEach((width, index) => { page.drawRectangle({ x, y: y - rowHeight, width, height: rowHeight, ...(fill && index === 0 ? { color: fill } : {}), borderColor: rgb(0.05, 0.05, 0.05), borderWidth: 0.7 }); x += width; });
    if (label) drawCell(label, tableX, columns[0], y - 11.8, ["As-Is Value", "Post Equity Value", "Profit", "Min Profit"].includes(label) ? bold : regular, 11);
    y -= rowHeight;
  });
  y -= 22;
  line("Owner", owner, { boldValue: true });
  line("DOB", input.dateOfBirth);
  line("DOD", input.dateOfDeath);
  line("Obituary", input.obituaryUrl, input.obituaryUrl ? { link: input.obituaryUrl } : {});

  newPage();
  heading("Back Story");
  for (const paragraph of wrap(input.backStory, regular, 10.5, RIGHT - LEFT)) line("", paragraph);
  y -= 5;

  heading("Potential Heirs");
  if (!input.heirs.length) line("", "");
  input.heirs.forEach((heir, index) => {
    ensure(130);
    line(`${index + 1}. Name`, heir.name, { boldValue: true });
    line("Age", heir.age);
    line("Email", heir.email);
    line("Phone", heir.phone);
    const addresses = heir.addresses.slice(0, 5);
    for (let addressIndex = 0; addressIndex < 5; addressIndex += 1) line(`Address ${addressIndex + 1}`, addresses[addressIndex] || "");
    y -= 8;
  });

  y -= 10;
  heading("Property, Tax and Deed");
  line("Property", input.propertyAddress);
  line("Mailing Address", input.mailingAddress);
  line("Folio", input.folio);
  line("County", input.county);
  line("Tax Receipt", input.taxReceiptUrl, input.taxReceiptUrl ? { link: input.taxReceiptUrl } : {});
  line("Tax History", input.taxSummary);
  line("Latest Deed", input.deedSummary);

  return pdf.save({ useObjectStreams: false });
}
