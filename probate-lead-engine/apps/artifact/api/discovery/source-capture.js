const { methodGuard, proxyWorkerJson, readJsonBody, receiptId, sendJson, sendProxied } = require("../_shared");

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/source-capture", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    sendJson(response, 200, {
      ok: true,
      mode: "review_receipt",
      id: body.assetKey || body.id || receiptId("source-capture"),
      capturedAt: new Date().toISOString(),
      artifact: body,
      reviewFlags: body.reviewFlags || [],
      message: "Source capture was accepted by the production artifact app. No external write was attempted.",
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Source capture failed before any external write.",
    });
  }
};
