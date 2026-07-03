import type { IntakeSeed, SourceFact, SourceGovernanceCatalog } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";

function buildGovernanceCatalog(): SourceGovernanceCatalog {
  const paidFlags = ["PAID_SOURCE_APPROVAL_REQUIRED", "STORAGE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;
  const manualFlags = ["MANUAL_SOURCE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;
  const publicFlags = ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] as const;

  return {
    taxonomy: ["public_automated", "manual_approved", "paid_approval_gated", "blocked"],
    publicSourceContracts: [
      {
        code: "property_appraiser",
        label: "Miami-Dade Property Appraiser",
        source: "property_appraiser",
        accessClass: "public_automated",
        automationAllowed: true,
        entryUrl: "https://www.miamidade.gov/Apps/PA/PropertySearch/#/",
        stages: [
          { code: "owner_type", title: "Confirm owner type", operatorAction: "Confirm the property is under an individual name; move on or override if it is a company.", requiredEvidence: ["owner name", "property address", "folio"], blocksUntilCaptured: true },
          { code: "mailing_address", title: "Check mailing address", operatorAction: "Record mailing address matches, mismatches, or missing source evidence from the parcel record.", requiredEvidence: ["property appraiser source URL", "mailing address note"], blocksUntilCaptured: true },
        ],
        reviewFlags: [...publicFlags],
      },
      {
        code: "tax_collector_receipt",
        label: "Tax Collector receipt",
        source: "tax_collector",
        accessClass: "public_automated",
        automationAllowed: true,
        entryUrl: "https://county-taxes.net/fl-miamidade",
        stages: [
          { code: "tax_search", title: "Search property tax account", operatorAction: "Search the Tax Collector property-tax portal by folio, owner, or property address.", requiredEvidence: ["Tax Collector search/listing URL"], blocksUntilCaptured: true },
          { code: "listing_page", title: "Open listing page", operatorAction: "Open the matching listing page and confirm it belongs to the estate property.", requiredEvidence: ["listing page URL", "folio or property address match"], blocksUntilCaptured: true },
          { code: "bottom_right_receipt", title: "Capture bottom-right receipt link", operatorAction: "Capture the receipt link shown in the bottom-right corner of the listing page.", requiredEvidence: ["receipt link", "receipt artifact"], blocksUntilCaptured: true },
          { code: "payer_review", title: "Record payer and paid date", operatorAction: "Record who paid, paid date, amount due, unpaid years, and reassessment notes from the receipt or listing.", requiredEvidence: ["paid-by party", "paid date", "amount due or unavailable note"], blocksUntilCaptured: true },
        ],
        reviewFlags: ["TAX_COLLECTOR_LISTING_PAGE_REQUIRED", "TAX_RECEIPT_LINK_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
      },
      {
        code: "official_records_deed",
        label: "Official Records deed and title",
        source: "official_records",
        accessClass: "public_automated",
        automationAllowed: true,
        entryUrl: "https://onlineservices.miamidadeclerk.gov/officialrecords",
        stages: [
          { code: "latest_deed", title: "Find latest recorded deed", operatorAction: "Search Official Records by owner, address, folio, or OR book/page and save the latest deed source.", requiredEvidence: ["Official Records URL", "deed document link", "OR book/page or instrument"], blocksUntilCaptured: true },
          { code: "title_friction", title: "Check title friction", operatorAction: "Record mortgage, lien, Lis Pendens, foreclosure, adverse possession, and ownership activity signals.", requiredEvidence: ["title signal note", "source URL"], blocksUntilCaptured: true },
          { code: "recent_sale_stop", title: "Check recent sale", operatorAction: "Record last sale date; move on unless operator override exists when sale is inside five years.", requiredEvidence: ["last sale date or unavailable note"], blocksUntilCaptured: true },
        ],
        reviewFlags: [...publicFlags],
      },
      {
        code: "probate_court",
        label: "Probate, civil, and family docket",
        source: "probate_court",
        accessClass: "public_automated",
        automationAllowed: true,
        entryUrl: "https://www2.miamidadeclerk.gov/ocs/",
        stages: [
          { code: "case_lookup", title: "Find probate/civil/family cases", operatorAction: "Search the clerk docket by estate and decedent names and record probate, civil, or family case references.", requiredEvidence: ["docket URL", "case number", "case status"], blocksUntilCaptured: true },
          { code: "affidavit_documents", title: "Check affidavit and document availability", operatorAction: "Record affidavit of heirs and available/missing probate documents; create request task if missing.", requiredEvidence: ["affidavit status", "document availability"], blocksUntilCaptured: true },
          { code: "or_cross_link", title: "Cross-link official records", operatorAction: "Cross-check probate references against OR book/page and recorded instruments.", requiredEvidence: ["official record cross-link or unavailable note"], blocksUntilCaptured: false },
        ],
        reviewFlags: [...publicFlags],
      },
      {
        code: "obituary_vital_review",
        label: "Obituary and vital-source review",
        source: "clerk_of_courts",
        accessClass: "public_automated",
        automationAllowed: true,
        entryUrl: "https://www.google.com/search?q=obituary",
        stages: [
          { code: "obituary_search", title: "Search obituary and memorial sources", operatorAction: "Search obituary, Findagrave, Legacy, and public memorial results; record found or reviewed-not-found.", requiredEvidence: ["obituary link/snapshot or reviewed-not-found note"], blocksUntilCaptured: false },
          { code: "vital_indicators", title: "Capture DOB/DOD and marriage signal", operatorAction: "Record DOB, DOD, marriage-license signal, death certificate status, and incarceration signal when source-backed.", requiredEvidence: ["DOB/DOD source note", "marriage/death status"], blocksUntilCaptured: false },
        ],
        reviewFlags: [...publicFlags],
      },
    ],
    governedSources: [
      { code: "idi", label: "IDI", accessClass: "paid_approval_gated", automationAllowed: false, storageApproved: false, reason: "Paid skip-trace source requires client approval before use or storage.", reviewFlags: [...paidFlags] },
      { code: "intelius", label: "Intelius", accessClass: "paid_approval_gated", automationAllowed: false, storageApproved: false, reason: "Paid people-search source requires client approval before use or storage.", reviewFlags: [...paidFlags] },
      { code: "ancestry", label: "Ancestry", accessClass: "paid_approval_gated", automationAllowed: false, storageApproved: false, reason: "Paid genealogy source requires client approval before use or storage.", reviewFlags: [...paidFlags] },
      { code: "forewarn", label: "ForeWarn", accessClass: "paid_approval_gated", automationAllowed: false, storageApproved: false, reason: "Paid risk/source tool requires client approval before use or storage.", reviewFlags: [...paidFlags] },
      { code: "vitalchek", label: "VitalChek", accessClass: "paid_approval_gated", automationAllowed: false, storageApproved: false, reason: "Paid vital-record ordering requires client approval; no automated VitalChek flow.", reviewFlags: [...paidFlags] },
      { code: "voter_records", label: "Voter records", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "Voter-registration signals must be reviewed as source-backed address/deceased indicators, not scraped into heirship conclusions.", reviewFlags: [...manualFlags] },
      { code: "professional_licenses", label: "Professional licenses", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "Professional-license signals are public/manual research aids and require source links plus operator review before use.", reviewFlags: [...manualFlags] },
      { code: "business_address_associations", label: "Business and address associations", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "Business, registered-agent, and address-history matches need operator review before being attached to a person or estate.", reviewFlags: [...manualFlags] },
      { code: "social_profiles", label: "Social profiles", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "Social-profile signals are manual research only; record a source URL or reviewed-not-found note and do not automate outreach from them.", reviewFlags: [...manualFlags] },
      { code: "deceased_indicator_crosscheck", label: "Deceased indicator cross-check", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "Deceased indicators from public or paid sources must be cross-checked against obituary, court, or vital-record evidence.", reviewFlags: [...manualFlags] },
      { code: "private_investigator", label: "Private investigator request", accessClass: "manual_approved", automationAllowed: false, storageApproved: false, reason: "PI requests remain manual and approval-gated.", reviewFlags: [...manualFlags] },
    ],
    manualTasks: [
      { code: "VOTER_RECORD_REVIEW", title: "Review voter-record signals", description: "Record voter registration/address/deceased indicators only as source-backed research notes.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "PROFESSIONAL_LICENSE_REVIEW", title: "Review professional-license signals", description: "Record license match/no-match and source URL before using it as an address or identity signal.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "BUSINESS_ADDRESS_REVIEW", title: "Review business/address associations", description: "Check business registrations, registered-agent records, and address associations with source links.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "SOCIAL_PROFILE_REVIEW", title: "Review social-profile signals", description: "Record public profile evidence or reviewed-not-found notes without automated contact or scraping assumptions.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "DOOR_KNOCK", title: "Door knock / field visit", description: "Schedule only after explicit manual-work approval.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "NEIGHBOR_RESEARCH", title: "Neighbor research", description: "Capture neighbor observations as audit notes, not automated facts.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "CODE_ENFORCEMENT", title: "Code enforcement call", description: "Manual municipal/code-enforcement follow-up.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
      { code: "DOCUMENT_REQUEST", title: "Manual document request", description: "Request court or vital records manually when automation is blocked.", accessClass: "manual_approved", reviewFlags: [...manualFlags] },
    ],
    auditNotes: [
      "Public-source contracts define the exact evidence path before a source area can be treated as captured.",
      "Tax Collector receipt capture requires the listing page and the bottom-right receipt link before manual override.",
      "No paid or manual source is automated by default in S6.",
      "Voter, professional-license, social-profile, and business/address signals must be source-linked and reviewed before they influence heir/contact decisions.",
      "Storage of paid-source results requires explicit client approval.",
      "Manual observations must be recorded as audit notes with operator attribution.",
    ],
  };
}

export async function fetchSourceGovernanceFacts(runId: string, seed: IntakeSeed): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const rawId = `source-governance:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);

  return [
    fact({
      runId,
      source: "source_governance",
      rawId: `${rawId}:catalog`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_governance_catalog",
      value: buildGovernanceCatalog(),
      confidence: 1,
      reviewFlags: ["PAID_SOURCE_APPROVAL_REQUIRED", "MANUAL_SOURCE_APPROVAL_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
  ];
}
