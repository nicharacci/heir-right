const { readJsonBody, requireApiAuth, sendJson } = require("../_shared");
const { effectiveSession } = require("../auth/_shared");

function workerApiBase() {
  return String(process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "").replace(/\/+$/, "");
}

function workspaceSession(request, response) {
  if (requireApiAuth(request, response)) return null;
  const session = effectiveSession(request) || (process.env.AUTH_REQUIRED === "false"
    ? { email: "local-review@heirright.com", mode: "local" }
    : null);
  if (session?.email) return session;
  sendJson(response, 401, { ok: false, error: "auth_required", message: "Sign in before connecting Google Workspace." });
  return null;
}

async function workspaceWorkerRequest(request, pathname, options = {}) {
  const base = workerApiBase();
  if (!base || !process.env.HEIRRIGHT_API_TOKEN) {
    const error = new Error("Google Workspace service is unavailable.");
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${base}${pathname}`, {
    method: options.method || "GET",
    headers: {
      authorization: `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      "x-heirright-public-origin": `${request.headers["x-forwarded-proto"] || "https"}://${request.headers["x-forwarded-host"] || request.headers.host || "surface.heirright.com"}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { statusCode: response.status, payload };
}

function sendWorkspaceResult(response, result) {
  sendJson(response, result.statusCode, result.payload);
}

module.exports = {
  readJsonBody,
  sendJson,
  sendWorkspaceResult,
  workspaceSession,
  workspaceWorkerRequest,
};
