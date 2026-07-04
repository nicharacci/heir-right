import assert from "node:assert/strict";
import { discoverTaxCollectorReceipt, extractDateSignals, pickBestObituaryLink } from "../src/source-helpers.mjs";

const receipt = discoverTaxCollectorReceipt({
  listingUrl: "https://miamidade.county-taxes.test/listing/3031030000010",
  listingHtml: `
    <main>
      <a href="/account">Account</a>
      <a href="/receipts/2025-paid.pdf">Print receipt</a>
    </main>
  `,
});
assert.equal(receipt.mode, "listing_page_bottom_right");
assert.equal(receipt.receiptUrl, "https://miamidade.county-taxes.test/receipts/2025-paid.pdf");

const best = pickBestObituaryLink([
  { url: "https://example.com/profile", text: "social profile" },
  { url: "https://www.legacy.com/us/obituaries/example", text: "Example Owner obituary" },
]);
assert.equal(best.url, "https://www.legacy.com/us/obituaries/example");

const dates = extractDateSignals("Example Owner was born March 4, 1942. She passed away January 2, 2024 in Miami.");
assert.equal(dates.dateOfBirth, "March 4, 1942");
assert.equal(dates.dateOfDeath, "January 2, 2024");

console.log(JSON.stringify({ ok: true, checks: ["tax_receipt", "obituary_link", "date_signals"] }, null, 2));
