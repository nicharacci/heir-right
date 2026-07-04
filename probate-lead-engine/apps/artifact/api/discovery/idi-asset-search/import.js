const { idiLockKey, methodGuard, proxyWorkerJson, readJsonBody, sendJson, sendProxied } = require("../../_shared");
const { buildIdiCoreStatus } = require("../../connections/status");

const localIdiRuns = new Map();

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function idiCoreUserApiKey(body = {}) {
  return stringValue(body.idiCoreApiKey || body.userApiKey);
}

function idiCoreSharedApiKey(env = process.env) {
  return stringValue(env.IDI_CORE_API_TOKEN || env.HEIRRIGHT_IDI_CORE_API_TOKEN || env.IDI_CORE_API_KEY);
}

function idiCoreRequestApiKey(body = {}, env = process.env) {
  return idiCoreUserApiKey(body) || idiCoreSharedApiKey(env);
}

function idiCoreApiKeySource(body = {}, env = process.env) {
  if (idiCoreUserApiKey(body)) return "user_override";
  return idiCoreSharedApiKey(env) ? "shared_default" : "missing";
}

function idiCoreMissingConfig(body = {}, env = process.env) {
  const missing = [];
  if (!env.IDI_CORE_API_URL) missing.push("IDI_CORE_API_URL");
  if (!idiCoreRequestApiKey(body, env)) missing.push("IDI_CORE_API_TOKEN");
  return missing;
}

function idiCoreLiveApproved(body = {}, env = process.env) {
  return body.liveRunApproved === true || body.liveRunApproved === "true" || env.IDI_CORE_LIVE_RUN_APPROVED === "true";
}

function operatorAccessList(items = []) {
  return items.map((item) => String(item || "")
    .replace(/IDI_CORE_API_URL/g, "IDI Core endpoint")
    .replace(/HEIRRIGHT_IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_TOKEN/g, "IDI Core access")
    .replace(/IDI_CORE_API_KEY/g, "IDI Core access")
  ).join(", ");
}

function redactIdiCoreProviderResponse(value, depth = 0) {
  if (depth > 6) return null;
  if (Array.isArray(value)) return value.map((item) => redactIdiCoreProviderResponse(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
    key,
    /authorization|api[_-]?key|token|secret|password/i.test(key)
      ? "[redacted]"
      : redactIdiCoreProviderResponse(nested, depth + 1),
  ]));
}

async function runLiveIdiCore(body = {}, lockKey = "") {
  const apiKey = idiCoreRequestApiKey(body);
  const apiKeySource = idiCoreApiKeySource(body);
  if (!idiCoreLiveApproved(body)) {
    return {
      ok: false,
      status: 403,
      error: "idi_live_run_not_approved",
      blockers: ["A live IDI Core run needs explicit approval before the app can spend a paid lookup."],
      message: "Live IDI Core is blocked until the review owner approves this paid asset search.",
      apiKeySource,
    };
  }
  const missing = idiCoreMissingConfig(body);
  if (missing.length) {
    return {
      ok: false,
      status: 503,
      error: "idi_core_not_configured",
      blockers: [`Live IDI Core needs approved access before it can run: ${operatorAccessList(missing)}.`],
      message: "Live IDI Core is not configured. Import an approved report or add vendor access before running the paid search.",
      idiCoreStatus: buildIdiCoreStatus(process.env),
      apiKeySource,
    };
  }
  const response = await fetch(process.env.IDI_CORE_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      propertyAddress: body.propertyAddress || body.address || body.assetAddress,
      ownerName: body.ownerName || body.estateName,
      estateName: body.estateName || body.ownerName,
      county: body.county || "miami-dade",
      lockKey,
      reason: body.reason || "HeirRight controlled asset-search proof",
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    return {
      ok: false,
      status: response.status || 502,
      error: data.error || "idi_core_run_failed",
      blockers: data.blockers || [`IDI Core returned ${response.status}. No Discovery contact facts were accepted.`],
      message: data.message || "Live IDI Core did not complete. The Discovery file remains blocked.",
      providerResponse: redactIdiCoreProviderResponse(data),
      apiKeySource,
    };
  }
  const candidates = Array.isArray(data.candidates) ? data.candidates : Array.isArray(data.contactCandidates) ? data.contactCandidates : [];
  return {
    ok: true,
    status: 200,
    mode: "live_idi_core",
    provider: body.provider || "idi",
    lockKey,
    importedAt: new Date().toISOString(),
    duplicateGuard: body.adminOverrideReason ? "admin_override_recorded" : "first_paid_run_only",
    adminOverrideReason: body.adminOverrideReason || null,
    paidRun: true,
    apiKeySource,
    readbackStatus: data.readbackStatus || data.status || "provider_completed",
    sourceEvidence: data.sourceEvidence || data.evidence || null,
    attachment: data.attachment || body.attachment || null,
    importedText: data.importedText || data.reportText || "",
    candidates,
    contactPreviewCount: candidates.length || stringValue(data.importedText || data.reportText).split(/\n{2,}/).filter(Boolean).length,
    message: "Live IDI Core asset search completed and is ready for contact review.",
  };
}

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const proxied = await proxyWorkerJson("/api/discovery/idi-asset-search/import", body);
    if (proxied) {
      sendProxied(response, proxied);
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

    const wantsLiveRun = body.runMode === "live_idi_core" || body.mode === "live_idi_core" || body.paidRun === true;
    if (wantsLiveRun) {
      const result = await runLiveIdiCore(body, lockKey);
      if (result.ok) {
        localIdiRuns.set(lockKey, result);
        sendJson(response, 200, result);
        return;
      }
      sendJson(response, result.status || 503, result);
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
