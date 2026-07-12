import type { OfferProfitField, RawDossier } from "@ple/types";
import { CLOSING_FIELD_MAP } from "./closing-template-data";
import type { PacketEstate, PacketModel, PacketSection } from "./packet-model";

export type ClosingFieldInput = string | {
  value?: unknown;
  note?: unknown;
  resolution?: "provided" | "not_applicable" | "supporting_document" | string;
  supportingDocumentId?: unknown;
};

export interface ClosingEstateInput {
  selectedTemplateIds?: string[];
  fields?: Record<string, ClosingFieldInput>;
}

export interface ClosingPacketOptions {
  default?: ClosingEstateInput;
  byEstate?: Record<string, ClosingEstateInput>;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

const NOT_APPLICABLE_FIELDS = new Set(["foreclosure_case"]);

function fieldValue(key: string, input: ClosingFieldInput | undefined): string {
  if (typeof input === "string") return input.trim();
  if (!input || typeof input !== "object") return "";
  const value = text(input.value);
  if (value) return value;
  const note = text(input.note);
  if (input.resolution === "not_applicable" && NOT_APPLICABLE_FIELDS.has(key) && note) return `N/A - ${note}`;
  return "";
}

function offerValue(field: OfferProfitField | undefined): string {
  if (!field || field.value === null || !Number.isFinite(field.value)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(field.value);
}

function inferredFields(dossier: RawDossier): Record<string, string> {
  const report = dossier.completedLeadReport;
  const contacts = report?.contactPlaceholders.filter((contact) => contact.name && !contact.reviewFlags.length) ?? [];
  const sellerNames = contacts.map((contact) => contact.name).filter(Boolean).join(", ");
  const relationships = contacts.map((contact) => `${contact.name}: ${contact.role}`).join("; ");
  const offer = report?.offerMath;
  const titleEvidence = [
    text(dossier.deedHistory.orBookPage.value),
    text(dossier.deedHistory.latestDeed.value),
  ].filter(Boolean).join("; ");
  return {
    estate_name: dossier.summary.estateName || dossier.summary.displayName,
    deceased_name: text(dossier.property.ownerName.value) || dossier.summary.estateName || dossier.summary.displayName,
    property_address: text(dossier.property.address.value),
    county: text(dossier.property.county.value),
    folio: text(dossier.property.parcelId.value),
    seller_heirs: sellerNames,
    heir_relationships: relationships,
    probate_case: text(dossier.summary.caseNumber) || text(dossier.property.caseNumber.value) || text(dossier.probateDocket.caseNumber.value),
    offer_amount: offerValue(offer?.offerAmount),
    transfer_amount: offerValue(offer?.offerAmount),
    purchase_price: offerValue(offer?.offerAmount),
    per_heir_amount: offerValue(offer?.equityPerHeir),
    taxes_due: text(dossier.taxHistory.amountDue.value),
    tax_paid_by: text(dossier.taxHistory.payerIdentity.value) || text(dossier.taxHistory.lastPaidBy?.value),
    title_evidence: titleEvidence,
  };
}

function estateInput(dossier: RawDossier, options: ClosingPacketOptions): ClosingEstateInput {
  return options.byEstate?.[dossier.id] ?? options.default ?? {};
}

function resolvedFields(dossier: RawDossier, input: ClosingEstateInput): Record<string, string> {
  const resolved = { ...inferredFields(dossier) };
  for (const [key, value] of Object.entries(input.fields ?? {})) {
    const override = fieldValue(key, value);
    if (override) resolved[key] = override;
  }
  return resolved;
}

function selectedForms(input: ClosingEstateInput) {
  const requested = new Set((input.selectedTemplateIds ?? []).map(text).filter(Boolean));
  return CLOSING_FIELD_MAP.forms.filter((form) => requested.has(form.id));
}

function closingSections(
  forms: ReadonlyArray<{ id: string; title: string; requiredFields: readonly string[] }>,
  fields: Record<string, string>,
): PacketSection[] {
  return forms.map((form) => ({
    id: form.id,
    title: form.title,
    lines: form.requiredFields.map((field) => ({
      label: field.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      value: fields[field] || "Required before export",
      tone: fields[field] ? "normal" as const : "warning" as const,
    })),
    sourceUrls: [],
  }));
}

export function buildClosingPacketModel(
  dossiers: RawDossier[],
  options: ClosingPacketOptions = {},
  generatedAt = new Date().toISOString(),
): PacketModel {
  if (!dossiers.length) throw new Error("At least one reviewed dossier is required.");
  const blockers: string[] = [];
  const estates: PacketEstate[] = dossiers.map((dossier) => {
    const input = estateInput(dossier, options);
    const forms = selectedForms(input);
    const fields = resolvedFields(dossier, input);
    if (!forms.length) blockers.push(`${dossier.summary.displayName}: choose at least one Closing form.`);
    for (const form of forms) {
      for (const field of form.requiredFields) {
        if (!fields[field]) blockers.push(`${dossier.summary.displayName}: ${form.title} needs ${field.replace(/_/g, " ")}.`);
      }
    }
    return {
      dossierId: dossier.id,
      displayName: dossier.summary.displayName,
      propertyAddress: text(dossier.property.address.value) || "Address not confirmed",
      sections: closingSections(forms, fields),
      closing: {
        templateIds: forms.map((form) => form.id),
        fields,
      },
    };
  });
  const sections = estates.flatMap((estate) => estate.sections.map((section) => ({
    id: `${estate.dossierId}:${section.id}`,
    title: section.title,
    estateId: estate.dossierId,
  })));
  return {
    version: 1,
    flow: "closing-docs",
    title: dossiers.length === 1
      ? `HeirRight Closing Prep Packet - ${dossiers[0].summary.displayName}`
      : `HeirRight Closing Prep Batch - ${dossiers.length} estates`,
    generatedAt,
    estateIds: dossiers.map((dossier) => dossier.id),
    estates,
    sections,
    blockers,
    closingTemplate: {
      templateId: CLOSING_FIELD_MAP.templateId,
      templateHash: CLOSING_FIELD_MAP.templateHash,
      version: CLOSING_FIELD_MAP.version,
    },
  };
}
