const { proxyWorkerHttp, readJsonBody, requireApiAuth, sendJson } = require("../_shared");

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  try {
    const url = new URL(request.url || "/api/workspace/state", "https://surface.heirright.com");
    const body = request.method === "POST" ? await readJsonBody(request) : null;
    const proxied = await proxyWorkerHttp(request, response, `/api/workspace/state${url.search}`, {
      method: request.method,
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!proxied) sendJson(response, 503, { ok: false, error: "worker_unavailable", message: "Shared workspace storage is unavailable." });
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "request_failed", message: error instanceof Error ? error.message : "Workspace state request failed." });
  }
};
