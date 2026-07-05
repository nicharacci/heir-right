import assert from "node:assert/strict";
import { discoverTaxCollectorReceipt, extractDateSignals, pickBestObituaryLink } from "../src/source-helpers.mjs";

const receipt = discoverTaxCollectorReceipt({
  listingUrl: "https://miamidade.county-taxes.test/listing/3031030000010",
  listingHtml: `
    <main>
      <a href="/account">Account</a>
      <aside style="float:right">
        <a class="receipt-link" href="/receipts/2025-paid.pdf">Print receipt</a>
      </aside>
    </main>
    <footer><a href="/payments/history">Payment history</a></footer>
  `,
});
assert.equal(receipt.mode, "listing_page_bottom_right");
assert.equal(receipt.receiptUrl, "https://miamidade.county-taxes.test/receipts/2025-paid.pdf");

const noReceipt = discoverTaxCollectorReceipt({
  listingUrl: "https://www.browserbase.com/navigation-blocked",
  listingHtml: `
    <main>
      <a href="https://x.com/browserbase">Twitter</a>
      <a href="https://www.instagram.com/browserbase">Instagram</a>
      <a href="/account">Account</a>
      <a href="/services/local-business-tax-receipt">Local Business Tax Receipt</a>
    </main>
  `,
});
assert.equal(noReceipt, null);

const best = pickBestObituaryLink([
  { url: "https://example.com/profile", text: "social profile" },
  { url: "https://www.dignitymemorial.com/funeral-homes", text: "Find Funeral Homes, Cremation Providers or Cemeteries" },
  { url: "https://www.legacy.com/us/obituaries/example", text: "Example Owner obituary" },
]);
assert.equal(best.url, "https://www.legacy.com/us/obituaries/example");

const dignityBest = pickBestObituaryLink([
  { url: "https://www.dignitymemorial.com/funeral-homes", text: "Find Funeral Homes, Cremation Providers or Cemeteries" },
  { url: "https://www.dignitymemorial.com/obituaries/miami-fl/annie-hawkins-6021574", text: "Annie Hawkins Obituary" },
]);
assert.equal(dignityBest.url, "https://www.dignitymemorial.com/obituaries/miami-fl/annie-hawkins-6021574");

const dates = extractDateSignals("Example Owner was born March 4, 1942. She passed away January 2, 2024 in Miami.");
assert.equal(dates.dateOfBirth, "March 4, 1942");
assert.equal(dates.dateOfDeath, "January 2, 2024");

const uppercaseRangeDates = extractDateSignals("OBITUARY Annie F. Hawkins FEBRUARY 7, 1937 - JUNE 23, 2014 IN THE CARE OF");
assert.equal(uppercaseRangeDates.dateOfBirth, "February 7, 1937");
assert.equal(uppercaseRangeDates.dateOfDeath, "June 23, 2014");

console.log(JSON.stringify({ ok: true, checks: ["tax_receipt", "tax_receipt_false_positive_guard", "obituary_link", "obituary_false_positive_guard", "date_signals", "obituary_header_date_range"] }, null, 2));
