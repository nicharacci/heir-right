import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const legacyAppSource = readFileSync(new URL("../src/legacy/app.js", import.meta.url), "utf8");
const completedLeadReportSource = readFileSync(new URL("../../worker/src/documents/completed-lead-report.ts", import.meta.url), "utf8");

const safePreview = legacyAppSource.slice(
  legacyAppSource.indexOf("function safeDossierPreviewSrcdoc"),
  legacyAppSource.indexOf("function assetStepStatusHtml"),
);
assert.match(safePreview, /script, noscript, iframe, object, embed, base, form/);
assert.match(safePreview, /name\.startsWith\("on"\)/, "preview sanitizer must remove event-handler attributes");
assert.match(safePreview, /javascript\|vbscript/, "preview sanitizer must remove executable URL schemes");
assert.match(safePreview, /replace\(\/\[\\u0000-\\u0020\\u007f\]\+\/g, ""\)/, "preview sanitizer must normalize control characters that can disguise executable schemes");
assert.match(safePreview, /data:text\\\/html/, "preview sanitizer must remove executable HTML data URLs");

const popoutPreview = legacyAppSource.slice(
  legacyAppSource.indexOf("function popOutDossierDocument"),
  legacyAppSource.indexOf("function outreachTemplateSeed"),
);
assert.match(popoutPreview, /safeDossierPreviewSrcdoc\(doc\?\.body \?\? ""\)/, "pop-out must reuse the inert preview sanitizer");
assert.doesNotMatch(popoutPreview, /document\.write\(doc\.body\)/, "pop-out must never write raw packet HTML");
const openerIsolationIndex = popoutPreview.indexOf("popout.opener = null");
const safeWriteIndex = popoutPreview.indexOf("popout.document.write(safePreview)");
assert.ok(openerIsolationIndex >= 0, "pop-out must explicitly sever window.opener");
assert.ok(safeWriteIndex >= 0, "pop-out must write the sanitized preview");
assert.ok(
  openerIsolationIndex < safeWriteIndex,
  "pop-out must sever window.opener before writing sanitized report markup",
);

assert.match(completedLeadReportSource, /sourceUrl: safeSourceLinkUrl\(record\.sourceUrl\) \?\? ""/);
assert.match(completedLeadReportSource, /const obituaryLink = safeSourceLinkUrl/);
assert.match(completedLeadReportSource, /href="\$\{escapeHtml\(sourceUrl\)\}" target="_blank" rel="noreferrer noopener"/);

console.log(JSON.stringify({
  ok: true,
  checks: [
    "preview_scripts_and_event_handlers_removed",
    "preview_executable_urls_removed",
    "popout_writes_sanitized_html_only",
    "popout_opener_is_severed_before_write",
    "completed_report_source_urls_are_allowlisted",
  ],
}, null, 2));
