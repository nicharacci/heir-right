const { readJsonBody, sendJson, sendWorkspaceResult, workspaceSession, workspaceWorkerRequest } = require("./_shared");

module.exports = async function handler(request, response) {
  if (!new Set(["GET", "POST"]).has(request.method)) {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const session = workspaceSession(request, response);
  if (!session) return;
  try {
    if (request.method === "GET") {
      sendWorkspaceResult(response, await workspaceWorkerRequest(
        request,
        `/api/google-workspace/destinations?email=${encodeURIComponent(session.email)}`,
      ));
      return;
    }
    const body = await readJsonBody(request);
    const destinationId = String(body.destinationId || "").trim();
    const destinationName = String(body.destinationName || "").trim().slice(0, 180);
    if (!destinationId || !destinationName) {
      sendJson(response, 400, { ok: false, error: "google_workspace_destination_required", message: "Choose a Drive folder before continuing." });
      return;
    }
    sendWorkspaceResult(response, await workspaceWorkerRequest(request, "/api/google-workspace/connection", {
      method: "POST",
      body: { action: "select_destination", email: session.email, destinationId, destinationName },
    }));
  } catch (error) {
    sendJson(response, error.statusCode || 502, { ok: false, error: "google_workspace_destination_failed", message: error.message || "Google Workspace folders are unavailable." });
  }
};
