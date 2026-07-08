const { proxyWorkerHttp, sendJson } = require("../../_shared");
const { authRequired, loginPage, readSession, sendHtml } = require("../../auth/_shared");

function authGate(request, response) {
  if (!authRequired()) return false;
  if (readSession(request)) return false;
  sendHtml(response, 401, loginPage(request, "Sign in before connecting Podio for the HeirRight team."));
  return true;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (authGate(request, response)) return;
  try {
    const proxied = await proxyWorkerHttp(request, response, "/api/podio/oauth/start");
    if (!proxied) {
      sendJson(response, 503, {
        ok: false,
        error: "worker_unavailable",
        message: "Podio connect is unavailable until HEIRRIGHT_WORKER_URL is configured.",
      });
    }
  } catch (error) {
    sendJson(response, 502, { ok: false, error: error instanceof Error ? error.message : "podio_oauth_start_failed" });
  }
};
