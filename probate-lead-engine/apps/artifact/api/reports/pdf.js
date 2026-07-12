const { requireApiAuth } = require("../_shared");

function pdfEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ");
}

function packetLines(query) {
  const title = query.get("title") || "HeirRight report packet";
  const address = query.get("address") || query.get("property") || "Selected estate";
  const owner = query.get("owner") || "Owner review";
  const dateAdded = query.get("dateAdded") || query.get("date") || new Date().toISOString().slice(0, 10);
  const status = query.get("status") || "Review packet";
  const source = query.get("source") || "HeirRight Leads";
  return [
    "HeirRight Leads",
    "Completed Report Packet",
    "",
    `Title: ${title}`,
    `Property: ${address}`,
    `Owner / Estate: ${owner}`,
    `Date Added: ${dateAdded}`,
    `Packet Status: ${status}`,
    `Source: ${source}`,
    "",
    "Internal draft - review required before outreach or offers.",
    "",
    "Included sections:",
    "- Discovery dossier",
    "- Completed lead report",
    "- Source notes",
    "- Deed and title notes",
    "- Tax history packet",
    "- Probate document request",
    "- Heir contact matrix",
    "- Outreach drafts and CRM handoff prep",
    "",
    "Notes and blockers are shown below the PDF viewport in the app.",
  ];
}

function buildPdf(lines) {
  const stream = [
    "BT",
    "/F1 18 Tf",
    "72 742 Td",
    `(${pdfEscape(lines[0])}) Tj`,
    "0 -26 Td",
    "/F1 14 Tf",
    `(${pdfEscape(lines[1])}) Tj`,
    "0 -28 Td",
    "/F1 10 Tf",
    ...lines.slice(2).map((line) => `0 -15 Td (${pdfEscape(line)}) Tj`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "binary");
}

module.exports = function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  try {
    const host = request.headers.host || "localhost";
    const query = new URL(request.url || "/api/reports/pdf", `https://${host}`).searchParams;
    const pdf = buildPdf(packetLines(query));
    response.statusCode = 200;
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", "inline; filename=\"heirright-report-packet.pdf\"");
    response.end(pdf);
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: "pdf_failed", message: error.message || "PDF render failed." }));
  }
};
