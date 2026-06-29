const { methodGuard, proxyWorkerJson, readJsonBody, sendJson, sendProxied } = require("../_shared");

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/leads/fresh-batch", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    sendJson(response, 503, {
      ok: false,
      status: "blocked",
      error: "worker_not_configured",
      blockers: [
        "Fresh public-source pulls require HEIRRIGHT_WORKER_URL or WORKER_API_URL before production can run a real lead-generation batch.",
        "No paid lookup, public-source pull, CRM write, Google write, email, or SMS was attempted.",
      ],
      readbackEvidence: {
        status: "blocked",
        message: "The app stopped before external lead generation because the worker API route is not configured.",
      },
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Fresh lead request failed before any external lookup.",
    });
  }
};
