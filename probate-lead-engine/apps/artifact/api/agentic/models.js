const { requireApiAuth, sendJson, proxyWorkerHttp } = require("../_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (requireApiAuth(request, response)) return;
  try {
    if (await proxyWorkerHttp(request, response, "/api/agentic/models", { method: "GET" })) return;
    sendJson(response, 503, { ok: false, error: "agentic_unavailable", message: "Automatic model selection is unavailable." });
  } catch {
    sendJson(response, 502, { ok: false, error: "agentic_unavailable", message: "Automatic model selection is unavailable." });
  }
};
