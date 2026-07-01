const { methodGuard, readJsonBody, receiptId, sendJson } = require("../_shared");

function fallback(message, extra = {}) {
  return {
    ok: false,
    status: "architecturally_free_outreach",
    fallback: "Architecturally Free Outreach",
    message,
    blockers: [
      "Activepieces webhook is not configured or did not accept the request.",
      "No direct SMS, email, CRM card, Google Doc, or Resend message was created by HeirRight Leads.",
    ],
    ...extra,
  };
}

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;
  try {
    const body = await readJsonBody(request);
    const webhookUrl = process.env.ACTIVEPIECES_WEBHOOK_URL || process.env.HEIRRIGHT_ACTIVEPIECES_WEBHOOK_URL || "";
    if (!body.template?.id || !body.template?.body) {
      sendJson(response, 400, { ok: false, error: "template_required", message: "Approved outreach template is required." });
      return;
    }
    if (!webhookUrl) {
      sendJson(response, 200, fallback("Activepieces is not configured. The reviewed template was staged in the app-owned outreach queue."));
      return;
    }
    if (!body.podioReady) {
      sendJson(response, 200, fallback("Podio is not ready for automation. The reviewed template was staged in the app-owned outreach queue."));
      return;
    }
    const runId = receiptId("activepieces");
    const headers = { "content-type": "application/json" };
    if (process.env.ACTIVEPIECES_API_KEY) headers.authorization = `Bearer ${process.env.ACTIVEPIECES_API_KEY}`;
    const upstream = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        runId,
        source: "HeirRight Leads",
        actor: body.actor || "office user",
        requestedAt: body.requestedAt || new Date().toISOString(),
        campaign: body.campaign || null,
        template: body.template,
        lead: body.lead || null,
        guardrails: {
          noDirectSend: true,
          requiresReadbackProof: true,
          podioReady: Boolean(body.podioReady),
        },
      }),
    });
    const upstreamBody = await upstream.text();
    if (!upstream.ok) {
      sendJson(response, 200, fallback(`Activepieces returned ${upstream.status}. The app staged the fallback outreach package.`, { upstreamStatus: upstream.status }));
      return;
    }
    sendJson(response, 200, {
      ok: true,
      status: "activepieces_queued",
      runId,
      upstreamStatus: upstream.status,
      upstreamPreview: upstreamBody.slice(0, 500),
      message: "Activepieces accepted the Podio outreach workflow request.",
    });
  } catch (error) {
    sendJson(response, 200, fallback(error.message || "Activepieces outreach failed."));
  }
};
