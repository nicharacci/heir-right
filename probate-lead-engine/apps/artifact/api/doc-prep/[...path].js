const { readJsonBody, sendJson } = require("../_shared");
const { authRequired, readSession } = require("../auth/_shared");

function processApiBase() {
  return String(process.env.HEIRRIGHT_PROCESS_API_URL || "").replace(/\/+$/, "");
}

function trustedSession(request) {
  const session = readSession(request);
  if (session?.email) return session;
  if (!authRequired()) return { email: "local-dev@heirright.com", name: "Local development" };
  return null;
}

function routeFor(request) {
  const requestUrl = new URL(request.url || "/api/doc-prep", "https://surface.heirright.com");
  const path = requestUrl.pathname;
  const caseMatch = path.match(/^\/api\/doc-prep\/cases\/([^/]+)(\/download|\/view|\/events|\/actions\/(retry|cancel))?$/);
  if (path === "/api/doc-prep/cases") return `/v1/doc-prep/cases${requestUrl.search}`;
  if (path === "/api/doc-prep/exports/google-drive") return "/v1/doc-prep/exports/google-drive";
  return caseMatch ? `/v1/doc-prep/cases/${encodeURIComponent(caseMatch[1])}${caseMatch[2] || ""}${requestUrl.search}` : "";
}

function publicOrigin(request) {
  const host = request.headers["x-forwarded-host"] || request.headers.host || "surface.heirright.com";
  const proto = request.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function intakeIdempotencyKey(request, body, path) {
  const supplied = request.headers["idempotency-key"] || request.headers["Idempotency-Key"];
  if (typeof supplied === "string" && supplied) return supplied;
  if (path !== "/v1/doc-prep/cases") return "";
  const estateId = String(body?.estates?.[0]?.estateId || "").trim();
  const normalized = estateId.replace(/[^A-Za-z0-9._:-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized ? `docprep-intake-${normalized}` : "";
}

module.exports = async function handler(request, response) {
  if (!(["GET", "POST"].includes(request.method || ""))) {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const session = trustedSession(request);
  if (!session) {
    sendJson(response, 401, { ok: false, error: "auth_required", message: "Sign in with an approved HeirRight Google account.", loginUrl: "/auth/login" });
    return;
  }
  const path = routeFor(request);
  const base = processApiBase();
  if (!path) {
    sendJson(response, 404, { ok: false, error: "not_found" });
    return;
  }
  if (!base || !process.env.HEIRRIGHT_PROCESS_API_TOKEN) {
    sendJson(response, 503, { ok: false, error: "document_prep_not_configured" });
    return;
  }
  try {
    const requestBody = request.method === "POST" ? await readJsonBody(request) : undefined;
    const body = requestBody ? JSON.stringify({
      ...requestBody,
      ...(Array.isArray(requestBody.estates) ? { estates: requestBody.estates.map((estate) => ({ ...estate, actor: { email: session.email, name: session.name || session.email } })) } : {}),
    }) : undefined;
    const idempotencyKey = intakeIdempotencyKey(request, requestBody, path);
    const upstream = await fetch(`${base}${path}`, {
      method: request.method,
      body,
      headers: {
        ...(body ? { "content-type": "application/json" } : {}),
        authorization: `Bearer ${process.env.HEIRRIGHT_PROCESS_API_TOKEN}`,
        "x-heirright-actor-email": session.email,
        "x-heirright-actor-name": session.name || session.email,
        "x-heirright-public-origin": publicOrigin(request),
        ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
        ...(request.headers["last-event-id"] ? { "last-event-id": request.headers["last-event-id"] } : {}),
      },
    });
    response.statusCode = upstream.status;
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) response.setHeader("Content-Disposition", disposition);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    sendJson(response, 502, { ok: false, error: "document_prep_proxy_failed", message: error instanceof Error ? error.message : "Document preparation request failed." });
  }
};
