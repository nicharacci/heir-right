// [claude-code 2026-05-15] Canonical data types for Probate Lead Engine

export type SourceKey =
  | "clerk_of_courts"
  | "property_appraiser"
  | "probate_court"
  | "tax_collector"
  | "skip_trace"
  | "official_records"
  | "podio"
  | "intake"
  | "document_packet";

export type CaseType = "probate" | "tax_delinquent" | "foreclosure" | "other";

export type ContactRole = "heir" | "executor" | "attorney" | "owner" | "other";

export type SyncStatus = "pending" | "synced" | "failed";

export interface Contact {
  role: ContactRole;
  name: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  confidence: number; // 0-1 from the source that produced or confirmed the contact
}

export interface ScoreReason {
  code: string; // e.g., "HIGH_EQUITY", "EARLY_PROBATE", "CONTACTABLE"
  weight: number;
  note: string;
}

export interface SourceRef {
  source: SourceKey;
  rawId: string;
  fetchedAt: string; // ISO date
}

export interface LeadScore {
  value: number; // 0-100
  reasons: ScoreReason[];
  model: string;
  scoredAt: string; // ISO date
}

export interface Lead {
  id: string; // ULID
  sourceRefs: SourceRef[];
  owner: {
    name: string;
    aka?: string[];
  };
  property: {
    address: string;
    city: string;
    state: string;
    zip: string;
    parcelId: string; // dedupe key #1
    county: string;
    lat?: number;
    lng?: number;
  };
  case?: {
    caseNumber: string; // dedupe key #2
    caseType: CaseType;
    filingDate: string; // ISO date
    stage?: string;
  };
  heirs: Contact[];
  enrichment: {
    equityEstimate?: number;
    assessedValue?: number;
    lastSaleDate?: string;
    skipTraceProvider?: string;
    skipTraceRunAt?: string;
  };
  score: LeadScore | null;
  sync: {
    crmLeadId?: string;
    lastSyncedAt?: string;
    syncStatus: SyncStatus;
  };
  createdAt: string;
  updatedAt: string;
}

export interface RawRecord {
  id: string;
  source: SourceKey;
  county: string;
  rawId: string;
  data: Record<string, unknown>;
  fetchedAt: string;
}

export interface Run {
  id: string; // ULID
  deploymentKey: string;
  county: string;
  dateRange: { start: string; end: string };
  sources: SourceKey[];
  status: "running" | "completed" | "failed" | "partial";
  leadCount: number;
  errorCount: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface DeadLetter {
  id: string;
  runId: string;
  source: SourceKey;
  rawId: string;
  error: string;
  retryCount: number;
  createdAt: string;
}

export interface SourceAdapter {
  key: SourceKey;
  fetch(input: {
    county: string;
    dateRange: { start: string; end: string };
    cursor?: string;
  }): Promise<{
    records: RawRecord[];
    nextCursor?: string;
    fetchedAt: string;
  }>;
  healthcheck(): Promise<{ ok: boolean; reason?: string }>;
}

export interface ScoreInput {
  lead: Omit<Lead, "score">;
}

export interface ScoreOutput {
  value: number;
  reasons: ScoreReason[];
}

export interface DeploymentConfig {
  key: string;
  counties: string[];
  enabledSources: SourceKey[];
  cronSchedule: string;
  crmProvider: "podio";
  skipTraceProvider: string;
  scoringModel: string;
  featureFlags: Record<string, boolean>;
}

export interface BetaAccessUser {
  email: string;
  name: string;
  picture: string | null;
  domain: string;
  mode: "oauth" | "disabled";
}

export interface BetaAuthSession {
  authenticated: boolean;
  user: BetaAccessUser | null;
  auth: {
    required: boolean;
    configured: boolean;
    allowedDomains: string[];
    allowedEmails: string[];
  };
}

export interface DailyRunConfig {
  counties: string[];
  targetRawLeadRange: { min: number; max: number };
  targetQualifiedLeadRange: { min: number; max: number };
  seeds: IntakeSeed[];
  seedSource: "configured_batch" | "default_review_seeds" | "manual";
  seedBatch?: SeedBatchSummary;
  startedBy: "automation" | "operator_cli";
}

export interface SeedBatchSummary {
  batchId: string;
  sourceLabel: string;
  sourceOwner: string;
  approvalMarker: string;
  seedCount: number;
  acceptedSeedCount: number;
  rejectedSeedCount: number;
  duplicateCount: number;
  counties: string[];
  inputPath?: string;
}

export type SeedValidationSeverity = "error" | "warning";

export interface SeedValidationIssue {
  severity: SeedValidationSeverity;
  code: string;
  message: string;
  seedIndex?: number;
}

export interface SeedValidationReport {
  ok: boolean;
  generatedAt: string;
  batch: SeedBatchSummary;
  issues: SeedValidationIssue[];
  acceptedSeeds: IntakeSeed[];
  rejectedSeeds: Array<{ seed: IntakeSeed; issues: SeedValidationIssue[] }>;
  operatorSummary: string;
  nextActions: string[];
}

export type SourceCoverageAreaKey = "property" | "tax" | "deed_title" | "probate" | "family_tree_offer";
export type SourceCoverageAreaStatus = "extracted" | "partial" | "blocked";

export interface SourceCoverageArea {
  key: SourceCoverageAreaKey;
  label: string;
  status: SourceCoverageAreaStatus;
  extractedFields: string[];
  missingFields: string[];
  nextAction: string;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface SourceCoverageProfile {
  status: SourceCoverageAreaStatus;
  checkedAt: string;
  extractedAreaCount: number;
  partialAreaCount: number;
  blockedAreaCount: number;
  extractedFieldCount: number;
  missingFieldCount: number;
  areas: SourceCoverageArea[];
}

export interface SourceCoverageSummary {
  status: SourceCoverageAreaStatus;
  leadCount: number;
  extractedAreaCount: number;
  partialAreaCount: number;
  blockedAreaCount: number;
  extractedFieldCount: number;
  missingFieldCount: number;
  areaStatuses: Array<{ key: SourceCoverageAreaKey; label: string; extracted: number; partial: number; blocked: number }>;
}

export type QualificationDecisionStatus = "qualified" | "review" | "disqualified" | "duplicate" | "dead_letter";

export interface QualificationCoverageScore {
  area: SourceCoverageAreaKey;
  label: string;
  status: SourceCoverageAreaStatus;
  weight: number;
  earned: number;
  reasonCode: string;
  nextAction: string;
}

export interface QualificationDecision {
  status: Exclude<QualificationDecisionStatus, "duplicate" | "dead_letter">;
  label: string;
  promotionEligible: boolean;
  coverageScore: number;
  requiredCoverageScore: number;
  sourceCoverageStatus: SourceCoverageAreaStatus;
  evidenceSummary: string;
  reasonCodes: string[];
  blockers: string[];
  nextAction: string;
  coverage: QualificationCoverageScore[];
  reviewedAt: string;
}

export interface DailyDuplicateLeadResult {
  dedupeKey: string;
  county: string;
  runId: string;
  displayName: string;
  originalRunId?: string;
  reason: string;
  nextAction: string;
}

export interface QualificationReviewRecord {
  status: QualificationDecisionStatus;
  dedupeKey: string;
  county: string;
  runId: string;
  displayName: string;
  qualified: boolean;
  leadBucket?: LeadBucket;
  workflowStatus?: WorkflowRuleStatus;
  operatorQueueState?: OperatorQueueState;
  coverageScore?: number;
  requiredCoverageScore?: number;
  reasonCodes: string[];
  blockers: string[];
  nextAction: string;
  reportId?: string;
}

export interface QualificationReviewPacket {
  id: string;
  runId: string;
  generatedAt: string;
  operatorSummary: string;
  settings: {
    model: LeadQualitySettings["model"];
    requiredCoverageScore: number;
    minEnabledSignalWeightForPromotion: number;
    evidenceGatesCannotBeWeakened: boolean;
    enabledSignals: string[];
    reasonCodes: string[];
  };
  summary: {
    totalRecords: number;
    qualified: number;
    review: number;
    disqualified: number;
    duplicate: number;
    deadLetter: number;
    blockedFromPromotion: number;
  };
  sourceCoverageSummary: SourceCoverageSummary;
  records: QualificationReviewRecord[];
  samples: {
    qualified: QualificationReviewRecord[];
    review: QualificationReviewRecord[];
    disqualified: QualificationReviewRecord[];
    duplicate: QualificationReviewRecord[];
    deadLetter: QualificationReviewRecord[];
  };
  nextActions: string[];
}

export interface DailyLeadResult {
  dedupeKey: string;
  county: string;
  runId: string;
  displayName: string;
  status: RawDossier["status"];
  workflowStatus: WorkflowRuleStatus;
  operatorQueueState: OperatorQueueState;
  leadBucket: LeadBucket;
  qualified: boolean;
  blockers: string[];
  reportId?: string;
  sourceCoverage: SourceCoverageProfile;
  qualificationDecision: QualificationDecision;
}

export interface DailyRunResult {
  id: string;
  generatedAt: string;
  config: DailyRunConfig;
  rawLeadCount: number;
  qualifiedLeadCount: number;
  reviewLeadCount: number;
  duplicateCount: number;
  errorCount: number;
  leads: DailyLeadResult[];
  duplicates: DailyDuplicateLeadResult[];
  deadLetters: DeadLetter[];
  missedVolumeReasons: string[];
  blockers: string[];
  sourceCoverageSummary: SourceCoverageSummary;
  qualificationReview: QualificationReviewPacket;
}

export type ExportRoute = "google" | "podio";

export interface ExportRequest {
  routes: ExportRoute[];
  dossier: RawDossier;
  dryRun?: boolean;
}

export interface ExportRouteResult {
  route: ExportRoute;
  ok: boolean;
  mode: "live" | "dry_run" | "blocked";
  externalId?: string;
  url?: string;
  readbackOk: boolean;
  blockers: string[];
  message: string;
}

export interface ExportResult {
  ok: boolean;
  generatedAt: string;
  dossierId: string;
  routes: ExportRouteResult[];
  blockers: string[];
}

export interface ConnectionStatus {
  name: "Podio" | "Google" | "Web Search";
  ok: boolean;
  mode: "live" | "dry_run" | "blocked";
  message: string;
  checkedAt: string;
}

export type ReadbackRouteStatus = "passed" | "blocked" | "prepared_only";

export interface ReadbackRouteEvidence {
  route: ExportRoute;
  label: string;
  status: ReadbackRouteStatus;
  mode: ExportRouteResult["mode"];
  prepared: boolean;
  liveWriteAttempted: boolean;
  createdRecord: boolean;
  externalId?: string;
  url?: string;
  readbackOk: boolean;
  verification: {
    record: string;
    reportBody: string;
    trackingRow: string;
    reviewTask: string;
    cleanup: string;
  };
  blockers: string[];
  nextAction: string;
  checkedAt: string;
}

export interface ReadbackEvidencePacket {
  id: string;
  generatedAt: string;
  overallStatus: "passed" | "blocked";
  operatorSummary: string;
  routes: ReadbackRouteEvidence[];
  blockers: string[];
  cleanupNotes: string[];
  nextActions: string[];
}

export type MilestoneEvidenceGateStatus = "passed" | "review_required" | "blocked";

export interface MilestoneEvidenceGate {
  id: string;
  label: string;
  status: MilestoneEvidenceGateStatus;
  evidence: string;
  nextAction: string;
  blockers: string[];
}

export interface ThirtyDayMilestoneEvidence {
  milestone: "30-Day Workflow Automation Milestone";
  generatedAt: string;
  overallStatus: "ready_for_human_review" | "blocked";
  operatorSummary: string;
  dailyRun: {
    id: string;
    seedSource: DailyRunConfig["seedSource"];
    counties: string[];
    rawLeadCount: number;
    rawLeadTarget: DailyRunConfig["targetRawLeadRange"];
    qualifiedLeadCount: number;
    qualifiedLeadTarget: DailyRunConfig["targetQualifiedLeadRange"];
    reviewLeadCount: number;
    duplicateCount: number;
    errorCount: number;
    missedVolumeReasons: string[];
    seedBatch?: SeedBatchSummary;
    sourceCoverageSummary: SourceCoverageSummary;
    qualificationReviewSummary: QualificationReviewPacket["summary"];
  };
  exportReadiness: {
    connectionStatuses: ConnectionStatus[];
    dryRunRoutes: ExportRouteResult[];
    readbackEvidence: ReadbackEvidencePacket;
  };
  gates: MilestoneEvidenceGate[];
  blockers: string[];
  nextActions: string[];
}

export type ReviewFlag =
  | "SOURCE_BLOCKED"
  | "SOURCE_HEALTH_ONLY"
  | "MISSING_PROPERTY_FACT"
  | "MISSING_TITLE_FACT"
  | "MISSING_TAX_FACT"
  | "MISSING_PROBATE_FACT"
  | "MISSING_OWNER_FACT"
  | "MISSING_OWNER_TYPE_FACT"
  | "MISSING_MAILING_ADDRESS_FACT"
  | "MISSING_DEED_FACT"
  | "MISSING_OR_BOOK_PAGE_FACT"
  | "MISSING_RECENT_SALE_FACT"
  | "MISSING_ADVERSE_POSSESSION_FACT"
  | "MISSING_LEAD_QUALITY_SIGNAL"
  | "MISSING_ESTATE_NAME_FACT"
  | "MISSING_TAX_HISTORY_FACT"
  | "MISSING_TAX_RECEIPT_FACT"
  | "MISSING_TAX_PAYER_FACT"
  | "SOURCE_EVIDENCE_REQUIRED"
  | "MANUAL_TAX_RECEIPT_DOWNLOAD_REQUIRED"
  | "REASSESSMENT_REVIEW_REQUIRED"
  | "MISSING_CRM_CREDENTIALS"
  | "MISSING_DOCUMENT_TEMPLATE"
  | "HUMAN_REVIEW_REQUIRED"
  | "NO_ENRICHMENT_RUN"
  | "MISSING_AFFIDAVIT_OF_HEIRS_FACT"
  | "PROBATE_DOCUMENT_REQUEST_REQUIRED"
  | "MISSING_MARRIAGE_DEATH_FACT"
  | "MANUAL_DEATH_CERTIFICATE_REQUIRED"
  | "PAID_SOURCE_APPROVAL_REQUIRED"
  | "MANUAL_SOURCE_APPROVAL_REQUIRED"
  | "STORAGE_APPROVAL_REQUIRED"
  | "MISSING_OFFER_MATH_FACT"
  | "UNDERWRITING_REVIEW_REQUIRED"
  | "OUTREACH_BLOCKED"
  | "REPORT_REVIEW_REQUIRED"
  | "SCRIPT_REVIEW_REQUIRED"
  | "COMPLIANCE_REVIEW_REQUIRED"
  | "CONTACT_REVIEW_REQUIRED"
  | "LIVE_OUTREACH_DISABLED"
  | "NO_AUTO_SEND_GUARD";

export type FactType =
  | "source_status"
  | "source_search_url"
  | "property_address"
  | "property_owner"
  | "property_folio"
  | "property_county"
  | "owner_type"
  | "mailing_address_signal"
  | "tax_history_status"
  | "unpaid_tax_years"
  | "tax_amount_due"
  | "tax_reassessment_signal"
  | "tax_receipt_status"
  | "tax_payer_identity"
  | "deed_history_status"
  | "latest_deed"
  | "or_book_page"
  | "last_sale_date"
  | "ownership_activity_note"
  | "mortgage_signal"
  | "lien_signal"
  | "lis_pendens_signal"
  | "foreclosure_signal"
  | "adverse_possession_signal"
  | "lead_quality_signal"
  | "title_signal"
  | "official_records_status"
  | "podio_payload"
  | "document_output"
  | "intake_seed"
  | "estate_name"
  | "estate_search_key"
  | "case_number"
  | "probate_docket_status"
  | "probate_case_status"
  | "civil_family_docket_ref"
  | "affidavit_of_heirs_status"
  | "probate_document_availability"
  | "official_record_cross_link"
  | "marriage_death_status"
  | "marriage_license_signal"
  | "date_of_birth"
  | "date_of_death"
  | "obituary_link"
  | "memorial_search_placeholder"
  | "death_certificate_status"
  | "incarceration_status_signal"
  | "family_tree_status"
  | "family_tree_hypothesis"
  | "source_governance_catalog"
  | "offer_as_is_value"
  | "offer_heir_count"
  | "offer_buy_percentage"
  | "offer_minimum_net_profit";

export interface SourceSubject {
  ownerName?: string;
  propertyAddress?: string;
  parcelId?: string;
  caseNumber?: string;
  estateName?: string;
  county?: string;
}

export interface SourceFact {
  id: string;
  runId: string;
  source: SourceKey;
  rawId: string;
  fetchedAt: string;
  county: string;
  subject: SourceSubject;
  factType: FactType;
  value: unknown;
  confidence: number;
  sourceUrl?: string;
  reviewFlags: ReviewFlag[];
}

export interface DossierClaim<T = unknown> {
  value: T | null;
  confidence: number;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface SourceEvidenceReviewTask {
  code: string;
  title: string;
  source: SourceKey;
  reason: string;
  nextAction: string;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface DossierEvent {
  id: string;
  label: string;
  date?: string;
  source: SourceKey;
  sourceRef: SourceRef;
  risk: "low" | "medium" | "high" | "unknown";
  explanation: string;
  reviewFlags: ReviewFlag[];
}

export type WorkflowRuleStatus = "continue" | "review_required" | "stop";

export type WorkflowRuleCode =
  | "OWNER_TYPE"
  | "RECENT_SALE"
  | "ADVERSE_POSSESSION"
  | "SOURCE_EVIDENCE"
  | "LEAD_QUALITY";

export interface WorkflowRuleResult {
  code: WorkflowRuleCode;
  label: string;
  status: WorkflowRuleStatus;
  explanation: string;
  reasonCodes: string[];
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface LeadQualitySignalSetting {
  code: string;
  label: string;
  enabled: boolean;
  weight: number;
  requiresSourceEvidence: boolean;
  reasonCode: string;
}

export interface LeadQualitySettings {
  model: "heirright-s5-v1";
  minEnabledSignalWeightForPromotion: number;
  genericPullSuppression: boolean;
  enabledSignals: string[];
  disabledSignals: string[];
  signals: LeadQualitySignalSetting[];
  reasonCodes: string[];
}

export interface WorkflowRuleEvaluation {
  status: WorkflowRuleStatus;
  evaluatedAt: string;
  nextAction: string;
  rules: WorkflowRuleResult[];
  leadQuality: LeadQualitySettings;
  reviewFlags: ReviewFlag[];
}

export interface TaxAmountDue {
  amount: number;
  currency: "USD";
  years: number[];
}

export interface TaxHistory {
  sourceStatus: DossierClaim<string>;
  unpaidYears: DossierClaim<number[]>;
  amountDue: DossierClaim<TaxAmountDue>;
  reassessment: DossierClaim<string>;
  receiptStatus: DossierClaim<string>;
  payerIdentity: DossierClaim<string>;
  reviewTasks: SourceEvidenceReviewTask[];
  manualReceiptTask: {
    required: boolean;
    reason: string;
    sourceRefs: SourceRef[];
    reviewFlags: ReviewFlag[];
  };
}

export interface OrBookPageRef {
  book?: string;
  page?: string;
  instrumentNumber?: string;
}

export interface LatestDeedRecord {
  recordingDate?: string;
  documentType?: string;
  orBookPage?: OrBookPageRef;
  grantor?: string;
  grantee?: string;
}

export interface DeedHistory {
  sourceStatus: DossierClaim<string>;
  latestDeed: DossierClaim<LatestDeedRecord>;
  orBookPage: DossierClaim<OrBookPageRef>;
  lastSaleDate: DossierClaim<string>;
  mailingAddressSignal: DossierClaim<string>;
  ownershipActivity: DossierClaim<string>;
  mortgageSignal: DossierClaim<string>;
  lienSignal: DossierClaim<string>;
  lisPendensSignal: DossierClaim<string>;
  foreclosureSignal: DossierClaim<string>;
  adversePossessionSignal: DossierClaim<boolean>;
  reviewTasks: SourceEvidenceReviewTask[];
}

export interface DocketReference {
  court?: string;
  division?: string;
  docketNumber?: string;
  caseType?: string;
}

export interface OfficialRecordCrossLink {
  label: string;
  url?: string;
  orBookPage?: OrBookPageRef;
  note?: string;
}

export interface ProbateDocket {
  sourceStatus: DossierClaim<string>;
  caseNumber: DossierClaim<string>;
  caseStatus: DossierClaim<string>;
  civilFamilyDocket: DossierClaim<DocketReference>;
  affidavitOfHeirs: DossierClaim<string>;
  documentAvailability: DossierClaim<string>;
  officialRecordCrossLinks: DossierClaim<OfficialRecordCrossLink[]>;
  reviewTasks: SourceEvidenceReviewTask[];
  documentRequestTask: {
    required: boolean;
    reason: string;
    sourceRefs: SourceRef[];
    reviewFlags: ReviewFlag[];
  };
}

export interface MemorialSearchPlaceholder {
  provider: "findagrave" | "legacy" | "google";
  query?: string;
  url?: string;
  note?: string;
}

export interface MarriageDeathIndicators {
  sourceStatus: DossierClaim<string>;
  marriageLicense: DossierClaim<string>;
  dateOfBirth: DossierClaim<string>;
  dateOfDeath: DossierClaim<string>;
  obituaryLink: DossierClaim<string>;
  memorialSearches: DossierClaim<MemorialSearchPlaceholder[]>;
  deathCertificateStatus: DossierClaim<string>;
  incarcerationStatus: DossierClaim<string>;
  reviewTasks: SourceEvidenceReviewTask[];
  deathCertificateTask: {
    required: boolean;
    reason: string;
    sourceRefs: SourceRef[];
    reviewFlags: ReviewFlag[];
  };
}

export type FamilyRelationshipRole =
  | "spouse"
  | "child"
  | "parent"
  | "sibling"
  | "grandparent"
  | "aunt_uncle"
  | "cousin"
  | "niece_nephew";

export interface FamilyTreeNode {
  id: string;
  role: FamilyRelationshipRole;
  name?: string;
  contactPlaceholder?: string;
  confidence: number;
  reviewStatus: "hypothesis" | "needs_review" | "reviewed";
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface FamilyTreeHypothesisData {
  status: "hypothesis" | "needs_review" | "reviewed";
  nodes: FamilyTreeNode[];
  unresolvedQuestions: string[];
}

export interface FamilyTreeHypothesis {
  sourceStatus: DossierClaim<string>;
  hypothesis: DossierClaim<FamilyTreeHypothesisData>;
  reviewTasks: SourceEvidenceReviewTask[];
}

export type SourceAccessClass = "public_automated" | "manual_approved" | "paid_approval_gated" | "blocked";

export interface GovernedSourceEntry {
  code: string;
  label: string;
  accessClass: SourceAccessClass;
  automationAllowed: boolean;
  storageApproved: boolean;
  reason: string;
  reviewFlags: ReviewFlag[];
}

export interface ManualResearchTask {
  code: string;
  title: string;
  description: string;
  accessClass: SourceAccessClass;
  reviewFlags: ReviewFlag[];
}

export interface SourceGovernanceCatalog {
  taxonomy: SourceAccessClass[];
  governedSources: GovernedSourceEntry[];
  manualTasks: ManualResearchTask[];
  auditNotes: string[];
}

export interface SourceGovernance {
  catalog: DossierClaim<SourceGovernanceCatalog>;
  reviewTasks: SourceEvidenceReviewTask[];
}

export type ReportReviewStatus = "internal_draft" | "pending_operator_review" | "reviewed" | "approved_internal_only";

export type UnderwritingReviewStatus = "not_started" | "draft" | "pending_review" | "reviewed";

export type DocumentReadinessStatus = "draft_only" | "pending_review" | "ready_internal";

export type OutreachReadinessStatus = "blocked" | "pending_review" | "ready_for_draft_outreach";

export type LeadBucket = "qualified" | "bonus_warm" | "generic_seed" | "disqualified" | "review_required";

export interface ReportReviewGate {
  reportStatus: ReportReviewStatus;
  underwritingStatus: UnderwritingReviewStatus;
  documentReadiness: DocumentReadinessStatus;
  outreachReadiness: OutreachReadinessStatus;
  externalUseBlocked: boolean;
  reviewerPlaceholder: string;
  approvalPlaceholder: string;
  reviewFlags: ReviewFlag[];
}

export type ComplianceReviewStatus = "draft" | "needs_compliance_review" | "approved_manual_use" | "retired" | "blocked";

export type OutreachAssetKind =
  | "unclassified_associate_call"
  | "neighbor_call"
  | "relative_call"
  | "owner_call"
  | "only_heir_call"
  | "closing_call"
  | "text_message"
  | "email"
  | "offer_letter";

export type OutreachChannel = "call" | "voicemail" | "text" | "email" | "letter";

export interface OutreachDraftAsset {
  id: string;
  kind: OutreachAssetKind;
  title: string;
  intendedUse: string;
  language: "en" | "es" | "mixed";
  channel: OutreachChannel;
  status: ComplianceReviewStatus;
  sourceDocument: string;
  body: string;
  reviewerPlaceholder: string;
  requiredDisclaimerPlaceholder: string;
  automationAllowed: boolean;
  externalUseAllowed: boolean;
  reviewFlags: ReviewFlag[];
}

export interface FollowUpTaskTemplate {
  id: string;
  title: string;
  channel: OutreachChannel;
  cadence: string;
  attemptNumber: number | null;
  window: "morning" | "afternoon" | "multi_day" | "manager_review";
  assignedRole: "operator" | "manager";
  manualOnly: boolean;
  description: string;
  reviewFlags: ReviewFlag[];
}

export interface OutreachReadinessEvaluation {
  status: OutreachReadinessStatus;
  evaluatedAt: string;
  blockers: string[];
  nextAction: string;
  reviewFlags: ReviewFlag[];
}

export interface NoAutoSendGuard {
  enabled: boolean;
  blockedActions: OutreachChannel[];
  reason: string;
  reviewFlags: ReviewFlag[];
}

export interface OutreachWorkflow {
  assets: OutreachDraftAsset[];
  complianceStatus: ComplianceReviewStatus;
  followUpTasks: FollowUpTaskTemplate[];
  readiness: OutreachReadinessEvaluation;
  noAutoSendGuard: NoAutoSendGuard;
  notes: string[];
}

export interface OfferProfitField {
  label: string;
  value: number | null;
  currency: "USD";
  confidence: number;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
  note?: string;
}

export interface OfferProfitMath {
  asIsValue: OfferProfitField;
  taxesDue: OfferProfitField;
  liens: OfferProfitField;
  mortgages: OfferProfitField;
  sellingCosts: OfferProfitField;
  probateCosts: OfferProfitField;
  partitionCosts: OfferProfitField;
  postEquityValue: OfferProfitField;
  heirCount: OfferProfitField;
  equityPerHeir: OfferProfitField;
  buyPercentage: OfferProfitField;
  offerAmount: OfferProfitField;
  profit: OfferProfitField;
  minimumNetProfit: OfferProfitField;
  computedAt: string;
  reviewFlags: ReviewFlag[];
}

export interface ResearchStepChecklistItem {
  code: string;
  label: string;
  status: "complete" | "partial" | "missing" | "not_applicable";
  note: string;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface ContactPlaceholderEntry {
  role: string;
  name?: string;
  phones: string[];
  emails: string[];
  addresses: string[];
  note: string;
  reviewFlags: ReviewFlag[];
}

export interface LeadQualityProfile {
  model: string;
  leadBucket: LeadBucket;
  enabledSignals: string[];
  missingSignals: string[];
  reasonCodes: string[];
  promotionEligible: boolean;
  reviewFlags: ReviewFlag[];
}

export interface CompletedLeadReport {
  id: string;
  dossierId: string;
  generatedAt: string;
  reviewGate: ReportReviewGate;
  backstory: string;
  researchChecklist: ResearchStepChecklistItem[];
  propertySummary: string;
  taxSummary: string;
  deedSummary: string;
  probateSummary: string;
  familyTreeSummary: string;
  contactPlaceholders: ContactPlaceholderEntry[];
  missingData: string[];
  sourceLinks: Array<{ label: string; url?: string; source: SourceKey }>;
  reviewFlags: ReviewFlag[];
  leadQualityProfile: LeadQualityProfile;
  offerMath: OfferProfitMath;
  formats: {
    markdown: string;
    html: string;
  };
}

export type OperatorQueueState = "ready_for_review" | "manual_review" | "blocked" | "disqualified";

export interface OperatorQueueItem {
  code: string;
  label: string;
  state: OperatorQueueState;
  reason: string;
  nextAction: string;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface OperatorQueue {
  state: OperatorQueueState;
  reasonCodes: string[];
  nextAction: string;
  items: OperatorQueueItem[];
}

export type SourceEvidenceQaStatus = "passed" | "review_required" | "failed";

export interface SourceEvidenceQaCheck {
  code: string;
  label: string;
  status: SourceEvidenceQaStatus;
  explanation: string;
  sourceRefs: SourceRef[];
  reviewFlags: ReviewFlag[];
}

export interface SourceEvidenceQaResult {
  status: SourceEvidenceQaStatus;
  checkedAt: string;
  checks: SourceEvidenceQaCheck[];
  reviewFlags: ReviewFlag[];
}

export interface RawDossier {
  id: string;
  runId: string;
  status: "draft" | "ready_for_review" | "blocked";
  generatedAt: string;
  summary: {
    displayName: string;
    estateName: string | null;
    estateSearchKey: string | null;
    caseNumber: string | null;
    priority: "review" | "low" | "medium" | "high";
    nextBestAction: string;
  };
  property: {
    address: DossierClaim<string>;
    ownerName: DossierClaim<string>;
    estateName: DossierClaim<string>;
    caseNumber: DossierClaim<string>;
    county: DossierClaim<string>;
    parcelId: DossierClaim<string>;
  };
  taxHistory: TaxHistory;
  deedHistory: DeedHistory;
  probateDocket: ProbateDocket;
  marriageDeathIndicators: MarriageDeathIndicators;
  familyTree: FamilyTreeHypothesis;
  sourceGovernance: SourceGovernance;
  outreach: OutreachWorkflow;
  titleEvents: DossierEvent[];
  workflow: WorkflowRuleEvaluation;
  operatorQueue: OperatorQueue;
  evidenceQa: SourceEvidenceQaResult;
  sourceCoverage: SourceCoverageProfile;
  qualificationDecision?: QualificationDecision;
  narrative: string;
  crm: {
    provider: "podio";
    mode: "dry_run" | "live";
    status: "not_configured" | "ready" | "synced" | "failed";
    payload?: unknown;
    reviewFlags: ReviewFlag[];
  };
  documentPacket?: DocumentPacket;
  completedLeadReport?: CompletedLeadReport;
  audit: {
    sourceRefs: SourceRef[];
    reviewFlags: ReviewFlag[];
    facts: SourceFact[];
  };
}

export interface CrmAdapter<TPayload = unknown> {
  provider: "podio";
  healthcheck(): Promise<{ ok: boolean; reason?: string; mode: "api" | "browser_fallback" | "dry_run" }>;
  dryRun(dossier: RawDossier): Promise<TPayload>;
  sync(dossier: RawDossier): Promise<{ ok: boolean; externalId?: string; reason?: string }>;
  describeRequiredConfig(): string[];
}

export interface DocumentPacket {
  id: string;
  dossierId: string;
  status: "draft_review_required";
  renderer: "streamdown";
  generatedAt: string;
  formats: {
    markdown: string;
    html: string;
  };
  reviewFlags: ReviewFlag[];
}

export interface IntakeSeed {
  ownerName?: string;
  estateName?: string;
  propertyAddress?: string;
  caseNumber?: string;
  county: string;
  parcelId?: string;
  source: "landing_page" | "operator_cli";
  seedBatchId?: string;
  seedSourceLabel?: string;
  sourceOwner?: string;
  approvalMarker?: string;
}
