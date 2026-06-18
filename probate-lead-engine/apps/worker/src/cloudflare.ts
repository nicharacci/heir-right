import type { IntakeSeed } from "@ple/types";
import { runDailyProduction } from "./daily/run-daily";
import { connectionStatuses, exportCompletedReport } from "./export/export-package";
import { runDryPipeline } from "./index";
import { renderQualificationReviewMarkdown } from "./qualification/qualification-review";
import { buildReadbackEvidencePacket, renderReadbackEvidenceMarkdown } from "./readback/readback-evidence";

interface CloudflareEnv {
  DEPLOYMENT_KEY?: string;
  COUNTY_LIST?: string;
  PODIO_ACCESS_TOKEN?: string;
  PODIO_APP_ID?: string;
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

async function exportResponse(request: Request, url: URL, env: CloudflareEnv): Promise<Response> {
  const dryRun = url.searchParams.get("dry-run") !== "false";
  const routesParam = url.searchParams.get("routes");
  const routes = routesParam
    ? routesParam.split(",").map((route) => route.trim()).filter((route): route is "google" | "podio" => route === "google" || route === "podio")
    : ["google", "podio"] as Array<"google" | "podio">;
  const body = request.method === "POST"
    ? await request.json().catch(() => undefined) as { seed?: IntakeSeed; routes?: Array<"google" | "podio">; dryRun?: boolean } | undefined
    : undefined;
  const pipeline = await runDryPipeline(body?.seed ?? seedFromUrl(url, env), {
    env: env as Record<string, string | undefined>,
  });
  const result = await exportCompletedReport({
    routes: body?.routes ?? routes,
    dossier: pipeline.dossier,
    dryRun: body?.dryRun ?? dryRun,
  }, env as Record<string, string | undefined>);
  return json(result, { headers: { "cache-control": "no-store" } });
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
        endpoints: [
          "/dry-run",
          "/latest-run.json",
          "/latest-dossier.json",
          "/podio-dry-run.json",
          "/internal-summary.md",
          "/internal-summary.html",
          "/daily-run.json",
          "/qualification-review.json",
          "/qualification-review.md",
          "/readback-evidence.json",
          "/readback-evidence.md",
          "/api/exports",
          "/api/connections/status",
        ],
      });
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

    if (url.pathname === "/api/exports" || url.pathname === "/export-result.json") {
      const blocked = await authBlocker(request, env);
      if (blocked) return blocked;
      return exportResponse(request, url, env);
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
