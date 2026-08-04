const { idiLockKey, methodGuard, proxyWorkerHttp, proxyWorkerJson, readJsonBody, requireApiAdmin, requireApiAuth, sendJson, sendProxied } = require("../../_shared");

const localIdiRuns = new Map();

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function idiCoreLiveApproved(_body = {}, env = process.env) {
  return env.IDI_CORE_LIVE_RUN_APPROVED === "true";
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method === "GET") {
    const url = new URL(request.url || "/api/discovery/idi-asset-search/import", "https://surface.heirright.com");
    const assetKey = stringValue(url.searchParams.get("assetKey"));
    if (!assetKey) {
      sendJson(response, 400, { ok: false, error: "asset_key_required", message: "Choose an estate before loading its imported IDI report." });
      return;
    }
    if (await proxyWorkerHttp(
      request,
      response,
      `/api/discovery/idi-asset-search/import?assetKey=${encodeURIComponent(assetKey)}`,
      { method: "GET" },
    )) return;
    sendJson(response, 503, {
      ok: false,
      error: "idi_import_store_unavailable",
      message: "The secure IDI report index is unavailable. The existing report remains protected; retry before uploading another copy.",
    });
    return;
  }
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const wantsLiveRun = body.runMode === "live_idi_core" || body.mode === "live_idi_core" || body.paidRun === true;
    if ((wantsLiveRun || stringValue(body.adminOverrideReason)) && requireApiAdmin(request, response)) return;
    if (wantsLiveRun && !idiCoreLiveApproved(body)) {
      sendJson(response, 403, {
        ok: false,
        error: "idi_live_run_not_approved",
        blockers: ["A live IDI Core run needs server-side approval before the app can spend a paid lookup."],
        message: "Live IDI Core is blocked until an administrator enables the approved paid-search window.",
      });
      return;
    }
    const proxied = await proxyWorkerJson("/api/discovery/idi-asset-search/import", body);
    if (proxied) {
      sendProxied(response, proxied);
      return;
    }

    if (wantsLiveRun) {
      sendJson(response, 503, {
        ok: false,
        error: "idi_paid_run_lock_unavailable",
        blockers: ["Paid IDI duplicate protection is unavailable, so no vendor request was sent."],
        message: "Live IDI Core is temporarily blocked because the paid-search lock could not be reserved.",
      });
      return;
    }

    const lockKey = idiLockKey(body);
    const existing = localIdiRuns.get(lockKey);
    if (existing && !body.adminOverrideReason) {
      sendJson(response, 409, {
        ok: false,
        error: "duplicate_idi_asset_search",
        message: "This estate address already has an imported IDI asset search. Admin override requires a reason.",
        lockKey,
        firstImportedAt: existing.importedAt,
      });
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

    const result = {
      ok: true,
      mode: "operator_import",
      provider: body.provider || "idi",
      lockKey,
      importedAt: new Date().toISOString(),
      duplicateGuard: existing ? "admin_override_recorded" : "first_import_only",
      adminOverrideReason: body.adminOverrideReason || null,
      attachment: body.attachment || null,
      contactPreviewCount: String(body.importedText || "").split(/\n{2,}/).filter(Boolean).length,
      paidRun: false,
      message: "Approved IDI report metadata was imported for review. The production artifact app did not run IDI Core.",
    };
    localIdiRuns.set(lockKey, result);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "IDI import failed before any paid lookup.",
    });
  }
};
