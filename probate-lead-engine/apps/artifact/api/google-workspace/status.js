const { sendJson, sendWorkspaceResult, workspaceSession, workspaceWorkerRequest } = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const session = workspaceSession(request, response);
  if (!session) return;
  try {
    sendWorkspaceResult(response, await workspaceWorkerRequest(
      request,
      `/api/google-workspace/connection?email=${encodeURIComponent(session.email)}`,
    ));
  } catch (error) {
    sendJson(response, error.statusCode || 502, { ok: false, error: "google_workspace_unavailable", message: error.message || "Google Workspace status is unavailable." });
  }
};
