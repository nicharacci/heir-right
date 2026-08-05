import { createHash } from "node:crypto";
import type { IntakeSeed, SourceFact } from "@ple/types";
import { fetchCivilProbateCommercialApiFacts, fetchOfficialRecordsCommercialApiFacts } from "./clerk-commercial-api";
import { fetchMarriageDeathIndicatorFacts } from "./marriage-death-indicators";
import {
  acquireTaxCollectorReceipt,
  verifyTaxCollectorReceiptAttachment,
  type TaxCollectorDetails,
  type TaxCollectorReceiptAcquisitionResult,
} from "./tax-collector-receipt";
import { getServerNousCredential, nousDynamicModelId } from "../agentic/nous-free-model";

export const DOC_PREP_STAGE_IDS = [
  "skip_trace_parse",
  "obituary_search",
  "deed_title_search",
  "tax_receipt_fetch",
  "court_records_search",
  "backstory_generate",
] as const;

export type DocPrepStageId = typeof DOC_PREP_STAGE_IDS[number];
export type DocPrepStageStatus = "succeeded" | "review_required" | "blocked" | "failed";

type JsonRecord = Record<string, unknown>;
type FetchImpl = typeof fetch;

interface KeyValueStore {
  get(key: string): Promise<string | null>;
}

export interface DocPrepStageEnv {
  [key: string]: string | KeyValueStore | undefined;
  PACKET_ARTIFACTS?: KeyValueStore;
}

export interface DocPrepEstate {
  estateId: string;
  name: string;
  owner?: string;
  address: string;
  county: string;
  parcelId?: string;
  caseReference?: string;
  sourceFileReferences: string[];
  actor?: { email: string; name?: string };
}

export interface DocPrepActor {
  email: string;
  name?: string;
}

export interface DocPrepEvidenceReferenceRecord {
  id: string;
  stageId: DocPrepStageId;
  source: string;
  rawId: string;
  fetchedAt: string;
  factType: string;
  value: unknown;
  sourceUrl?: string;
  attachment?: JsonRecord;
  sourceLocator?: JsonRecord;
}

export type DocPrepEvidenceReference = string | DocPrepEvidenceReferenceRecord;

export interface DocPrepPriorStageOutput {
  stageId: DocPrepStageId;
  evidenceReferences: DocPrepEvidenceReference[];
}

export interface DocPrepStageInput {
  caseId: string;
  estate: DocPrepEstate;
  priorStageOutputs: DocPrepPriorStageOutput[];
  actor: DocPrepActor;
}

export interface DocPrepStageFact {
  source: string;
  rawId: string;
  fetchedAt: string;
  factType: string;
  value: unknown;
  confidence: number;
  reviewFlags: string[];
  sourceUrl?: string;
  attachment?: JsonRecord;
  evidenceReferenceIds?: string[];
}

export interface DocPrepStageOutput {
  ok: true;
  stageId: DocPrepStageId;
  status: DocPrepStageStatus;
  detail: string;
  nextAction?: string;
  evidenceReferences: DocPrepEvidenceReference[];
  facts: DocPrepStageFact[];
}

export interface DocPrepInputError {
  ok: false;
  error: "invalid_doc_prep_stage_input";
  field: string;
  message: string;
}

export type DocPrepSystemFailureStage = DocPrepStageId | "packet-render" | "artifact-readback" | "outbox" | "pg-boss";

export interface DocPrepSystemFailure {
  stageId: DocPrepSystemFailureStage;
  code: string;
  provider: string;
  deploymentKey: string;
}

export interface DocPrepFailureLogResult {
  issue?: { id?: unknown; identifier?: unknown; url?: unknown };
  deduplicated?: boolean;
  error?: "linear_log_failed";
}

export interface DocPrepStageDependencies {
  fetcher?: FetchImpl;
  reportSystemFailure?: (failure: DocPrepSystemFailure) => Promise<DocPrepFailureLogResult>;
  now?: () => string;
}

type ParsedInput = { ok: true; input: DocPrepStageInput } | DocPrepInputError;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: JsonRecord, required: string[], optional: string[] = []): boolean {
  const allowed = new Set([...required, ...optional]);
  return required.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && Object.keys(value).every((key) => allowed.has(key));
}

function validText(value: unknown, max: number, required = true): boolean {
  if (typeof value !== "string") return false;
  const length = value.trim().length;
  return required ? length >= 1 && length <= max : length <= max;
}

function validEmail(value: unknown): boolean {
  const email = stringValue(value);
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function jsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length <= 20_000;
  if (Array.isArray(value)) return value.length <= 256 && value.every((item) => jsonSafe(item, depth + 1));
  if (!isRecord(value) || Object.keys(value).length > 64) return false;
  return Object.entries(value).every(([key, nested]) => key.length <= 160 && jsonSafe(nested, depth + 1));
}

export function isDocPrepStageId(value: string): value is DocPrepStageId {
  return (DOC_PREP_STAGE_IDS as readonly string[]).includes(value);
}

function inputError(field: string, message: string): DocPrepInputError {
  return { ok: false, error: "invalid_doc_prep_stage_input", field, message };
}

function parseActor(value: unknown, field: string): DocPrepActor | DocPrepInputError {
  if (!isRecord(value) || !exactKeys(value, ["email"], ["name"])) return inputError(field, "Actor must contain only email and optional name.");
  if (!validEmail(value.email)) return inputError(`${field}.email`, "Actor email must be valid.");
  if (value.name !== undefined && !validText(value.name, 300, false)) return inputError(`${field}.name`, "Actor name is too long.");
  return {
    email: stringValue(value.email).toLowerCase(),
    ...(stringValue(value.name) ? { name: stringValue(value.name) } : {}),
  };
}

function parseEstate(value: unknown): DocPrepEstate | DocPrepInputError {
  const required = ["estateId", "name", "address", "county", "sourceFileReferences"];
  const optional = ["owner", "parcelId", "caseReference", "actor"];
  if (!isRecord(value) || !exactKeys(value, required, optional)) {
    return inputError("estate", "Estate contains missing or unsupported fields.");
  }
  const limits: Array<[string, number]> = [["estateId", 160], ["name", 300], ["address", 500], ["county", 120]];
  for (const [field, max] of limits) {
    if (!validText(value[field], max)) return inputError(`estate.${field}`, `${field} is required and must be bounded text.`);
  }
  for (const [field, max] of [["owner", 300], ["parcelId", 160], ["caseReference", 160]] as Array<[string, number]>) {
    if (value[field] !== undefined && !validText(value[field], max, false)) return inputError(`estate.${field}`, `${field} must be bounded text.`);
  }
  if (!Array.isArray(value.sourceFileReferences) || value.sourceFileReferences.length > 50
    || !value.sourceFileReferences.every((item) => validText(item, 500))) {
    return inputError("estate.sourceFileReferences", "Source file references must be a bounded string array.");
  }
  let nestedActor: DocPrepActor | undefined;
  if (value.actor !== undefined) {
    const parsedActor = parseActor(value.actor, "estate.actor");
    if ("ok" in parsedActor) return parsedActor;
    nestedActor = parsedActor;
  }
  return {
    estateId: stringValue(value.estateId),
    name: stringValue(value.name),
    address: stringValue(value.address),
    county: stringValue(value.county),
    sourceFileReferences: value.sourceFileReferences.map(stringValue),
    ...(stringValue(value.owner) ? { owner: stringValue(value.owner) } : {}),
    ...(stringValue(value.parcelId) ? { parcelId: stringValue(value.parcelId) } : {}),
    ...(stringValue(value.caseReference) ? { caseReference: stringValue(value.caseReference) } : {}),
    ...(nestedActor ? { actor: nestedActor } : {}),
  };
}

function parseEvidenceReference(value: unknown, priorStageId: DocPrepStageId, field: string): DocPrepEvidenceReference | DocPrepInputError {
  if (validText(value, 500)) return stringValue(value);
  const required = ["id", "stageId", "source", "rawId", "fetchedAt", "factType", "value"];
  const optional = ["sourceUrl", "attachment", "sourceLocator"];
  if (!isRecord(value) || !exactKeys(value, required, optional)) return inputError(field, "Evidence reference has an unsupported shape.");
  if (value.stageId !== priorStageId) return inputError(`${field}.stageId`, "Evidence reference stage must match its prior stage output.");
  for (const [key, max] of [["id", 300], ["source", 120], ["rawId", 500], ["fetchedAt", 80], ["factType", 160]] as Array<[string, number]>) {
    if (!validText(value[key], max)) return inputError(`${field}.${key}`, `${key} must be bounded text.`);
  }
  if (!jsonSafe(value.value)) return inputError(`${field}.value`, "Evidence value is not bounded JSON.");
  if (value.sourceUrl !== undefined && !validText(value.sourceUrl, 2_000, false)) return inputError(`${field}.sourceUrl`, "Source URL is too long.");
  if (value.attachment !== undefined && !jsonSafe(value.attachment)) return inputError(`${field}.attachment`, "Attachment metadata is invalid.");
  if (value.sourceLocator !== undefined && !jsonSafe(value.sourceLocator)) return inputError(`${field}.sourceLocator`, "Source locator is invalid.");
  return {
    id: stringValue(value.id),
    stageId: priorStageId,
    source: stringValue(value.source),
    rawId: stringValue(value.rawId),
    fetchedAt: stringValue(value.fetchedAt),
    factType: stringValue(value.factType),
    value: structuredClone(value.value),
    ...(stringValue(value.sourceUrl) ? { sourceUrl: stringValue(value.sourceUrl) } : {}),
    ...(isRecord(value.attachment) ? { attachment: structuredClone(value.attachment) } : {}),
    ...(isRecord(value.sourceLocator) ? { sourceLocator: structuredClone(value.sourceLocator) } : {}),
  };
}

export function parseDocPrepStageInput(stageId: DocPrepStageId, value: unknown): ParsedInput {
  if (!isRecord(value) || !exactKeys(value, ["caseId", "estate", "priorStageOutputs", "actor"])) {
    return inputError("request", "Request must contain only caseId, estate, priorStageOutputs, and actor.");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stringValue(value.caseId))) {
    return inputError("caseId", "caseId must be a UUID.");
  }
  const estate = parseEstate(value.estate);
  if ("ok" in estate) return estate;
  const actor = parseActor(value.actor, "actor");
  if ("ok" in actor) return actor;
  if (estate.actor && estate.actor.email !== actor.email) return inputError("actor.email", "Root actor must match the estate snapshot actor.");
  const stageIndex = DOC_PREP_STAGE_IDS.indexOf(stageId);
  if (!Array.isArray(value.priorStageOutputs) || value.priorStageOutputs.length !== stageIndex) {
    return inputError("priorStageOutputs", "Prior stage outputs must contain every earlier stage exactly once and in order.");
  }
  const priorStageOutputs: DocPrepPriorStageOutput[] = [];
  for (let index = 0; index < value.priorStageOutputs.length; index += 1) {
    const output = value.priorStageOutputs[index];
    const expectedStageId = DOC_PREP_STAGE_IDS[index];
    if (!isRecord(output) || !exactKeys(output, ["stageId", "evidenceReferences"]) || output.stageId !== expectedStageId) {
      return inputError(`priorStageOutputs.${index}`, `Prior output ${index + 1} must be ${expectedStageId}.`);
    }
    if (!Array.isArray(output.evidenceReferences) || output.evidenceReferences.length > 256) {
      return inputError(`priorStageOutputs.${index}.evidenceReferences`, "Evidence references must be a bounded array.");
    }
    const evidenceReferences: DocPrepEvidenceReference[] = [];
    for (let evidenceIndex = 0; evidenceIndex < output.evidenceReferences.length; evidenceIndex += 1) {
      const parsed = parseEvidenceReference(
        output.evidenceReferences[evidenceIndex],
        expectedStageId,
        `priorStageOutputs.${index}.evidenceReferences.${evidenceIndex}`,
      );
      if (isRecord(parsed) && "ok" in parsed) return parsed as DocPrepInputError;
      evidenceReferences.push(parsed as DocPrepEvidenceReference);
    }
    priorStageOutputs.push({ stageId: expectedStageId, evidenceReferences });
  }
  return { ok: true, input: { caseId: stringValue(value.caseId), estate, priorStageOutputs, actor } };
}

function runtimeEnv(env: DocPrepStageEnv): Record<string, string | undefined> {
  const output: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) if (typeof value === "string") output[key] = value;
  return output;
}

function deploymentKey(env: DocPrepStageEnv): string {
  return stringValue(env.DEPLOYMENT_KEY) || "heirright";
}

function now(dependencies: DocPrepStageDependencies): string {
  return dependencies.now?.() ?? new Date().toISOString();
}

function blankUnknowns(value: unknown): unknown {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(blankUnknowns);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, blankUnknowns(nested)]));
}

function hasKnownValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.some(hasKnownValue);
  if (isRecord(value)) return Object.values(value).some(hasKnownValue);
  return true;
}

function factFromSourceFact(sourceFact: SourceFact): DocPrepStageFact {
  return {
    source: sourceFact.source,
    rawId: sourceFact.rawId,
    fetchedAt: sourceFact.fetchedAt,
    factType: sourceFact.factType,
    value: blankUnknowns(sourceFact.value),
    confidence: sourceFact.confidence,
    reviewFlags: [...sourceFact.reviewFlags],
    ...(sourceFact.sourceUrl ? { sourceUrl: sourceFact.sourceUrl } : {}),
    ...(sourceFact.attachment ? { attachment: structuredClone(sourceFact.attachment) as unknown as JsonRecord } : {}),
  };
}

function evidenceReference(stageId: DocPrepStageId, fact: DocPrepStageFact, sourceLocator?: JsonRecord): DocPrepEvidenceReferenceRecord {
  const id = createHash("sha256")
    .update(`${stageId}\u0000${fact.source}\u0000${fact.rawId}\u0000${fact.factType}\u0000${JSON.stringify(fact.value)}`)
    .digest("hex");
  return {
    id,
    stageId,
    source: fact.source,
    rawId: fact.rawId,
    fetchedAt: fact.fetchedAt,
    factType: fact.factType,
    value: structuredClone(fact.value),
    ...(fact.sourceUrl ? { sourceUrl: fact.sourceUrl } : {}),
    ...(fact.attachment ? { attachment: structuredClone(fact.attachment) } : {}),
    ...(sourceLocator ? { sourceLocator: structuredClone(sourceLocator) } : {}),
  };
}

function evidenceFromFacts(stageId: DocPrepStageId, facts: DocPrepStageFact[]): DocPrepEvidenceReference[] {
  return facts
    .filter((fact) => !["source_status", "source_search_url", "memorial_search_tasks"].includes(fact.factType) && hasKnownValue(fact.value))
    .map((fact) => evidenceReference(stageId, fact));
}

function completed(
  stageId: DocPrepStageId,
  status: DocPrepStageStatus,
  detail: string,
  facts: DocPrepStageFact[],
  evidenceReferences: DocPrepEvidenceReference[],
  nextAction?: string,
): DocPrepStageOutput {
  return {
    ok: true,
    stageId,
    status,
    detail,
    ...(nextAction ? { nextAction } : {}),
    evidenceReferences,
    facts,
  };
}

async function systemFailure(
  input: DocPrepStageInput,
  env: DocPrepStageEnv,
  dependencies: DocPrepStageDependencies,
  status: "blocked" | "failed",
  code: string,
  provider: string,
  detail: string,
  nextAction: string,
  existingFacts: DocPrepStageFact[] = [],
): Promise<DocPrepStageOutput> {
  const failureFact: DocPrepStageFact = {
    source: provider,
    rawId: `${input.caseId}:${code}`,
    fetchedAt: now(dependencies),
    factType: "stage_failure",
    value: { code, provider },
    confidence: 1,
    reviewFlags: ["SOURCE_BLOCKED"],
  };
  const facts = [...existingFacts, failureFact];
  if (dependencies.reportSystemFailure) {
    try {
      const logged = await dependencies.reportSystemFailure({
        stageId: input.priorStageOutputs.length < DOC_PREP_STAGE_IDS.length
          ? DOC_PREP_STAGE_IDS[input.priorStageOutputs.length]
          : "backstory_generate",
        code,
        provider,
        deploymentKey: deploymentKey(env),
      });
      if (logged.error === "linear_log_failed") {
        facts.push({
          source: "linear",
          rawId: "linear_log_failed",
          fetchedAt: now(dependencies),
          factType: "stage_failure_log",
          value: { code: "linear_log_failed", provider: "linear" },
          confidence: 1,
          reviewFlags: ["SOURCE_BLOCKED"],
        });
      }
    } catch {
      facts.push({
        source: "linear",
        rawId: "linear_log_failed",
        fetchedAt: now(dependencies),
        factType: "stage_failure_log",
        value: { code: "linear_log_failed", provider: "linear" },
        confidence: 1,
        reviewFlags: ["SOURCE_BLOCKED"],
      });
    }
  }
  const stageId = DOC_PREP_STAGE_IDS[input.priorStageOutputs.length] ?? "backstory_generate";
  return completed(stageId, status, detail, facts, [], nextAction);
}

function intakeSeed(input: DocPrepStageInput): IntakeSeed {
  return {
    estateName: input.estate.name,
    ownerName: input.estate.owner || input.estate.name,
    propertyAddress: input.estate.address,
    county: input.estate.county,
    parcelId: input.estate.parcelId,
    caseNumber: input.estate.caseReference,
    source: "operator_cli",
  };
}

function idiImportKey(assetKey: string): string {
  return `idi-import:${createHash("sha256").update(assetKey).digest("hex")}`;
}

function idiReviewKey(assetKey: string, candidateId: string): string {
  return `idi-contact-review:${createHash("sha256").update(assetKey).digest("hex")}:${createHash("sha256").update(candidateId).digest("hex")}`;
}

function selectedIdiRecord(value: string | null, estateId: string): JsonRecord | null {
  if (!value) return null;
  try {
    const record = JSON.parse(value) as JsonRecord;
    if (record.version !== 1 || record.assetKey !== estateId || !Array.isArray(record.candidates) || !isRecord(record.attachment)) return null;
    if (["pending_guard_commit", "review_required"].includes(stringValue(record.importVerification))) return null;
    if (record.mode === "live_idi_core") return record.paidRunVerification === "verified" ? record : null;
    const subjectMatch = isRecord(record.subjectMatch) ? record.subjectMatch : {};
    return subjectMatch.matched === true ? record : null;
  } catch {
    return null;
  }
}

function selectedFileMatches(record: JsonRecord, references: string[]): boolean {
  const attachment = isRecord(record.attachment) ? record.attachment : {};
  const candidates = [attachment.id, attachment.artifactUrl, attachment.fileName].map(stringValue).filter(Boolean);
  return references.some((reference) => candidates.some((candidate) => reference === candidate || reference.endsWith(candidate)));
}

async function skipTraceParseStage(
  input: DocPrepStageInput,
  env: DocPrepStageEnv,
  dependencies: DocPrepStageDependencies,
): Promise<DocPrepStageOutput> {
  if (!input.estate.sourceFileReferences.length) {
    return completed(
      "skip_trace_parse",
      "review_required",
      "A selected persisted IDI report is required before skip-trace parsing.",
      [],
      [],
      "Select the uploaded IDI report for this estate and retry this stage.",
    );
  }
  if (!env.PACKET_ARTIFACTS) {
    return systemFailure(input, env, dependencies, "blocked", "idi_storage_unavailable", "idi", "Persisted IDI report storage is unavailable.", "Restore the document storage binding and retry.");
  }
  let record: JsonRecord | null;
  try {
    record = selectedIdiRecord(await env.PACKET_ARTIFACTS.get(idiImportKey(input.estate.estateId)), input.estate.estateId);
  } catch {
    return systemFailure(input, env, dependencies, "failed", "idi_storage_read_failed", "idi", "The persisted IDI report could not be read.", "Retry after document storage is healthy.");
  }
  if (!record) {
    return completed(
      "skip_trace_parse",
      "review_required",
      "The selected estate has no verified persisted IDI report ready to parse.",
      [],
      [],
      "Import and verify the selected IDI report, then retry without starting a live IDI run.",
    );
  }
  if (!selectedFileMatches(record, input.estate.sourceFileReferences)) {
    return completed(
      "skip_trace_parse",
      "review_required",
      "The selected IDI file reference is stale or does not match the persisted estate report.",
      [],
      [],
      "Reload the estate files, select the current persisted IDI report, and retry.",
    );
  }
  const attachment = isRecord(record.attachment) ? record.attachment : {};
  const candidates = Array.isArray(record.candidates) ? record.candidates : [];
  const facts: DocPrepStageFact[] = [];
  const references: DocPrepEvidenceReference[] = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = isRecord(candidates[index]) ? candidates[index] : {};
    const candidateId = stringValue(candidate.id) || `idi-contact-${index + 1}`;
    let reviewStatus = stringValue(candidate.reviewStatus) || "needs_review";
    try {
      const reviewValue = await env.PACKET_ARTIFACTS.get(idiReviewKey(input.estate.estateId, candidateId));
      if (reviewValue) {
        const review = JSON.parse(reviewValue) as JsonRecord;
        if (review.assetKey === input.estate.estateId && review.candidateId === candidateId
          && review.importContentHash === attachment.contentHash && ["accepted", "promoted", "rejected"].includes(stringValue(review.status))) {
          reviewStatus = stringValue(review.status);
        }
      }
    } catch {
      return systemFailure(input, env, dependencies, "failed", "idi_review_read_failed", "idi", "The persisted IDI contact review could not be read.", "Retry after document storage is healthy.", facts);
    }
    const sourceLocator = isRecord(candidate.sourceLocator) ? structuredClone(candidate.sourceLocator) : {};
    const fact: DocPrepStageFact = {
      source: "idi",
      rawId: candidateId,
      fetchedAt: stringValue(record.importedAt) || now(dependencies),
      factType: candidate.group === "primary" ? "primary_contact_profile" : "alternative_contact_profile",
      value: {
        name: stringValue(candidate.name),
        relationship: stringValue(candidate.relationship),
        age: candidate.age === undefined || candidate.age === null ? "" : candidate.age,
        interest: stringValue(candidate.interest),
        phones: Array.isArray(candidate.phones) ? candidate.phones.map(stringValue).filter(Boolean) : [],
        emails: Array.isArray(candidate.emails) ? candidate.emails.map(stringValue).filter(Boolean) : [],
        currentAddress: stringValue(candidate.currentAddress),
        addressHistory: Array.isArray(candidate.addressHistory) ? structuredClone(candidate.addressHistory) : [],
        addressHistoryDetails: Array.isArray(candidate.addressHistoryDetails) ? structuredClone(candidate.addressHistoryDetails) : [],
        reviewStatus,
      },
      confidence: Number.isFinite(Number(candidate.confidence)) ? Number(candidate.confidence) / (Number(candidate.confidence) > 1 ? 100 : 1) : 0,
      reviewFlags: reviewStatus === "accepted" || reviewStatus === "promoted" ? ["HUMAN_REVIEW_REQUIRED"] : ["IDI_ASSET_SEARCH_REVIEW_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
      ...(stringValue(attachment.artifactUrl) ? { sourceUrl: stringValue(attachment.artifactUrl) } : {}),
      attachment: {
        label: stringValue(attachment.fileName) || "Persisted IDI report",
        fileKind: stringValue((isRecord(record.extraction) ? record.extraction : {}).fileKind) || "text",
        contentHash: stringValue(attachment.contentHash),
        readbackStatus: stringValue(attachment.readbackStatus),
      },
    };
    facts.push(fact);
    references.push(evidenceReference("skip_trace_parse", fact, sourceLocator));
  }
  if (!facts.length) {
    return completed(
      "skip_trace_parse",
      "review_required",
      "The persisted IDI report is verified but contains no parsed contact facts.",
      [],
      [],
      "Review the report extraction and re-import the selected file if contact facts are present.",
    );
  }
  return completed(
    "skip_trace_parse",
    "succeeded",
    "Parsed the verified persisted IDI report. Exact stored facts were preserved and unknown fields remain blank.",
    facts,
    references,
  );
}

function sourceStatusValue(facts: SourceFact[]): JsonRecord {
  const sourceStatus = facts.find((fact) => fact.factType === "source_status");
  return isRecord(sourceStatus?.value) ? sourceStatus.value : {};
}

async function obituaryStage(input: DocPrepStageInput, env: DocPrepStageEnv, dependencies: DocPrepStageDependencies): Promise<DocPrepStageOutput> {
  let sourceFacts: SourceFact[];
  try {
    sourceFacts = await fetchMarriageDeathIndicatorFacts(input.caseId, intakeSeed(input), runtimeEnv(env));
  } catch {
    return systemFailure(input, env, dependencies, "failed", "obituary_provider_failed", "browserbase", "The obituary and vital-record workflow failed.", "Retry after the configured obituary provider is healthy.");
  }
  const facts = sourceFacts.map(factFromSourceFact);
  const evidence = evidenceFromFacts("obituary_search", facts);
  const status = sourceStatusValue(sourceFacts);
  const mode = stringValue(status.mode);
  if (mode === "workflow_required") {
    return systemFailure(input, env, dependencies, "blocked", "obituary_workflow_not_configured", "browserbase", "The obituary and vital-record workflow is not configured.", "Configure the approved obituary workflow and retry.", facts);
  }
  if (mode === "workflow_failed") {
    return systemFailure(input, env, dependencies, "failed", "obituary_provider_failed", "browserbase", "The obituary and vital-record provider returned a failure.", "Retry after the configured obituary provider is healthy.", facts);
  }
  if (!evidence.length) {
    return completed("obituary_search", "review_required", "The obituary workflow completed without source-backed obituary or vital facts.", facts, [], "Review the configured obituary sources and record a source-backed result or reviewed-not-found note.");
  }
  return completed("obituary_search", "succeeded", "The obituary workflow returned source-backed facts for review.", facts, evidence);
}

async function clerkStage(
  stageId: "deed_title_search" | "court_records_search",
  input: DocPrepStageInput,
  env: DocPrepStageEnv,
  dependencies: DocPrepStageDependencies,
): Promise<DocPrepStageOutput> {
  let sourceFacts: SourceFact[];
  const provider = "miami_dade_clerk";
  try {
    sourceFacts = stageId === "deed_title_search"
      ? await fetchOfficialRecordsCommercialApiFacts(input.caseId, intakeSeed(input), { env: runtimeEnv(env), fetchImpl: dependencies.fetcher })
      : await fetchCivilProbateCommercialApiFacts(input.caseId, intakeSeed(input), { env: runtimeEnv(env), fetchImpl: dependencies.fetcher });
  } catch {
    return systemFailure(input, env, dependencies, "failed", `${stageId}_provider_failed`, provider, "The Clerk provider request failed.", "Retry after the Clerk provider is healthy.");
  }
  const facts = sourceFacts.map(factFromSourceFact);
  const evidence = evidenceFromFacts(stageId, facts);
  const status = sourceStatusValue(sourceFacts);
  const mode = stringValue(status.mode);
  if (mode === "commercial_api_key_required") {
    return systemFailure(input, env, dependencies, "blocked", `${stageId}_credential_missing`, provider, "The Clerk commercial API credential is not configured.", "Configure the approved Clerk credential and retry.", facts);
  }
  if (mode === "commercial_api_input_required") {
    return completed(stageId, "review_required", "The Clerk stage needs a source identifier from the selected estate.", facts, [], stageId === "deed_title_search" ? "Add the estate folio or official-record reference and retry." : "Add the probate, civil, or family case reference and retry.");
  }
  if (status.ok !== true) {
    return systemFailure(input, env, dependencies, "failed", `${stageId}_provider_failed`, provider, "The Clerk commercial API returned no usable response.", "Retry after the Clerk provider is healthy.", facts);
  }
  if (!evidence.length) {
    return completed(stageId, "review_required", "The Clerk request completed without source-backed record facts.", facts, [], "Review the official Clerk record and capture the verified reference before continuing.");
  }
  return completed(stageId, "succeeded", "The Clerk commercial API returned source-backed record facts for review.", facts, evidence);
}

function taxFact(
  input: DocPrepStageInput,
  dependencies: DocPrepStageDependencies,
  factType: string,
  value: unknown,
  sourceUrl?: string,
): DocPrepStageFact {
  return {
    source: "tax_collector",
    rawId: `${input.estate.estateId}:${factType}`,
    fetchedAt: now(dependencies),
    factType,
    value: blankUnknowns(value),
    confidence: hasKnownValue(value) ? 0.85 : 0,
    reviewFlags: hasKnownValue(value) ? ["HUMAN_REVIEW_REQUIRED"] : ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    ...(sourceUrl ? { sourceUrl } : {}),
  };
}

function taxFacts(
  input: DocPrepStageInput,
  dependencies: DocPrepStageDependencies,
  acquisition: TaxCollectorReceiptAcquisitionResult,
  attachment: Awaited<ReturnType<typeof verifyTaxCollectorReceiptAttachment>> | null,
): DocPrepStageFact[] {
  const details: TaxCollectorDetails = attachment?.details || acquisition.discovery?.details || {};
  const receiptUrl = attachment?.finalUrl || acquisition.discovery?.receiptUrl || "";
  return [
    taxFact(input, dependencies, "tax_receipt_status", {
      mode: acquisition.mode,
      status: acquisition.status ?? "",
      attachmentVerified: attachment?.ok === true,
      attachmentGate: attachment?.error || "verified",
    }, receiptUrl || acquisition.finalUrl),
    taxFact(input, dependencies, "tax_receipt_link", receiptUrl, receiptUrl),
    taxFact(input, dependencies, "tax_receipt_attachment", attachment?.ok ? {
      contentType: attachment.contentType || "",
      bytes: attachment.bytes ?? "",
      sha256: attachment.sha256 || "",
      finalUrl: attachment.finalUrl || "",
    } : "", receiptUrl),
    taxFact(input, dependencies, "tax_last_paid_by", details.paidBy || "", receiptUrl),
    taxFact(input, dependencies, "tax_payer_identity", details.payerIdentity || "", receiptUrl),
    taxFact(input, dependencies, "tax_paid_date", details.paidDate || "", receiptUrl),
    taxFact(input, dependencies, "unpaid_tax_years", details.unpaidYears || [], receiptUrl),
    taxFact(input, dependencies, "tax_amount_due", details.amountDue || "", receiptUrl),
    taxFact(input, dependencies, "tax_reassessment_signal", details.reassessment || "", receiptUrl),
  ];
}

async function taxStage(input: DocPrepStageInput, env: DocPrepStageEnv, dependencies: DocPrepStageDependencies): Promise<DocPrepStageOutput> {
  let acquisition: TaxCollectorReceiptAcquisitionResult;
  try {
    acquisition = await acquireTaxCollectorReceipt({
      parcelId: input.estate.parcelId,
      propertyAddress: input.estate.address,
      ownerName: input.estate.owner || input.estate.name,
    }, { env: runtimeEnv(env), fetchImpl: dependencies.fetcher });
  } catch {
    return systemFailure(input, env, dependencies, "failed", "tax_collector_provider_failed", "tax_collector", "The Tax Collector provider request failed.", "Retry after the Tax Collector source is healthy.");
  }
  if (!acquisition.ok || !acquisition.discovery?.receiptUrl) {
    const facts = taxFacts(input, dependencies, acquisition, null);
    if (acquisition.mode === "listing_page_no_receipt") {
      return completed("tax_receipt_fetch", "review_required", "The Tax Collector listing loaded without a verified receipt attachment.", facts, [], "Review the listing and capture the bottom-right receipt link before continuing.");
    }
    if (acquisition.mode === "not_configured" || acquisition.mode === "browser_workflow_required") {
      return systemFailure(input, env, dependencies, "blocked", `tax_collector_${acquisition.mode}`, "tax_collector", "The bounded Tax Collector workflow is not available for this estate.", "Configure the approved Tax Collector workflow and retry.", facts);
    }
    return systemFailure(input, env, dependencies, "failed", `tax_collector_${acquisition.mode}`, acquisition.mode.startsWith("browserbase") ? "browserbase" : "tax_collector", "The Tax Collector provider failed before a receipt was verified.", "Retry after the provider or deployment issue is resolved.", facts);
  }
  let attachment: Awaited<ReturnType<typeof verifyTaxCollectorReceiptAttachment>>;
  try {
    attachment = await verifyTaxCollectorReceiptAttachment(acquisition.discovery.receiptUrl, { env: runtimeEnv(env), fetchImpl: dependencies.fetcher });
  } catch {
    return systemFailure(input, env, dependencies, "failed", "tax_receipt_attachment_fetch_failed", "tax_collector", "The Tax Collector receipt attachment could not be verified.", "Retry after the Tax Collector source is healthy.", taxFacts(input, dependencies, acquisition, null));
  }
  const facts = taxFacts(input, dependencies, acquisition, attachment);
  if (!attachment.ok) {
    if (attachment.error === "timed_out" || attachment.error === "fetch_failed") {
      return systemFailure(input, env, dependencies, "failed", `tax_receipt_attachment_${attachment.error}`, "tax_collector", "The Tax Collector receipt attachment could not be fetched.", "Retry after the Tax Collector source is healthy.", facts);
    }
    return completed("tax_receipt_fetch", "review_required", "The Tax Collector receipt did not pass the bounded origin, redirect, byte, content, or signature gate.", facts, [], "Review the receipt source and attach a verified county receipt before continuing.");
  }
  const evidence = evidenceFromFacts("tax_receipt_fetch", facts);
  return completed("tax_receipt_fetch", "succeeded", "The Tax Collector receipt passed origin, redirect, byte, review, and attachment verification gates.", facts, evidence);
}

function agenticContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!Array.isArray(value)) return "";
  return value.flatMap((item) => isRecord(item) && typeof item.text === "string" ? [item.text] : []).join("").trim();
}

function extractedEvidence(input: DocPrepStageInput): Array<{ id: string; reference: DocPrepEvidenceReference; text: string }> {
  const output: Array<{ id: string; reference: DocPrepEvidenceReference; text: string }> = [];
  for (const prior of input.priorStageOutputs) {
    for (const reference of prior.evidenceReferences) {
      if (typeof reference === "string") {
        const id = createHash("sha256").update(`${prior.stageId}\u0000${reference}`).digest("hex");
        output.push({ id, reference, text: reference });
        continue;
      }
      if (!hasKnownValue(reference.value)) continue;
      output.push({
        id: reference.id,
        reference,
        text: JSON.stringify({ source: reference.source, factType: reference.factType, value: reference.value, sourceUrl: reference.sourceUrl || "" }),
      });
    }
  }
  return output.slice(0, 256);
}

function safeSensitiveTokens(value: string): string[] {
  const patterns = [
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g,
    /\b(?:0?[1-9]|1[0-2])[\/-](?:0?[1-9]|[12]\d|3[01])[\/-](?:19|20)\d{2}\b/g,
    /\$\s?\d[\d,]*(?:\.\d{2})?/g,
    /https?:\/\/[^\s)]+/gi,
  ];
  return Array.from(new Set(patterns.flatMap((pattern) => value.match(pattern) || []).map((token) => token.toLowerCase())));
}

function groundingTokens(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || []).filter((token) => token.length >= 3);
}

function strictlyGrounded(summary: string, reviewBoundary: string, evidence: Array<{ text: string }>): boolean {
  const source = evidence.map((item) => item.text).join("\n").toLowerCase();
  if (!safeSensitiveTokens(`${summary}\n${reviewBoundary}`).every((token) => source.includes(token))) return false;
  const sourceTokens = new Set(groundingTokens(source));
  const summaryVocabulary = new Set([
    "and", "are", "from", "has", "have", "human", "its", "listed", "lists", "only", "record", "records",
    "remains", "report", "require", "requires", "review", "reviewed", "source", "sources", "states", "the", "this", "under",
    "verified", "with",
  ]);
  const boundaryVocabulary = new Set([
    ...summaryVocabulary,
    "addresses", "confirmation", "contact", "dates", "details", "identity", "legal", "ownership", "relationship",
    "relationships", "required", "status",
  ]);
  return groundingTokens(summary).every((token) => sourceTokens.has(token) || summaryVocabulary.has(token))
    && groundingTokens(reviewBoundary).every((token) => sourceTokens.has(token) || boundaryVocabulary.has(token));
}

function strictBackstoryJson(value: string, evidenceIds: Set<string>): { summary: string; reviewBoundary: string; evidenceReferenceIds: string[] } | null {
  try {
    const parsed = JSON.parse(value) as JsonRecord;
    if (!exactKeys(parsed, ["summary", "reviewBoundary", "evidenceReferenceIds"])) return null;
    const summary = stringValue(parsed.summary);
    const reviewBoundary = stringValue(parsed.reviewBoundary);
    if (!summary || summary.length > 8_000 || !reviewBoundary || reviewBoundary.length > 2_000 || !Array.isArray(parsed.evidenceReferenceIds)) return null;
    const ids = parsed.evidenceReferenceIds.map(stringValue);
    if (!ids.length || ids.length > 256 || ids.some((id) => !id || !evidenceIds.has(id)) || new Set(ids).size !== ids.length) return null;
    return { summary, reviewBoundary, evidenceReferenceIds: ids };
  } catch {
    return null;
  }
}

async function backstoryStage(input: DocPrepStageInput, env: DocPrepStageEnv, dependencies: DocPrepStageDependencies): Promise<DocPrepStageOutput> {
  const evidence = extractedEvidence(input);
  if (!evidence.length) {
    return completed("backstory_generate", "review_required", "No source-backed prior-stage evidence is available for a backstory.", [], [], "Complete and review at least one source stage before generating the backstory.");
  }
  const apiKey = stringValue(env.NOUS_API_KEY);
  if (!apiKey) {
    return systemFailure(input, env, dependencies, "blocked", "nous_credential_missing", "nous", "The Nous credential is not configured.", "Configure the approved Nous credential and retry.");
  }
  const fetcher = dependencies.fetcher ?? fetch;
  const credential = await getServerNousCredential({
    fetcher,
    apiKey,
    baseUrl: stringValue(env.NOUS_BASE_URL) || undefined,
    configuredModel: stringValue(env.NOUS_MODEL) || null,
  });
  if (!credential || !credential.verifiedFreeModels.length) {
    return systemFailure(input, env, dependencies, "failed", "nous_catalog_unavailable", "nous", "The Nous free-model catalog could not be verified.", "Retry after the Nous catalog and credential are healthy.");
  }
  const configuredModel = stringValue(env.NOUS_MODEL);
  if (configuredModel && configuredModel !== nousDynamicModelId && !credential.verifiedFreeModels.includes(configuredModel)) {
    return systemFailure(input, env, dependencies, "failed", "nous_model_not_verified_free", "nous", "The configured Nous model is not in the verified free-model catalog.", "Select a catalog-verified free model and retry.");
  }
  if (!credential.verifiedFreeModels.includes(credential.model)) {
    return systemFailure(input, env, dependencies, "failed", "nous_model_not_verified_free", "nous", "The selected Nous model is not in the verified free-model catalog.", "Refresh the free-model catalog and retry.");
  }
  const prompt = [
    "Summarize only the supplied verified evidence for an internal estate backstory.",
    "Do not infer relationships, identity, dates, addresses, ownership, legal status, contact details, or missing values.",
    "Omit blank values. Preserve every name, number, date, address, URL, and status exactly as supplied.",
    "Return strict JSON with exactly these keys: summary, reviewBoundary, evidenceReferenceIds.",
    "evidenceReferenceIds must contain only IDs from the evidence below and must identify every reference used.",
    ...evidence.map((item) => `${item.id}: ${item.text}`),
  ].join("\n").slice(0, 100_000);
  let response: Response;
  try {
    response = await fetcher(`${credential.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${credential.credential}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: credential.model,
        messages: [
          { role: "system", content: "You format existing evidence only. You never research, infer, reconcile, or fill blanks." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
        max_tokens: 1_000,
      }),
      redirect: "error",
    });
  } catch {
    return systemFailure(input, env, dependencies, "failed", "nous_provider_failed", "nous", "The Nous provider request failed.", "Retry after the Nous provider is healthy.");
  }
  if (!response.ok) {
    return systemFailure(input, env, dependencies, "failed", "nous_provider_failed", "nous", "The Nous provider returned a failure.", "Retry after the Nous provider is healthy.");
  }
  let payload: JsonRecord;
  try {
    const parsed = await response.json();
    if (!isRecord(parsed)) throw new Error("invalid_payload");
    payload = parsed;
  } catch {
    return systemFailure(input, env, dependencies, "failed", "nous_response_json_invalid", "nous", "The Nous provider response was not valid JSON.", "Retry after the Nous provider returns strict JSON.");
  }
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const first = isRecord(choices[0]) ? choices[0] : {};
  const message = isRecord(first.message) ? first.message : {};
  const parsed = strictBackstoryJson(agenticContent(message.content), new Set(evidence.map((item) => item.id)));
  if (!parsed) {
    return systemFailure(input, env, dependencies, "failed", "nous_strict_json_failed", "nous", "The Nous response failed the strict backstory JSON contract.", "Retry after the Nous provider returns the required strict JSON.");
  }
  if (!strictlyGrounded(parsed.summary, parsed.reviewBoundary, evidence)) {
    return systemFailure(input, env, dependencies, "failed", "nous_grounding_validation_failed", "nous", "The Nous response introduced a value that was not present in the verified evidence.", "Review the evidence and retry without inferred values.");
  }
  const selected = evidence.filter((item) => parsed.evidenceReferenceIds.includes(item.id));
  const facts: DocPrepStageFact[] = [
    {
      source: "nous",
      rawId: `${input.caseId}:backstory`,
      fetchedAt: now(dependencies),
      factType: "backstory",
      value: parsed.summary,
      confidence: 1,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
      evidenceReferenceIds: [...parsed.evidenceReferenceIds],
    },
    {
      source: "nous",
      rawId: `${input.caseId}:backstory-review-boundary`,
      fetchedAt: now(dependencies),
      factType: "backstory_review_boundary",
      value: parsed.reviewBoundary,
      confidence: 1,
      reviewFlags: ["HUMAN_REVIEW_REQUIRED"],
      evidenceReferenceIds: [...parsed.evidenceReferenceIds],
    },
  ];
  return completed("backstory_generate", "succeeded", "Nous summarized only catalog-verified, source-backed evidence. Human review remains required.", facts, selected.map((item) => structuredClone(item.reference)));
}

export async function executeDocPrepStage(
  stageId: DocPrepStageId,
  input: DocPrepStageInput,
  env: DocPrepStageEnv,
  dependencies: DocPrepStageDependencies = {},
): Promise<DocPrepStageOutput> {
  if (stageId === "skip_trace_parse") return skipTraceParseStage(input, env, dependencies);
  if (stageId === "obituary_search") return obituaryStage(input, env, dependencies);
  if (stageId === "deed_title_search") return clerkStage(stageId, input, env, dependencies);
  if (stageId === "tax_receipt_fetch") return taxStage(input, env, dependencies);
  if (stageId === "court_records_search") return clerkStage(stageId, input, env, dependencies);
  return backstoryStage(input, env, dependencies);
}
