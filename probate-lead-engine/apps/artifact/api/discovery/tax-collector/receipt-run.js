const { methodGuard, proxyWorkerJson, readJsonBody, requireApiAuth, sendJson, sendProxied } = require("../../_shared");
const { runTaxCollectorReceiptSearch } = require("./service");

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/tax-collector/receipt-run", body);
    if (proxied && proxied.status !== 404) {
      sendProxied(response, proxied);
      return;
    }

    const result = await runTaxCollectorReceiptSearch(body);
    sendJson(response, result.ok ? 200 : 200, result);
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      mode: "request_failed",
      flow: "tax_collector_receipt",
      paidRun: false,
      blockers: [error instanceof Error ? error.message : "Tax Collector receipt run failed before a public source could be checked."],
      message: "Tax Collector receipt run failed before a public source could be checked.",
    });
  }
};
