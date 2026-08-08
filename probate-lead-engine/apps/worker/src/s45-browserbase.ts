export type S45BrowserbaseEnv = {
  BROWSERBASE_API_KEY?: string;
  OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID?: string;
  BROWSERBASE_API_BASE?: string;
  BROWSERBASE_PROJECT_ID?: string;
};

export type S45VitalFinding = {
  sourceUrl: string;
  dateOfBirth?: string;
  dateOfDeath?: string;
  obituarySnapshot?: string;
  invocationId?: string;
  sessionId?: string;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

function approvedObituaryResult(value: unknown): string {
  const result = record(value);
  const url = text(result.url);
  const title = text(result.title);
  if (!url.startsWith("https://")) return "";
  let hostname = "";
  try { hostname = new URL(url).hostname.toLowerCase(); } catch { return ""; }
  if (/(^|\.)(google\.[^.]+|bing\.com|duckduckgo\.com)$/.test(hostname)) return "";
  return /obituar|memorial|death-notice|tribute|legacy\.com|findagrave\.com|everloved\.com|dignitymemorial\.com/i.test(`${url} ${title}`) ? url : "";
}

async function discoverSourceUrls(apiBase: string, apiKey: string, input: { ownerName: string; county?: string }): Promise<string[]> {
  const ownerName = text(input.ownerName).slice(0, 100);
  const countyInput = text(input.county);
  const county = /miami[- ]dade/i.test(countyInput) ? "Miami-Dade" : countyInput.slice(0, 40) || "Miami-Dade";
  const query = `"${ownerName}" ${county} obituary memorial`.slice(0, 200);
  const response = await fetch(apiBase + "/v1/search", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({ query, numResults: 25 }),
  });
  if (!response.ok) throw new Error(`browserbase_search_failed_${response.status}`);
  const results = record(await response.json().catch(() => ({}))).results;
  return [...new Set((Array.isArray(results) ? results : []).map(approvedObituaryResult).filter(Boolean))].slice(0, 8);
}

async function waitForResult(invocation: Record<string, unknown>, apiBase: string, apiKey: string): Promise<Record<string, unknown>> {
  let current = invocation;
  const id = text(current.id);
  const deadline = Date.now() + 45_000;
  while (id && ["PENDING", "RUNNING"].includes(text(current.status).toUpperCase()) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const statusResponse = await fetch(apiBase + "/v1/functions/invocations/" + encodeURIComponent(id), {
      headers: { accept: "application/json", "x-bb-api-key": apiKey },
    });
    const next = record(await statusResponse.json().catch(() => ({})));
    if (!statusResponse.ok || !Object.keys(next).length) break;
    current = next;
  }
  return current;
}

/** Invokes the existing approved Browserbase vital/obituary function for one case. */
export async function runS45VitalObituary(
  env: S45BrowserbaseEnv,
  input: { ownerName: string; county?: string; propertyAddress?: string },
): Promise<S45VitalFinding> {
  const apiKey = text(env.BROWSERBASE_API_KEY);
  const functionId = text(env.OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID);
  if (!apiKey || !functionId) throw new Error("browserbase_vital_workflow_unconfigured");
  const apiBase = text(env.BROWSERBASE_API_BASE) || "https://api.browserbase.com";
  const normalizedApiBase = apiBase.endsWith("/") ? apiBase.slice(0, -1) : apiBase;
  const sourceUrls = await discoverSourceUrls(normalizedApiBase, apiKey, input);
  const response = await fetch(normalizedApiBase + "/v1/functions/" + encodeURIComponent(functionId) + "/invoke", {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "x-bb-api-key": apiKey },
    body: JSON.stringify({
      params: {
        ownerName: input.ownerName,
        estateName: input.ownerName,
        county: input.county || "Miami-Dade",
        propertyAddress: input.propertyAddress || "",
        sourceUrls,
      },
      sessionCreateParams: {
        projectId: text(env.BROWSERBASE_PROJECT_ID) || undefined,
        browserSettings: { recordSession: true, logSession: true, solveCaptchas: true, enablePdfViewer: true },
        timeout: 900,
      },
    }),
  });
  if (!response.ok) throw new Error(`browserbase_vital_invoke_failed_${response.status}`);
  const completed = await waitForResult(record(await response.json().catch(() => ({}))), normalizedApiBase, apiKey);
  if (["PENDING", "RUNNING"].includes(text(completed.status).toUpperCase())) throw new Error("browserbase_vital_timeout");
  const result = record(completed.results);
  const sourceUrl = text(result.sourceUrl) || text(result.obituaryLink);
  if (!sourceUrl || !sourceUrl.startsWith("https://")) throw new Error("browserbase_vital_source_not_found");
  const finding: S45VitalFinding = {
    sourceUrl,
    ...(text(result.dateOfBirth) ? { dateOfBirth: text(result.dateOfBirth) } : {}),
    ...(text(result.dateOfDeath) ? { dateOfDeath: text(result.dateOfDeath) } : {}),
    ...(text(result.obituarySnapshot) ? { obituarySnapshot: text(result.obituarySnapshot).slice(0, 1200) } : {}),
    ...(text(completed.id) ? { invocationId: text(completed.id) } : {}),
    ...(text(completed.sessionId) ? { sessionId: text(completed.sessionId) } : {}),
  };
  return finding;
}
