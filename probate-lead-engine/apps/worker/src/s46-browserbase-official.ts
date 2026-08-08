export type S46OfficialRecordsEnv = {
  BROWSERBASE_API_KEY?: string;
  BROWSERBASE_API_BASE?: string;
  BROWSERBASE_PROJECT_ID?: string;
  OFFICIAL_RECORDS_BROWSERBASE_FUNCTION_ID?: string;
};

export type S46OfficialRecord = {
  clerkFileNumber: string;
  partyName: string;
  address: string;
  documentType: string;
  recordedDate: string;
  bookPage: string;
};

export type S46OfficialFinding = {
  outcome: "found" | "checked_not_found";
  recordCount: number;
  sourceUrl: string;
  latestDeed?: S46OfficialRecord;
  invocationId?: string;
  sessionId?: string;
};

type JsonRecord = Record<string, unknown>;
const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): JsonRecord => value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};

async function waitForResult(invocation: JsonRecord, apiBase: string, apiKey: string): Promise<JsonRecord> {
  let current = invocation;
  const id = text(current.id);
  const deadline = Date.now() + 60_000;
  while (id && ["PENDING", "RUNNING"].includes(text(current.status).toUpperCase()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await fetch(`${apiBase}/v1/functions/invocations/${encodeURIComponent(id)}`, {
      headers: { accept: "application/json", "x-bb-api-key": apiKey },
    });
    const next = record(await response.json().catch(() => ({})));
    if (!response.ok || !Object.keys(next).length) break;
    current = next;
  }
  return current;
}

export async function runS46OfficialRecords(
  env: S46OfficialRecordsEnv,
  input: { ownerName: string; propertyAddress: string; parcelId: string },
): Promise<S46OfficialFinding> {
  const apiKey = text(env.BROWSERBASE_API_KEY);
  const functionId = text(env.OFFICIAL_RECORDS_BROWSERBASE_FUNCTION_ID);
  const apiBase = (text(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com").replace(/\/$/, "");
  if (!apiKey || !functionId) throw new Error("browserbase_official_records_unconfigured");
  if (!input.propertyAddress) throw new Error("official_records_property_address_required");

  const response = await fetch(`${apiBase}/v1/functions/${encodeURIComponent(functionId)}/invoke`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({
      params: input,
      sessionCreateParams: {
        projectId: text(env.BROWSERBASE_PROJECT_ID) || undefined,
        browserSettings: { recordSession: true, logSession: true, solveCaptchas: true },
        timeout: 900,
      },
    }),
  });
  if (!response.ok) throw new Error(`browserbase_official_records_invoke_failed_${response.status}`);
  const completed = await waitForResult(record(await response.json().catch(() => ({}))), apiBase, apiKey);
  const status = text(completed.status).toUpperCase();
  if (["PENDING", "RUNNING"].includes(status)) throw new Error("browserbase_official_records_timeout");
  if (status !== "COMPLETED") throw new Error(`browserbase_official_records_${status.toLowerCase() || "failed"}`);

  const result = record(completed.results);
  if (result.ok !== true) throw new Error(`browserbase_official_records_${text(result.mode) || "failed"}`);
  const sourceUrl = text(result.sourceUrl);
  let source: URL;
  try { source = new URL(sourceUrl); } catch { throw new Error("browserbase_official_records_invalid_source_url"); }
  if (source.protocol !== "https:" || source.hostname !== "onlineservices.miamidadeclerk.gov") {
    throw new Error("browserbase_official_records_unapproved_source");
  }
  const latest = record(result.latestDeed);
  const finding: S46OfficialFinding = {
    outcome: text(result.mode) === "found" ? "found" : "checked_not_found",
    recordCount: Number(result.recordCount || 0),
    sourceUrl,
    ...(text(completed.id) ? { invocationId: text(completed.id) } : {}),
    ...(text(completed.sessionId) ? { sessionId: text(completed.sessionId) } : {}),
  };
  if (finding.outcome === "found") {
    finding.latestDeed = {
      clerkFileNumber: text(latest.clerkFileNumber),
      partyName: text(latest.partyName),
      address: text(latest.address),
      documentType: text(latest.documentType),
      recordedDate: text(latest.recordedDate),
      bookPage: text(latest.bookPage),
    };
  }
  return finding;
}
