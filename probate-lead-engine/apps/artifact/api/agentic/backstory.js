const { readJsonBody, requireApiAuth, sendJson, proxyWorkerHttp } = require("../_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (requireApiAuth(request, response)) return;
  try {
    const body = await readJsonBody(request);
    if (await proxyWorkerHttp(request, response, "/api/agentic/backstory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })) return;
    sendJson(response, 503, { ok: false, error: "agentic_unavailable", message: "Reviewed evidence synthesis remains available." });
  } catch {
    sendJson(response, 502, { ok: false, error: "agentic_unavailable", message: "Reviewed evidence synthesis remains available." });
  }
};
