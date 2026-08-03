const {
  proxyWorkerJson,
  readJsonBody,
  requireApiAdmin,
  requireApiAuth,
  sendJson,
} = require("../../_shared");

async function handleAdminSettings(request, response, action) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (requireApiAdmin(request, response)) return;

  try {
    const body = await readJsonBody(request);
    const password = String(action === "unlock" ? body.password || "" : body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (action === "unlock" && !password) {
      sendJson(response, 422, { ok: false, error: "admin_password_required", message: "Enter the server-managed admin password key." });
      return;
    }
    if (action === "rotate" && (password.length < 1 || newPassword.length < 12)) {
      sendJson(response, 422, { ok: false, error: "admin_password_invalid", message: "The new admin password key must be at least 12 characters." });
      return;
    }

    const proxied = await proxyWorkerJson("/api/admin/settings", {
      action,
      ...(action === "unlock" ? { password } : { currentPassword: password, newPassword }),
    });
    if (!proxied) {
      sendJson(response, 503, { ok: false, error: "worker_unavailable", message: "Admin settings storage is unavailable." });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(proxied.body || "{}");
    } catch {
      sendJson(response, 502, { ok: false, error: "admin_settings_invalid_response", message: "Admin settings did not return a readable server response." });
      return;
    }
    sendJson(response, proxied.status, payload);
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "admin_settings_request_failed", message: error instanceof Error ? error.message : "Admin settings request failed." });
  }
}

module.exports = { handleAdminSettings };
