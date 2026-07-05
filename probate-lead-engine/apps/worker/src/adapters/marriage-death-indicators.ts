import type { IntakeSeed, ReviewFlag, SourceFact } from "@ple/types";
import { fact, intakeSubject, nowIso, seedIdentity, slug } from "../lib";

const CLERK_RECORDS_URL = "https://www2.miamidadeclerk.gov/ocs/";
const missingFlags: ReviewFlag[] = ["MISSING_MARRIAGE_DEATH_FACT", "SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];
const vitalWorkflowFlags: ReviewFlag[] = ["VITAL_RECORDS_WORKFLOW_REQUIRED", ...missingFlags];
const deathCertFlags: ReviewFlag[] = ["MANUAL_DEATH_CERTIFICATE_REQUIRED", "MISSING_MARRIAGE_DEATH_FACT", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];
const workflowCapturedFlags: ReviewFlag[] = ["SOURCE_EVIDENCE_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"];

type RuntimeEnv = Record<string, string | undefined>;
type JsonRecord = Record<string, unknown>;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function workflowUrl(env: RuntimeEnv): string {
  return stringValue(env.OBITUARY_VITAL_WORKFLOW_URL)
    || stringValue(env.VITAL_OBITUARY_WORKFLOW_URL)
    || stringValue(env.MARRIAGE_DEATH_WORKFLOW_URL);
}

function workflowToken(env: RuntimeEnv): string {
  return stringValue(env.OBITUARY_VITAL_WORKFLOW_TOKEN)
    || stringValue(env.VITAL_OBITUARY_WORKFLOW_TOKEN)
    || stringValue(env.MARRIAGE_DEATH_WORKFLOW_TOKEN)
    || stringValue(env.BROWSERBASE_API_KEY);
}

function browserbaseFunctionId(env: RuntimeEnv): string {
  return stringValue(env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID)
    || stringValue(env.VITAL_OBITUARY_BROWSERBASE_FUNCTION_ID)
    || stringValue(env.MARRIAGE_DEATH_BROWSERBASE_FUNCTION_ID)
    || stringValue(env.BROWSERBASE_VITAL_OBITUARY_FUNCTION_ID);
}

function browserbaseApiBase(env: RuntimeEnv): string {
  return stringValue(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com";
}

function browserbaseApiKey(env: RuntimeEnv): string {
  return stringValue(env.BROWSERBASE_API_KEY);
}

function truthyEnv(value: unknown): boolean {
  return ["1", "true", "yes", "on"].includes(stringValue(value).toLowerCase());
}

function browserbaseSessionCreateParams(env: RuntimeEnv): JsonRecord {
  const params: JsonRecord = {
    browserSettings: {
      viewport: { width: 1365, height: 900 },
      recordSession: true,
      logSession: true,
      solveCaptchas: true,
      enablePdfViewer: true,
    },
    timeout: 900,
  };
  if (truthyEnv(env.OBITUARY_VITAL_BROWSERBASE_PROXY_ENABLED) || truthyEnv(env.BROWSERBASE_PROXY_ENABLED)) {
    params.proxies = [{
      type: "browserbase",
      domainPattern: stringValue(env.OBITUARY_VITAL_BROWSERBASE_PROXY_DOMAIN_PATTERN)
        || stringValue(env.BROWSERBASE_PROXY_DOMAIN_PATTERN)
        || "*",
    }];
  }
  return params;
}

function browserbaseInvocationStatus(invocation: JsonRecord): string {
  return stringValue(invocation.status).toUpperCase();
}

function isPendingBrowserbaseInvocation(invocation: JsonRecord): boolean {
  return ["PENDING", "RUNNING"].includes(browserbaseInvocationStatus(invocation));
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBrowserbaseInvocation(invocation: JsonRecord, apiBase: string, apiKey: string): Promise<JsonRecord> {
  const invocationId = stringValue(invocation.id);
  if (!invocationId || !isPendingBrowserbaseInvocation(invocation)) return invocation;

  const deadline = Date.now() + 45_000;
  let latest = invocation;
  while (Date.now() < deadline && isPendingBrowserbaseInvocation(latest)) {
    await sleep(2_000);
    const statusResponse = await fetch(`${apiBase}/v1/functions/invocations/${encodeURIComponent(invocationId)}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-bb-api-key": apiKey,
      },
    });
    const statusBody = await statusResponse.json().catch(() => ({})) as JsonRecord;
    latest = Object.keys(statusBody).length ? statusBody : latest;
    if (!statusResponse.ok) break;
  }
  return latest;
}

async function fetchVitalWorkflow(seed: IntakeSeed, env: RuntimeEnv): Promise<{ ok: boolean; status: number; url: string; data: JsonRecord; error?: string } | null> {
  const url = workflowUrl(env);
  const params = {
    source: "vital_obituary_review",
    estateName: seed.estateName ?? "",
    ownerName: seed.ownerName ?? "",
    propertyAddress: seed.propertyAddress ?? "",
    parcelId: seed.parcelId ?? "",
    caseNumber: seed.caseNumber ?? "",
    county: seed.county,
    clerkSearchUrl: CLERK_RECORDS_URL,
  };

  if (url) {
    try {
      const headers: Record<string, string> = {
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": "HeirRight-VitalObituaryWorkflow/1.0",
      };
      const token = workflowToken(env);
      if (token) headers.authorization = `Bearer ${token}`;

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });
      const data = await response.json().catch(() => ({})) as JsonRecord;
      return {
        ok: response.ok && data.ok !== false,
        status: response.status,
        url,
        data,
        error: stringValue(data.error) || stringValue(data.message),
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        url,
        data: {},
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const functionId = browserbaseFunctionId(env);
  const apiKey = browserbaseApiKey(env);
  if (!functionId || !apiKey) return null;

  const apiBase = browserbaseApiBase(env).replace(/\/$/, "");
  const invokeUrl = `${apiBase}/v1/functions/${encodeURIComponent(functionId)}/invoke`;
  try {
    const response = await fetch(invokeUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-bb-api-key": apiKey,
      },
      body: JSON.stringify({
        params,
        sessionCreateParams: browserbaseSessionCreateParams(env),
      }),
    });
    const invocation = await response.json().catch(() => ({})) as JsonRecord;
    const completedInvocation = await waitForBrowserbaseInvocation(invocation, apiBase, apiKey);
    const data = completedInvocation.results && typeof completedInvocation.results === "object" && !Array.isArray(completedInvocation.results)
      ? completedInvocation.results as JsonRecord
      : {};
    return {
      ok: response.ok && completedInvocation.status !== "FAILED" && !isPendingBrowserbaseInvocation(completedInvocation) && data.ok !== false,
      status: response.status,
      url: `browserbase:function:${functionId}`,
      data: {
        ...data,
        browserbaseInvocationId: completedInvocation.id ?? null,
        browserbaseSessionId: completedInvocation.sessionId ?? null,
        browserbaseStatus: completedInvocation.status ?? null,
      },
      error: stringValue(data.error)
        || stringValue(data.message)
        || (isPendingBrowserbaseInvocation(completedInvocation)
          ? "Browserbase vital/obituary workflow is still running after the route wait window."
          : response.ok ? "" : `HTTP ${response.status}`),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      url: `browserbase:function:${functionId}`,
      data: {},
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function workflowField(data: JsonRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (value !== undefined && value !== null && typeof value !== "string") return value;
  }
  return null;
}

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function flagsFor(value: unknown, fallback: ReviewFlag[] = missingFlags): ReviewFlag[] {
  return hasValue(value) ? workflowCapturedFlags : fallback;
}

export async function fetchMarriageDeathIndicatorFacts(runId: string, seed: IntakeSeed, env: RuntimeEnv = {}): Promise<SourceFact[]> {
  const fetchedAt = nowIso();
  const rawId = `marriage-death:${slug(seedIdentity(seed))}`;
  const subject = intakeSubject(seed);
  const workflow = await fetchVitalWorkflow(seed, env);
  const workflowData = workflow?.data ?? {};
  const sourceUrl = stringValue(workflowField(workflowData, "sourceUrl", "obituaryUrl", "obituaryLink", "marriageLicenseUrl", "deathCertificateUrl"))
    || workflow?.url
    || CLERK_RECORDS_URL;
  const marriageLicenseSignal = workflowField(workflowData, "marriageLicenseSignal", "marriageStatus", "marriageLicense");
  const dateOfBirth = workflowField(workflowData, "dateOfBirth", "dob");
  const dateOfDeath = workflowField(workflowData, "dateOfDeath", "dod");
  const obituaryLink = workflowField(workflowData, "obituaryLink", "obituaryUrl", "sourceUrl");
  const obituarySnapshot = workflowField(workflowData, "obituarySnapshot", "obituaryExcerpt", "obituaryText", "obituaryAttachment");
  const deathCertificateStatus = workflowField(workflowData, "deathCertificateStatus", "deathCertificate");
  const incarcerationStatus = workflowField(workflowData, "incarcerationStatus", "incarcerationStatusSignal", "incarcerationSignal");
  const statusValue = workflowField(workflowData, "status", "marriageDeathStatus", "obituaryStatus");
  const sourceStatus = workflow
    ? {
        mode: workflow.ok ? "workflow_reviewed" : "workflow_failed",
        ok: workflow.ok,
        status: workflow.status,
        note: workflow.ok
          ? "Vital, obituary, marriage, and deceased-indicator workflow returned reviewable source facts. A person still needs to confirm heirship before Closing Prep uses them."
          : `Vital, obituary, marriage, and deceased-indicator workflow did not return usable facts: ${workflow.error || `HTTP ${workflow.status}`}.`,
        workflowUrl: workflow.url,
      }
    : {
        mode: "workflow_required",
        ok: false,
        note: "Vital, obituary, marriage-license, death-certificate, Findagrave/Legacy, and deceased-indicator review needs a configured browser/API workflow before the app can fill these Discovery facts automatically.",
        workflowUrl: null,
      };
  const sourceStatusFlags = workflow?.ok ? workflowCapturedFlags : vitalWorkflowFlags;

  return [
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:source-status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "source_status",
      value: sourceStatus,
      confidence: workflow?.ok ? 0.82 : 0.2,
      sourceUrl,
      reviewFlags: [...sourceStatusFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:status`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "marriage_death_status",
      value: statusValue || (workflow ? (workflow.ok ? "workflow_reviewed" : "workflow_failed") : "workflow_required"),
      confidence: workflow?.ok ? 0.72 : 0.2,
      sourceUrl,
      reviewFlags: workflow?.ok ? ["HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : [...vitalWorkflowFlags],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:marriage-license`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "marriage_license_signal",
      value: marriageLicenseSignal,
      confidence: hasValue(marriageLicenseSignal) ? 0.72 : 0,
      sourceUrl,
      reviewFlags: flagsFor(marriageLicenseSignal, workflow?.ok ? missingFlags : vitalWorkflowFlags),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:dob`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "date_of_birth",
      value: dateOfBirth,
      confidence: hasValue(dateOfBirth) ? 0.7 : 0,
      sourceUrl,
      reviewFlags: flagsFor(dateOfBirth, workflow?.ok ? missingFlags : vitalWorkflowFlags),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:dod`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "date_of_death",
      value: dateOfDeath,
      confidence: hasValue(dateOfDeath) ? 0.75 : 0,
      sourceUrl,
      reviewFlags: flagsFor(dateOfDeath, workflow?.ok ? missingFlags : vitalWorkflowFlags),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:obituary`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "obituary_link",
      value: obituaryLink,
      confidence: hasValue(obituaryLink) ? 0.75 : 0,
      sourceUrl: stringValue(obituaryLink) || sourceUrl,
      reviewFlags: flagsFor(obituaryLink, workflow?.ok ? missingFlags : vitalWorkflowFlags),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:obituary-snapshot`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "obituary_snapshot",
      value: obituarySnapshot,
      confidence: hasValue(obituarySnapshot) ? 0.65 : 0,
      sourceUrl,
      reviewFlags: flagsFor(obituarySnapshot, workflow?.ok ? ["SOURCE_ATTACHMENT_REQUIRED", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"] : vitalWorkflowFlags),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:memorial-search`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "memorial_search_tasks",
      value: [
        { provider: "findagrave", note: "Search by decedent name; record link or absent status with source ref." },
        { provider: "legacy", note: "Search Legacy.com obituaries; record link or absent status with source ref." },
        { provider: "google", note: "Record reviewed Google result links or absent status; no automated account probing." },
      ],
      confidence: 0.4,
      reviewFlags: ["SOURCE_HEALTH_ONLY", "HUMAN_REVIEW_REQUIRED", "NO_ENRICHMENT_RUN"],
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:death-certificate`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "death_certificate_status",
      value: deathCertificateStatus,
      confidence: hasValue(deathCertificateStatus) ? 0.65 : 0,
      sourceUrl,
      reviewFlags: flagsFor(deathCertificateStatus, workflow?.ok ? deathCertFlags : [...deathCertFlags, "VITAL_RECORDS_WORKFLOW_REQUIRED"]),
    }),
    fact({
      runId,
      source: "clerk_of_courts",
      rawId: `${rawId}:incarceration`,
      fetchedAt,
      county: seed.county,
      subject,
      factType: "incarceration_status_signal",
      value: incarcerationStatus,
      confidence: hasValue(incarcerationStatus) ? 0.65 : 0,
      sourceUrl,
      reviewFlags: flagsFor(incarcerationStatus, workflow?.ok ? missingFlags : vitalWorkflowFlags),
    }),
  ];
}
