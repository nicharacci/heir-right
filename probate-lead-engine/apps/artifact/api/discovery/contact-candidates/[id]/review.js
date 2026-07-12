const { methodGuard, proxyWorkerJson, readJsonBody, requireApiAuth, sendJson, sendProxied } = require("../../../_shared");

function candidateIdFromRequest(request) {
  if (request.query?.id) return Array.isArray(request.query.id) ? request.query.id[0] : request.query.id;
  const path = String(request.url || "").split("?")[0];
  const parts = path.split("/").filter(Boolean);
  return decodeURIComponent(parts.at(-2) || "contact-candidate");
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (methodGuard(request, response)) return;

  const candidateId = candidateIdFromRequest(request);
  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson(`/api/discovery/contact-candidates/${encodeURIComponent(candidateId)}/review`, body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    sendJson(response, 200, {
      ok: true,
      mode: "review_receipt",
      candidateId,
      status: body.status || "accepted",
      reviewedAt: new Date().toISOString(),
      reviewedBy: body.reviewedBy || "operator",
      message: "Contact review was accepted by the production artifact app. No external write was attempted.",
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Contact review failed before any external write.",
    });
  }
};
