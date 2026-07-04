import type { IntakeSeed, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";
import { acquireTaxCollectorReceipt } from "./tax-collector-receipt";

const TAX_COLLECTOR_REVIEW_URL = "https://www.miamidade.gov/global/service.page?Mduid_service=ser1499797463762502";
const TAX_COLLECTOR_PUBLIC_SEARCH_URL = "https://miamidade.county-taxes.com/public";
const TAX_COLLECTOR_RECEIPT_NOTE = "Open the Tax Collector listing page and capture the receipt link shown in the bottom-right corner.";

type RuntimeEnv = Record<string, string | undefined>;

function acquisitionRequested(seed: IntakeSeed, env: RuntimeEnv): boolean {
  return Boolean(
    seed.taxCollectorListingUrl
      || seed.taxCollectorReceiptUrl
      || env.TAX_COLLECTOR_LISTING_URL
      || env.TAX_COLLECTOR_LISTING_URL_TEMPLATE
      || env.TAX_COLLECTOR_BROWSER_WORKFLOW_URL
      || (env.BROWSERBASE_API_KEY && (env.TAX_COLLECTOR_BROWSERBASE_FUNCTION_ID || env.BROWSERBASE_TAX_COLLECTOR_FUNCTION_ID))
      || env.TAX_COLLECTOR_LIVE_ACQUISITION_ENABLED === "true"
  );
}

export async function fetchTaxHistoryFacts(runId: string, seed: IntakeSeed, env: RuntimeEnv = {}): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const rawId = `tax-history:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);
  const acquisition = acquisitionRequested(seed, env)
    ? await acquireTaxCollectorReceipt({
        listingUrl: seed.taxCollectorListingUrl,
        receiptUrl: seed.taxCollectorReceiptUrl,
        parcelId: seed.parcelId,
        propertyAddress: seed.propertyAddress,
        ownerName: seed.ownerName,
      }, { env })
    : null;
  const receipt = acquisition?.discovery;
  const receiptDetails = receipt?.details ?? {};
  const receiptAttachment = receipt ? {
    label: "Tax Collector receipt",
    sourceUrl: receipt.receiptUrl,
    fileKind: "link" as const,
    capturedAt: fetchedAt,
    capturedBy: "tax-collector-acquisition",
    reviewFlags: receipt.reviewFlags,
  } : undefined;
  const acquisitionUrl = receipt?.listingUrl || acquisition?.finalUrl || acquisition?.listingUrl || TAX_COLLECTOR_PUBLIC_SEARCH_URL;
  const acquisitionFlags = acquisition?.reviewFlags ?? ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];
  const acquisitionNote = acquisition
    ? acquisition.ok
      ? `Tax Collector listing page was checked and receipt link was captured by ${acquisition.mode}.`
      : acquisition.blocker || "Tax Collector listing-page acquisition is blocked."
    : "Tax Collector script acquisition waits for a direct listing URL, listing URL template, or browser workflow capture.";

  return [
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:acquisition-status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: {
        mode: acquisition?.mode ?? "not_configured",
        ok: acquisition?.ok ?? false,
        listingUrl: acquisition?.listingUrl || seed.taxCollectorListingUrl || null,
        receiptUrl: receipt?.receiptUrl ?? null,
        searchUrl: acquisition?.searchUrl ?? TAX_COLLECTOR_PUBLIC_SEARCH_URL,
        note: acquisitionNote,
        status: acquisition?.status,
      },
      confidence: acquisition?.ok ? 0.8 : 0.35,
      sourceUrl: acquisitionUrl,
      reviewFlags: acquisitionFlags,
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_history_status",
      value: "manual_review_required",
      confidence: 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: ["MISSING_TAX_HISTORY_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:unpaid-years`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "unpaid_tax_years",
      value: receiptDetails.unpaidYears ?? null,
      confidence: receiptDetails.unpaidYears ? 0.78 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receiptDetails.unpaidYears ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_TAX_HISTORY_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:amount-due`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_amount_due",
      value: receiptDetails.amountDue ?? null,
      confidence: receiptDetails.amountDue ? 0.78 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receiptDetails.amountDue ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_TAX_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:reassessment`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_reassessment_signal",
      value: receiptDetails.reassessment ?? null,
      confidence: receiptDetails.reassessment ? 0.7 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receiptDetails.reassessment ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["REASSESSMENT_REVIEW_REQUIRED", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:receipt-status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_receipt_status",
      value: receipt ? "receipt_link_captured" : null,
      confidence: receipt ? 0.85 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receipt ? receipt.reviewFlags : ["MISSING_TAX_RECEIPT_FACT", ...acquisitionFlags],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:receipt-link`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_receipt_link",
      value: receipt?.receiptUrl ?? null,
      confidence: receipt ? 0.9 : 0,
      sourceUrl: receipt?.receiptUrl || acquisitionUrl,
      reviewFlags: receipt ? receipt.reviewFlags : ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:paid-date`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_paid_date",
      value: receiptDetails.paidDate ?? null,
      confidence: receiptDetails.paidDate ? 0.78 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receiptDetails.paidDate ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_TAX_RECEIPT_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:payer-identity`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_payer_identity",
      value: receiptDetails.payerIdentity ?? null,
      confidence: receiptDetails.payerIdentity ? 0.78 : 0,
      sourceUrl: acquisitionUrl,
      reviewFlags: receiptDetails.payerIdentity ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_TAX_PAYER_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:receipt-attachment`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_receipt_attachment",
      value: receiptAttachment ?? null,
      confidence: receiptAttachment ? 0.9 : 0,
      sourceUrl: receipt?.receiptUrl || acquisitionUrl,
      attachment: receiptAttachment,
      reviewFlags: receiptAttachment ? receiptAttachment.reviewFlags : ["SOURCE_ATTACHMENT_REQUIRED", "TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:last-paid-by`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "tax_last_paid_by",
      value: receiptDetails.paidBy ?? null,
      confidence: receiptDetails.paidBy ? 0.78 : 0,
      sourceUrl: TAX_COLLECTOR_REVIEW_URL,
      reviewFlags: receiptDetails.paidBy ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : ["MISSING_TAX_PAYER_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "tax_collector",
      rawId: `${rawId}:listing-page-next-action`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: TAX_COLLECTOR_RECEIPT_NOTE,
      confidence: 0.4,
      sourceUrl: TAX_COLLECTOR_REVIEW_URL,
      reviewFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
