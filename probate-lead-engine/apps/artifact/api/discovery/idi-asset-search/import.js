const { idiLockKey, methodGuard, proxyWorkerJson, readJsonBody, sendJson, sendProxied } = require("../../_shared");

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/idi-asset-search/import", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    if (!String(body.importedText || "").trim() && !body.attachment?.sourceUrl) {
      sendJson(response, 400, {
        ok: false,
        error: "missing_idi_report",
        message: "Paste the approved IDI Asset Discovery report text or attach report metadata before importing.",
      });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      mode: "operator_import",
      provider: body.provider || "idi",
      lockKey: idiLockKey(body),
      importedAt: new Date().toISOString(),
      duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_import_only",
      adminOverrideReason: body.adminOverrideReason || null,
      attachment: body.attachment || null,
      contactPreviewCount: String(body.importedText || "").split(/\n{2,}/).filter(Boolean).length,
      paidRun: false,
      message: "Approved IDI report metadata was imported for review. The production artifact app did not run IDI Core.",
    });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "IDI import failed before any paid lookup.",
    });
  }
};
