import type { FactType, FreshLeadBatchRequest, FreshLeadSearchMode, IntakeSeed, RawDossier, SourceFact } from "@ple/types";
import { runDailyProduction } from "./daily/run-daily";
import { buildControlledPodioTestSeed } from "./export/controlled-test-lead";
import { connectionStatuses, exportCompletedReport, podioReadbackBlockerMessage, resolvePodioAccessToken } from "./export/export-package";
import { TEXAS_EQUITY_PROS_LEADS_APP_ID, TEXAS_EQUITY_PROS_LEADS_SPACE_ID } from "./export/podio-config";
import { runDryPipeline } from "./index";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "./lib";
import { runFreshLeadBatch } from "./live/source-batch";
import { renderQualificationReviewMarkdown } from "./qualification/qualification-review";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";

interface CloudflareEnv {
  DEPLOYMENT_KEY?: string;
  COUNTY_LIST?: string;
  PODIO_ACCESS_TOKEN?: string;
  PODIO_REFRESH_TOKEN?: string;
  PODIO_CLIENT_ID?: string;
  PODIO_CLIENT_SECRET?: string;
  PODIO_APP_TOKEN?: string;
  PODIO_APP_ID?: string;
  PODIO_SPACE_ID?: string;
  PODIO_FIELD_MAP_JSON?: string;
  PODIO_REPORT_FILE_URL?: string;
  PODIO_LIVE_WRITE_APPROVED?: string;
  PODIO_TEST_PHONE?: string;
  PODIO_TEST_EMAIL?: string;
  PODIO_LEAD_POINT_PROFILE_ID?: string;
  PODIO_LOGIN_URL?: string;
  PODIO_WORKSPACE_NAME?: string;
  PODIO_APP_NAME?: string;
  AUTH_REQUIRED?: string;
  AUTH_SESSION_SECRET?: string;
  AUTH_SESSION_COOKIE?: string;
  AUTH_ALLOWED_DOMAINS?: string;
  AUTH_ALLOWED_EMAILS?: string;
  SOLVYS_ADMIN_EMAILS?: string;
  HEIRRIGHT_API_TOKEN?: string;
  GOOGLE_WORKSPACE_ACCESS_TOKEN?: string;
  GOOGLE_TRACKING_SHEET_ID?: string;
  GOOGLE_DRIVE_PARENT_FOLDER_ID?: string;
  GOOGLE_TRACKING_SHEET_RANGE?: string;
  GOOGLE_LIVE_WRITE_APPROVED?: string;
  GOOGLE_WORKSPACE_WEBHOOK_URL?: string;
  GOOGLE_WORKSPACE_WEBHOOK_SECRET?: string;
  ACTIVEPIECES_WEBHOOK_URL?: string;
  HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL?: string;
  ACTIVEPIECES_API_KEY?: string;
  HEIRRIGHT_LINEAR_API_KEY?: string;
  LINEAR_API_KEY?: string;
  HEIRRIGHT_LINEAR_TEAM_ID?: string;
  LINEAR_TEAM_ID?: string;
  HEIRRIGHT_LINEAR_PROJECT_ID?: string;
  LINEAR_PROJECT_ID?: string;
  HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID?: string;
  LINEAR_DEFAULT_ASSIGNEE_ID?: string;
}

const DEFAULT_ADDRESS = "20611 NW 33rd Pl, Miami Gardens, FL 33056";
const DEFAULT_OWNER = "Fresh public-source lead";

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function routeList(): string[] {
  return [
    "/dry-run",
    "/latest-run.json",
    "/latest-dossier.json",
    "/podio-dry-run.json",
    "/internal-summary.md",
    "/internal-summary.html",
    "/daily-run.json",
    "/qualification-review.json",
    "/qualification-review.md",
    "/api/leads/fresh-batch",
    "/api/discovery/idi-asset-search/import",
    "/api/discovery/source-capture",
    "/api/discovery/contact-candidates/:id/review",
    "/api/closing-docs/export-google",
    "/api/outreach/sync",
    "/api/exports",
    "/api/podio/diagnostics",
    "/api/connections/status",
    "/api/health/deep",
    "/readback-evidence.json",
    "/readback-evidence.md",
  ];
}

function splitList(value: string | undefined, fallback = ""): string[] {
  return String(value || fallback)
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseCookie(header: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of String(header || "").split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    cookies[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return cookies;
}

function base64UrlToBase64(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return padded + "=".repeat((4 - (padded.length % 4)) % 4);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacBase64Url(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(signature));
}

function emailAllowed(email: string | undefined, env: CloudflareEnv): boolean {
  const normalized = String(email || "").toLowerCase();
  const domain = normalized.split("@")[1] || "";
  const domains = splitList(env.AUTH_ALLOWED_DOMAINS, "heirright.com");
  const emails = splitList(env.AUTH_ALLOWED_EMAILS || env.SOLVYS_ADMIN_EMAILS);
  return emails.includes(normalized) || domains.includes(domain);
}

async function hasValidSession(request: Request, env: CloudflareEnv): Promise<boolean> {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (env.HEIRRIGHT_API_TOKEN && bearer === env.HEIRRIGHT_API_TOKEN) return true;
  if (!env.AUTH_SESSION_SECRET) return false;

  const cookieName = env.AUTH_SESSION_COOKIE || "hr_session";
  const token = parseCookie(request.headers.get("cookie"))[cookieName];
  if (!token || !token.includes(".")) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  const expected = await hmacBase64Url(payload, env.AUTH_SESSION_SECRET);
  if (expected !== signature) return false;

  try {
    const body = JSON.parse(atob(base64UrlToBase64(payload))) as { email?: string; exp?: number };
    if (!body.exp || body.exp < Math.floor(Date.now() / 1000)) return false;
    return emailAllowed(body.email, env);
  } catch {
    return false;
  }
}

async function authBlocker(request: Request, env: CloudflareEnv): Promise<Response | null> {
  if (env.AUTH_REQUIRED === "false") return null;
  if (await hasValidSession(request, env)) return null;
  return json({
    ok: false,
    error: "auth_required",
    message: "Sign in with an approved HeirRight Google account or provide the internal API bearer token.",
  }, { status: 401 });
}

function seedFromUrl(url: URL, env: CloudflareEnv): IntakeSeed {
  const estateName = url.searchParams.get("estate") || undefined;
  const propertyAddress = url.searchParams.get("address") || undefined;
  const ownerName = url.searchParams.get("owner") || undefined;
  const caseNumber = url.searchParams.get("case-number") || undefined;
  const parcelId = url.searchParams.get("folio") || undefined;
  const county = url.searchParams.get("county") || env.COUNTY_LIST?.split(",")[0] || "miami-dade";

  if (!estateName && !propertyAddress && !parcelId && !caseNumber) {
    return {
      propertyAddress: DEFAULT_ADDRESS,
      ownerName: ownerName || DEFAULT_OWNER,
      county,
      parcelId,
      source: "operator_cli",
    };
  }

  return {
    estateName,
    propertyAddress,
    ownerName,
    caseNumber,
    county,
    parcelId,
    source: "operator_cli",
  };
}

function normalizeAssetAddress(value = ""): string {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ownerLastName(value = ""): string {
  return String(value || "")
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)?.toLowerCase() || "";
}

function idiLockKey(body: Record<string, unknown>): string {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(String(body.propertyAddress || body.address || body.assetAddress || "")),
    ownerLastName(String(body.ownerName || body.estateName || "")),
  ].filter(Boolean).join(":");
}

function receiptId(prefix = "heirright"): string {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${crypto.randomUUID().slice(0, 8)}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sourceFactsFromCapture(runId: string, seed: IntakeSeed, capture: Record<string, unknown>): SourceFact[] {
  const subject = intakeSubject(seed);
  const fetchedAt = nowIso();
  const out: SourceFact[] = [];
  const addFact = (source: SourceFact["source"], factType: FactType, value: unknown, sourceUrl?: string) => {
    if (value === undefined || value === null || value === "") return;
    out.push(fact({
      runId,
      source,
      rawId: `operator-source:${slug(seedIdentity(seed))}:${slug(factType)}:${out.length + 1}`,
      fetchedAt,
      county: seed.county,
      subject,
      factType,
      value,
      confidence: 0.85,
      sourceUrl,
      reviewFlags: ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED"],
    }));
  };
  const taxReceipt = (capture.taxReceipt && typeof capture.taxReceipt === "object") ? capture.taxReceipt as Record<string, unknown> : {};
  const deed = (capture.deed && typeof capture.deed === "object") ? capture.deed as Record<string, unknown> : {};
  const obituary = (capture.obituary && typeof capture.obituary === "object") ? capture.obituary as Record<string, unknown> : {};
  addFact("tax_collector", "tax_last_paid_by", taxReceipt.paidBy, stringValue(taxReceipt.sourceUrl));
  addFact("tax_collector", "tax_receipt_status", taxReceipt.status, stringValue(taxReceipt.sourceUrl));
  addFact("official_records", "or_book_page", deed.instrument, stringValue(deed.sourceUrl));
  addFact("official_records", "latest_deed", deed.status || deed.instrument, stringValue(deed.sourceUrl));
  addFact("official_records", "title_signal", deed.note, stringValue(deed.sourceUrl));
  addFact("probate_court", "obituary_link", obituary.status, stringValue(obituary.sourceUrl));
  addFact("probate_court", "obituary_snapshot", obituary.sourceUrl || obituary.fileName, stringValue(obituary.sourceUrl));
  return out;
}

async function dryRunResponse(url: URL, env: CloudflareEnv): Promise<Response> {
  const result = await runDryPipeline(seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });

  const output = url.pathname === "/latest-dossier.json"
    ? result.outputFiles.dossier
    : url.pathname === "/podio-dry-run.json"
      ? result.outputFiles.podio
      : url.pathname === "/internal-summary.md"
        ? result.outputFiles.summaryMarkdown
        : url.pathname === "/internal-summary.html"
          ? result.outputFiles.summaryHtml
          : result.outputFiles.latestRun;

  return new Response(output.body, {
    headers: {
      "content-type": output.contentType,
      "cache-control": "no-store",
    },
  });
}

async function dailyRunResponse(env: CloudflareEnv): Promise<Response> {
  const result = await runDailyProduction(undefined, {
    env: env as Record<string, string | undefined>,
  });
  return json(result, { headers: { "cache-control": "no-store" } });
}

async function qualificationReviewResponse(env: CloudflareEnv, markdown: boolean): Promise<Response> {
  const result = await runDailyProduction(undefined, {
    env: env as Record<string, string | undefined>,
  });
  if (markdown) {
    return new Response(renderQualificationReviewMarkdown(result.qualificationReview), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return json(result.qualificationReview, { headers: { "cache-control": "no-store" } });
}

function freshLeadRequestFromHttp(requestBody: FreshLeadBatchRequest | undefined, url: URL): FreshLeadBatchRequest {
  const query = url.searchParams.get("query")
    || url.searchParams.get("owner")
    || url.searchParams.get("address")
    || url.searchParams.get("folio")
    || undefined;
  const searchMode = url.searchParams.get("searchMode") || url.searchParams.get("mode");
  return {
    ...requestBody,
    source: "miami_dade_property_appraiser",
    filters: {
      ...(requestBody?.filters ?? {}),
      county: url.searchParams.get("county") ?? requestBody?.filters?.county,
      searchMode: (searchMode ?? requestBody?.filters?.searchMode) as FreshLeadSearchMode | undefined,
      query: query ?? requestBody?.filters?.query,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : requestBody?.filters?.limit,
      includeCompanyOwners: url.searchParams.get("includeCompanyOwners")
        ? url.searchParams.get("includeCompanyOwners") === "true"
        : requestBody?.filters?.includeCompanyOwners,
    },
  };
}

async function freshLeadBatchResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => undefined) as FreshLeadBatchRequest | undefined
    : undefined;
  const result = await runFreshLeadBatch(freshLeadRequestFromHttp(body, url), {
    env: env as Record<string, string | undefined>,
  });
  return json(result, { headers: { "cache-control": "no-store" } });
}

async function exportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const routesParam = url.searchParams.get("routes");
  const routes = routesParam
    ? routesParam.split(",").map((route) => route.trim()).filter((route): route is "google" | "podio" => route === "google" || route === "podio")
    : ["google", "podio"] as Array<"google" | "podio">;
  const body = request.method === "POST"
    ? await request.json().catch(() => undefined) as { seed?: IntakeSeed; routes?: Array<"google" | "podio">; dryRun?: boolean; controlledTest?: boolean } | undefined
    : undefined;
  const seed = body?.controlledTest
    ? buildControlledPodioTestSeed(env as Record<string, string | undefined>)
    : body?.seed ?? seedFromUrl(url, env);
  const pipeline = await runDryPipeline(seed, {
    env: env as Record<string, string | undefined>,
  });
  const result = await exportCompletedReport({
    routes: body?.routes ?? routes,
    dossier: pipeline.dossier,
    dryRun: body?.dryRun ?? dryRun,
    controlledTest: body?.controlledTest,
  }, env as Record<string, string | undefined>);
  return json(result, { headers: { "cache-control": "no-store" } });
}

async function idiAssetImportResponse(request: Request): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  if (!stringValue(body.importedText) && !(body.attachment && typeof body.attachment === "object" && stringValue((body.attachment as Record<string, unknown>).sourceUrl))) {
    return json({
      ok: false,
      error: "missing_idi_report",
      message: "Paste the approved IDI Asset Discovery report text or attach report metadata before importing.",
    }, { status: 400, headers: { "cache-control": "no-store" } });
  }
  return json({
    ok: true,
    mode: "operator_import",
    provider: body.provider || "idi",
    lockKey: idiLockKey(body),
    importedAt: nowIso(),
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_import_only",
    adminOverrideReason: body.adminOverrideReason || null,
    attachment: body.attachment || null,
    contactPreviewCount: stringValue(body.importedText).split(/\n{2,}/).filter(Boolean).length,
    paidRun: false,
    message: "Approved IDI report metadata was imported for review. The production backend did not run IDI Core.",
  }, { headers: { "cache-control": "no-store" } });
}

async function sourceCaptureResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const seed = (body.seed && typeof body.seed === "object" ? body.seed : undefined) as IntakeSeed | undefined
    ?? seedFromUrl(new URL(request.url), env);
  const runId = stringValue(body.runId) || `source-capture-${Date.now()}-${slug(seedIdentity(seed))}`;
  const sourceFacts = sourceFactsFromCapture(runId, seed, body);
  return json({
    ok: true,
    id: body.assetKey || body.id || receiptId("source-capture"),
    capturedAt: nowIso(),
    seed,
    sourceFacts,
    reviewFlags: sourceFacts.flatMap((item) => item.reviewFlags),
    message: sourceFacts.length
      ? "Source capture saved for Discovery review."
      : "Source capture saved, but no structured source facts were detected.",
  }, { headers: { "cache-control": "no-store" } });
}

async function contactCandidateReviewResponse(request: Request, candidateId: string): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const status = ["accepted", "rejected", "promoted", "alternative"].includes(stringValue(body.status || body.decision))
    ? stringValue(body.status || body.decision)
    : "accepted";
  return json({
    ok: true,
    candidateId,
    status,
    reviewedAt: nowIso(),
    reviewedBy: body.reviewedBy || body.actor || "office user",
    contact: body.contact || null,
    message: status === "accepted" || status === "promoted"
      ? "Contact candidate saved for the Discovery contact matrix."
      : "Contact candidate review saved.",
  }, { headers: { "cache-control": "no-store" } });
}

function closingDocValue(dossier: RawDossier, key: string): string {
  const values: Record<string, unknown> = {
    estate_name: dossier.summary.estateName || dossier.summary.displayName,
    property_address: dossier.property.address.value,
    county: dossier.property.county.value,
    folio: dossier.property.parcelId.value,
    case_number: dossier.summary.caseNumber || dossier.property.caseNumber.value,
    owner_name: dossier.property.ownerName.value || dossier.summary.displayName,
    offer_status: dossier.completedLeadReport?.reviewGate.reportStatus,
    lead_bucket: dossier.completedLeadReport?.leadQualityProfile.leadBucket,
    next_action: dossier.summary.nextBestAction,
    tax_status: dossier.taxHistory.sourceStatus.value || dossier.taxHistory.receiptStatus.value,
    probate_status: dossier.probateDocket.caseStatus.value || dossier.probateDocket.sourceStatus.value,
    title_status: dossier.deedHistory.sourceStatus.value || dossier.deedHistory.ownershipActivity.value,
  };
  const value = values[key];
  return value === undefined || value === null ? "" : String(value);
}

function buildClosingDocsPacket(dossier: RawDossier, notes = ""): { title: string; markdown: string; blockers: string[] } {
  const templates = [
    "Fund Transfer / Bank Account Transfer",
    "Contract for Deed",
    "Quit Claim Deed",
    "Limited Power of Attorney",
    "Assignment of Surplus Rights Purchase Agreement",
    "Same Name Affidavit",
    "Joinder, Waiver and Consent",
    "Affidavit of Heirs",
    "Valuable Consideration Disbursement",
    "Assignment and Disclaimer of Interest",
    "Land Trust Agreement",
    "Tax Reimbursement Credit",
    "Buyer Purchase Agreement",
    "Unclaimed Funds Instructions",
  ];
  const required = ["estate_name", "property_address", "county", "folio", "owner_name", "tax_status", "title_status", "probate_status"];
  const blockers = required
    .filter((key) => !closingDocValue(dossier, key))
    .map((key) => `Missing closing-doc field: ${key.replace(/_/g, " ")}.`);
  const title = `Closing Prep Packet - ${dossier.summary.displayName}`;
  const facts = required.map((key) => `- ${key.replace(/_/g, " ")}: ${closingDocValue(dossier, key) || "[NEEDS REVIEW]"}`).join("\n");
  const templateList = templates.map((template) => `- ${template}: Draft - Review Required`).join("\n");
  const markdown = [
    `# ${title}`,
    "",
    "Internal draft - review required before external use.",
    "",
    "## Estate Fields",
    facts,
    "",
    "## Closing Templates",
    templateList,
    "",
    "## Blockers",
    blockers.length ? blockers.map((blocker) => `- ${blocker}`).join("\n") : "- No required closing fields are missing from this draft packet.",
    "",
    "## Operator Notes",
    notes || "No operator notes were provided.",
  ].join("\n");
  return { title, markdown, blockers };
}

async function closingDocsGoogleExportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as { seed?: IntakeSeed; dossier?: RawDossier; dryRun?: boolean; notes?: string }
    : {};
  const pipeline = body.dossier
    ? null
    : await runDryPipeline(body.seed ?? seedFromUrl(url, env), { env: env as Record<string, string | undefined> });
  const dossier = body.dossier ?? pipeline?.dossier;
  if (!dossier) {
    return json({ ok: false, error: "missing_dossier", message: "Closing Docs export needs a dossier or estate seed." }, { status: 400 });
  }
  const packet = buildClosingDocsPacket(dossier, body.notes);
  const exportResult = await exportCompletedReport({
    routes: ["google"],
    dossier,
    dryRun: body.dryRun ?? url.searchParams.get("dry-run") !== "false",
    documentTitle: packet.title,
    documentBody: packet.markdown,
  }, env as Record<string, string | undefined>);
  return json({
    ok: exportResult.ok && packet.blockers.length === 0,
    status: packet.blockers.length ? "draft_review_required" : exportResult.ok ? "google_exported" : "blocked",
    packet,
    export: exportResult,
    blockers: [...packet.blockers, ...exportResult.blockers],
  }, { headers: { "cache-control": "no-store" } });
}

async function linearSupportIssue(env: CloudflareEnv, title: string, description: string): Promise<Record<string, unknown> | null> {
  const apiKey = env.HEIRRIGHT_LINEAR_API_KEY || env.LINEAR_API_KEY;
  const teamId = env.HEIRRIGHT_LINEAR_TEAM_ID || env.LINEAR_TEAM_ID;
  if (!apiKey || !teamId) return null;
  const input: Record<string, unknown> = { teamId, title, description, priority: 3 };
  if (env.HEIRRIGHT_LINEAR_PROJECT_ID || env.LINEAR_PROJECT_ID) input.projectId = env.HEIRRIGHT_LINEAR_PROJECT_ID || env.LINEAR_PROJECT_ID;
  if (env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || env.LINEAR_DEFAULT_ASSIGNEE_ID) input.assigneeId = env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || env.LINEAR_DEFAULT_ASSIGNEE_ID;
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      query: "mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier url } } }",
      variables: { input },
    }),
  });
  const data = await response.json().catch(() => ({})) as { data?: { issueCreate?: { success?: boolean; issue?: Record<string, unknown> } } };
  return data.data?.issueCreate?.issue ?? null;
}

function outreachSeed(body: Record<string, unknown>): IntakeSeed {
  const explicitSeed = (body.seed && typeof body.seed === "object") ? body.seed as IntakeSeed : null;
  if (explicitSeed) return explicitSeed;
  const lead = (body.lead && typeof body.lead === "object") ? body.lead as Record<string, unknown> : {};
  return {
    estateName: stringValue(lead.estateName) || stringValue(lead.displayName) || undefined,
    propertyAddress: stringValue(lead.propertyAddress) || stringValue(lead.address) || DEFAULT_ADDRESS,
    ownerName: stringValue(lead.ownerName) || stringValue(lead.displayName) || DEFAULT_OWNER,
    caseNumber: stringValue(lead.caseNumber) || undefined,
    county: stringValue(lead.county) || "miami-dade",
    parcelId: stringValue(lead.parcelId) || stringValue(lead.folio) || undefined,
    source: "operator_cli",
  };
}

async function outreachDossier(body: Record<string, unknown>, env: CloudflareEnv): Promise<RawDossier> {
  const dossier = body.dossier && typeof body.dossier === "object" ? body.dossier as RawDossier : null;
  if (dossier?.id && dossier.summary && dossier.property) return dossier;
  const pipeline = await runDryPipeline(outreachSeed(body), {
    env: env as Record<string, string | undefined>,
  });
  return pipeline.dossier;
}

function renderOutreachPackageMarkdown(payload: Record<string, unknown>): string {
  const template = (payload.template && typeof payload.template === "object") ? payload.template as Record<string, unknown> : {};
  const lead = (payload.lead && typeof payload.lead === "object") ? payload.lead as Record<string, unknown> : {};
  const campaign = (payload.campaign && typeof payload.campaign === "object") ? payload.campaign as Record<string, unknown> : {};
  return [
    "# HeirRight Outreach Review Package",
    "",
    `Package: ${String(payload.packageId || "outreach-package")}`,
    `Requested: ${String(payload.requestedAt || nowIso())}`,
    `Actor: ${String(payload.actor || "office user")}`,
    "",
    "## Lead",
    "",
    `Name: ${String(lead.displayName || lead.estateName || "Selected lead")}`,
    `Property: ${String(lead.propertyAddress || lead.address || DEFAULT_ADDRESS)}`,
    "",
    "## Campaign",
    "",
    `Name: ${String(campaign.name || "Outreach campaign")}`,
    `Channel: ${String(template.channel || "review")}`,
    "",
    "## Approved Template",
    "",
    String(template.body || ""),
    "",
    "## Guardrails",
    "",
    "- HeirRight Leads did not send SMS or email.",
    "- Podio sync creates a review package, source note, and operator task only.",
    "- External outreach remains blocked until an operator approves the Podio readback.",
  ].join("\n");
}

async function outreachSyncResponse(request: Request, env: CloudflareEnv): Promise<Response> {
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const template = (body.template && typeof body.template === "object") ? body.template as Record<string, unknown> : {};
  const status = stringValue(template.status);
  const unresolvedVariables = Array.isArray(body.unresolvedVariables) ? body.unresolvedVariables : [];
  if (!stringValue(template.id) || !stringValue(template.body)) {
    return json({ ok: false, status: "blocked", error: "template_required", message: "Approved outreach template body is required." }, { status: 400 });
  }
  if (status && status !== "Approved" && status !== "Sync to Podio") {
    return json({
      ok: false,
      status: "approval_required",
      message: "Approve this outreach template before Podio sync.",
      blockers: ["Template is not approved."],
    }, { headers: { "cache-control": "no-store" } });
  }
  if (unresolvedVariables.length) {
    return json({
      ok: false,
      status: "variables_required",
      message: "Resolve outreach variables before Podio sync.",
      blockers: unresolvedVariables.map((item) => `Unresolved variable: ${String(item)}`),
    }, { headers: { "cache-control": "no-store" } });
  }
  const podioStatuses = await connectionStatuses(env as Record<string, string | undefined>);
  const podioStatus = podioStatuses.find((item) => item.name === "Podio");
  const podioReady = podioStatus?.ok === true;
  const packageId = receiptId("outreach");
  const payload = {
    packageId,
    source: "HeirRight Leads",
    actor: body.actor || "office user",
    requestedAt: body.requestedAt || nowIso(),
    campaign: body.campaign || null,
    template,
    lead: body.lead || null,
    guardrails: {
      noDirectSend: true,
      requiresReadbackProof: true,
      podioReady,
    },
  };
  const webhookUrl = env.ACTIVEPIECES_WEBHOOK_URL || env.HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL || "";
  if (webhookUrl && podioReady) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (env.ACTIVEPIECES_API_KEY) headers.authorization = `Bearer ${env.ACTIVEPIECES_API_KEY}`;
    const upstream = await fetch(webhookUrl, { method: "POST", headers, body: JSON.stringify(payload) });
    if (upstream.ok) {
      return json({
        ok: true,
        status: "activepieces_queued",
        runId: packageId,
        upstreamStatus: upstream.status,
        message: "Activepieces accepted the Podio outreach workflow request. No direct SMS or email was sent by HeirRight Leads.",
      }, { headers: { "cache-control": "no-store" } });
    }
  }
  if (podioReady) {
    const dossier = await outreachDossier(body, env);
    const podioExport = await exportCompletedReport({
      routes: ["podio"],
      dossier,
      dryRun: body.dryRun === true,
      documentTitle: `Outreach review package - ${dossier.summary.displayName}`,
      documentBody: renderOutreachPackageMarkdown(payload),
    }, env as Record<string, string | undefined>);
    const podioRoute = podioExport.routes.find((route) => route.route === "podio") || podioExport.routes[0];
    if (podioExport.ok) {
      return json({
        ok: true,
        status: podioRoute?.mode === "dry_run" ? "podio_ready_dry_run" : "podio_exported_for_review",
        runId: packageId,
        package: payload,
        podio: podioRoute,
        blockers: podioExport.blockers,
        message: "Outreach was exported to Podio as a review package. No outbound SMS or email was sent by HeirRight Leads.",
      }, { headers: { "cache-control": "no-store" } });
    }
    const linearIssue = await linearSupportIssue(
      env,
      "[HeirRight outreach] Podio export/readback failed",
      [
        "HeirRight outreach sync attempted the first-party Podio export fallback.",
        "",
        `Package: ${packageId}`,
        `Export blockers: ${podioExport.blockers.join("; ") || "Unknown Podio export failure"}`,
        "",
        "No SMS, email, or live outreach send was attempted.",
      ].join("\n"),
    ).catch(() => null);
    return json({
      ok: true,
      status: "ready_for_podio_review",
      fallback: "First-party Outreach package",
      package: payload,
      podio: podioRoute,
      blockers: podioExport.blockers.length ? podioExport.blockers : ["Podio export/readback failed."],
      linearIssue,
      message: "Outreach stayed staged because the Podio export/readback fallback did not complete.",
    }, { headers: { "cache-control": "no-store" } });
  }
  const blockers = [
    ...(podioReady ? [] : [podioStatus?.message || "Podio controlled write/readback is not ready yet."]),
    ...(webhookUrl ? [] : ["Activepieces webhook is not configured."]),
  ];
  const linearIssue = await linearSupportIssue(
    env,
    "[HeirRight outreach] Automation setup/readback needed",
    [
      "HeirRight outreach sync fell back to the first-party package.",
      "",
      `Package: ${packageId}`,
      `Blockers: ${blockers.join("; ") || "None"}`,
      "",
      "No SMS, email, or live Podio outreach send was attempted.",
    ].join("\n"),
  ).catch(() => null);
  return json({
    ok: true,
    status: "ready_for_podio_review",
    fallback: "First-party Outreach package",
    package: payload,
    blockers,
    linearIssue,
    message: "Outreach was staged as a Podio-compatible review package. No outbound SMS or email was sent.",
  }, { headers: { "cache-control": "no-store" } });
}

async function deepHealthResponse(env: CloudflareEnv): Promise<Response> {
  const statuses = await connectionStatuses(env as Record<string, string | undefined>);
  return json({
    ok: true,
    backendTarget: "cloudflare-worker",
    service: "heirright-probate-lead-engine",
    deploymentKey: env.DEPLOYMENT_KEY || "heirright",
    routes: Object.fromEntries(routeList().map((route) => [route, "available"])),
    connections: statuses,
  }, { headers: { "cache-control": "no-store" } });
}

function podioProfileCandidate(value: Record<string, unknown>, source: string): Record<string, unknown> | null {
  const profile = (value.profile && typeof value.profile === "object") ? value.profile as Record<string, unknown> : {};
  const user = (value.user && typeof value.user === "object") ? value.user as Record<string, unknown> : {};
  const userProfile = (user.profile && typeof user.profile === "object") ? user.profile as Record<string, unknown> : {};
  const profileId = value.profile_id ?? profile.profile_id ?? user.profile_id ?? userProfile.profile_id;
  if (!profileId) return null;
  return {
    source,
    profileId: String(profileId),
    name: value.name ?? profile.name ?? user.name ?? userProfile.name ?? null,
    email: value.email ?? profile.email ?? user.email ?? userProfile.email ?? null,
  };
}

async function podioJson(path: string, env: CloudflareEnv): Promise<{ ok: boolean; status: number; data: unknown }> {
  const auth = await resolvePodioAccessToken(env as Record<string, string | undefined>);
  if (!auth.token) {
    return { ok: false, status: 0, data: { error: auth.blocker || "missing_podio_access_token" } };
  }
  const response = await fetch(`https://api.podio.com${path}`, {
    headers: { authorization: `Bearer ${auth.token}` },
  });
  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => null),
  };
}

async function podioDiagnosticsResponse(env: CloudflareEnv): Promise<Response> {
  const appId = env.PODIO_APP_ID || TEXAS_EQUITY_PROS_LEADS_APP_ID;
  const spaceId = env.PODIO_SPACE_ID || TEXAS_EQUITY_PROS_LEADS_SPACE_ID;
  const auth = await resolvePodioAccessToken(env as Record<string, string | undefined>);
  const [userStatus, app, members] = await Promise.all([
    podioJson("/user/status", env),
    podioJson(`/app/${appId}`, env),
    podioJson(`/space/${spaceId}/member/`, env),
  ]);
  const memberRows = Array.isArray(members.data) ? members.data as Array<Record<string, unknown>> : [];
  const appObject = app.data && typeof app.data === "object" ? app.data as Record<string, unknown> : {};
  const appConfig = appObject.config && typeof appObject.config === "object" ? appObject.config as Record<string, unknown> : {};
  const candidates = [
    userStatus.data && typeof userStatus.data === "object" ? podioProfileCandidate(userStatus.data as Record<string, unknown>, "user_status") : null,
    ...memberRows.map((item) => podioProfileCandidate(item, "space_member")),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  const podioAuthOk = Boolean(auth.token && userStatus.ok && app.ok && members.ok);
  const authBlocker = auth.blocker || podioReadbackBlockerMessage(
    app.status || userStatus.status || members.status,
    app.data || userStatus.data || members.data,
  );
  return json({
    ok: true,
    appId,
    spaceId,
    authMode: auth.mode,
    authOk: podioAuthOk,
    authBlocker: podioAuthOk ? null : authBlocker,
    setupOptions: podioAuthOk ? [] : [
      "Reconnect Podio once with the approved HeirRight account so the Worker can use refresh-token auth.",
      "Fallback: add the Podio Leads app token so the Worker can request fresh app-scoped access without relying on a stale bearer token.",
    ],
    userStatus: { ok: userStatus.ok, status: userStatus.status },
    app: {
      ok: app.ok,
      status: app.status,
      name: appConfig.name ?? appObject.name ?? null,
    },
    members: {
      ok: members.ok,
      status: members.status,
      count: memberRows.length,
    },
    profileCandidates: candidates,
    configuredLeadPointProfileId: env.PODIO_LEAD_POINT_PROFILE_ID || null,
  }, { headers: { "cache-control": "no-store" } });
}

async function readbackEvidenceResponse(url: URL, env: CloudflareEnv, markdown: boolean): Promise<Response> {
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const pipeline = await runDryPipeline(seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });
  const exportResult = await exportCompletedReport({
    routes: ["google", "podio"],
    dossier: pipeline.dossier,
    dryRun,
  }, env as Record<string, string | undefined>);
  const packet = buildReadbackEvidencePacket(exportResult, await connectionStatuses(env as Record<string, string | undefined>));
  if (markdown) {
    return new Response(renderReadbackEvidenceMarkdown(packet), {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
  return json(packet, { headers: { "cache-control": "no-store" } });
}

export default {
  async fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "POST" && request.method !== "HEAD") {
      return json({ ok: false, error: "Method not allowed." }, { status: 405 });
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        ok: true,
        service: "heirright-probate-lead-engine",
        deploymentKey: env.DEPLOYMENT_KEY || "heirright",
        endpoints: routeList(),
      });
    }

    if (url.pathname === "/api/health/deep") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return deepHealthResponse(env);
    }

    if ([
      "/dry-run",
      "/latest-run.json",
      "/latest-dossier.json",
      "/podio-dry-run.json",
      "/internal-summary.md",
      "/internal-summary.html",
    ].includes(url.pathname)) {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return dryRunResponse(url, env);
    }

    if (url.pathname === "/daily-run.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return dailyRunResponse(env);
    }

    if (url.pathname === "/qualification-review.json" || url.pathname === "/qualification-review.md") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return qualificationReviewResponse(env, url.pathname.endsWith(".md"));
    }

    if (url.pathname === "/api/leads/fresh-batch" || url.pathname === "/fresh-lead-batch.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return freshLeadBatchResponse(request, url, env);
    }

    if (url.pathname === "/api/discovery/idi-asset-search/import") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return idiAssetImportResponse(request);
    }

    if (url.pathname === "/api/discovery/source-capture") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return sourceCaptureResponse(request, env);
    }

    const contactReviewMatch = url.pathname.match(/^\/api\/discovery\/contact-candidates\/([^/]+)\/review$/);
    if (contactReviewMatch) {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return contactCandidateReviewResponse(request, decodeURIComponent(contactReviewMatch[1] || ""));
    }

    if (url.pathname === "/api/closing-docs/export-google") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return closingDocsGoogleExportResponse(request, url, env);
    }

    if (url.pathname === "/api/outreach/sync") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return outreachSyncResponse(request, env);
    }

    if (url.pathname === "/api/exports" || url.pathname === "/export-result.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return exportResponse(request, url, env);
    }

    if (url.pathname === "/api/podio/diagnostics") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return podioDiagnosticsResponse(env);
    }

    if (url.pathname === "/readback-evidence.json" || url.pathname === "/readback-evidence.md") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return readbackEvidenceResponse(url, env, url.pathname.endsWith(".md"));
    }

    if (url.pathname === "/api/connections/status" || url.pathname === "/connection-status.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return json(await connectionStatuses(env as Record<string, string | undefined>), { headers: { "cache-control": "no-store" } });
    }

    return json({ ok: false, error: "Not found." }, { status: 404 });
  },
};
