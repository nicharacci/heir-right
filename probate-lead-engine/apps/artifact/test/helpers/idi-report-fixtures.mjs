import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function storedZip(entries) {
  const localParts = [];
  const centralParts = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || "", "utf8");
    const checksum = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    centralParts.push(centralHeader, name);
    localOffset += localHeader.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localOffset, 16);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function docxEntries(paragraphs) {
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
  const relationships = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  const body = paragraphs
    .map((paragraph) => `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(paragraph)}</w:t></w:r></w:p>`)
    .join("");
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}<w:sectPr/></w:body>
</w:document>`;
  return [
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: relationships },
    { name: "word/document.xml", data: document },
  ];
}

async function searchableIdiPdf() {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const pages = [
    ["IDI Core Asset Report", "Estate of Alicia Rivera", "Property: 4410 Palm Avenue, Miami, FL 33133"],
    ["Possible relative: Mateo Rivera", "Phone: 305-555-0142", "Review status: operator confirmation required"],
  ];
  for (const lines of pages) {
    const page = document.addPage([612, 792]);
    page.drawText(lines[0], { x: 56, y: 720, size: 18, font, color: rgb(0.12, 0.12, 0.13) });
    lines.slice(1).forEach((line, index) => {
      page.drawText(line, { x: 56, y: 680 - index * 28, size: 12, font, color: rgb(0.18, 0.18, 0.2) });
    });
  }
  return Buffer.from(await document.save({ useObjectStreams: false }));
}

function searchableIdiDocx() {
  return storedZip(docxEntries([
    "IDI Core Asset Report - Estate of Alicia Rivera",
    "Property: 4410 Palm Avenue, Miami, FL 33133",
    "Possible relative: Mateo Rivera - Phone: 305-555-0142",
  ]));
}

function overComplexIdiDocx() {
  const entries = docxEntries(["This archive should be rejected before Mammoth reads it."]);
  for (let index = 0; index < 257; index += 1) {
    entries.push({ name: `word/media/complexity-${String(index).padStart(3, "0")}.bin`, data: Buffer.alloc(0) });
  }
  return storedZip(entries);
}

export { overComplexIdiDocx, searchableIdiDocx, searchableIdiPdf, storedZip };
