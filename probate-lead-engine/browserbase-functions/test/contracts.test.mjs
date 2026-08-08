import assert from "node:assert/strict";
import { discoverTaxCollectorReceipt, extractDateSignals, pickBestObituaryLink, resolveUrl } from "../src/source-helpers.mjs";

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

assert.equal(
  resolveUrl("/url?q=https%3A%2F%2Fwww.legacy.com%2Fus%2Fobituaries%2Fexample&sa=U", "https://www.google.com/search?q=example"),
  "https://www.legacy.com/us/obituaries/example",
);
assert.equal(
  resolveUrl("//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.legacy.com%2Fus%2Fobituaries%2Fexample", "https://html.duckduckgo.com/html/?q=example"),
  "https://www.legacy.com/us/obituaries/example",
);

const noGoogleSearchPage = pickBestObituaryLink([
  { url: "https://www.google.com/search?q=example+obituary", text: "example obituary" },
  { url: "https://www.legacy.com/us/obituaries/example", text: "Example Owner obituary" },
]);
assert.equal(noGoogleSearchPage.url, "https://www.legacy.com/us/obituaries/example");
assert.equal(pickBestObituaryLink([
  { url: "https://www.legacy.com/obituaries/search", text: "Search obituaries" },
  { url: "https://funeral.example.test/obituaries/example-owner", text: "Example Owner obituary" },
]).url, "https://funeral.example.test/obituaries/example-owner");

assert.equal(pickBestObituaryLink([
  { url: "https://www.google.com/webhp", text: "example obituary" },
  { url: "https://www.bing.com/", text: "example obituary" },
  { url: "https://www.bing.com/search?q=example+obituary", text: "example obituary" },
  { url: "https://html.duckduckgo.com/html/?q=example+obituary", text: "example obituary" },
  { url: "https://www2.miamidadeclerk.gov/marriage/example", text: "Marriage license record" },
]), null);

const dates = extractDateSignals("Example Owner was born March 4, 1942. She passed away January 2, 2024 in Miami.");
assert.equal(dates.dateOfBirth, "March 4, 1942");
assert.equal(dates.dateOfDeath, "January 2, 2024");

const uppercaseRangeDates = extractDateSignals("OBITUARY Annie F. Hawkins FEBRUARY 7, 1937 - JUNE 23, 2014 IN THE CARE OF");
assert.equal(uppercaseRangeDates.dateOfBirth, "February 7, 1937");
assert.equal(uppercaseRangeDates.dateOfDeath, "June 23, 2014");

console.log(JSON.stringify({ ok: true, checks: ["tax_receipt", "tax_receipt_false_positive_guard", "obituary_link", "obituary_false_positive_guard", "search_redirect_unwrap", "search_page_guard", "date_signals", "obituary_header_date_range"] }, null, 2));
