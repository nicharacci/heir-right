const { readJsonBody, sendJson, sendWorkspaceResult, workspaceSession, workspaceWorkerRequest } = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const session = workspaceSession(request, response);
  if (!session) return;
  try {
    const body = await readJsonBody(request);
    const artifactId = String(body.artifactId || "").trim();
    const estateId = String(body.estateId || "").trim();
    const flow = String(body.flow || "").trim();
    const packetRevision = Number(body.packetRevision);
    if (!/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)) {
      sendJson(response, 400, { ok: false, error: "invalid_artifact_id", message: "A verified packet is required before Google Drive delivery." });
      return;
    }
    if (!estateId || estateId.length > 500 || !["discovery", "closing-docs"].includes(flow)
      || !Number.isInteger(packetRevision) || packetRevision < 1) {
      sendJson(response, 400, { ok: false, error: "packet_approval_binding_required", message: "Google Drive delivery needs the exact estate, workflow, and current packet revision." });
      return;
    }
    sendWorkspaceResult(response, await workspaceWorkerRequest(request, "/api/google-workspace/export", {
      method: "POST",
      body: { email: session.email, actorEmail: session.email, artifactId, estateId, flow, packetRevision },
    }));
  } catch (error) {
    sendJson(response, error.statusCode || 502, { ok: false, error: "google_workspace_export_failed", message: error.message || "Google Drive delivery is unavailable." });
  }
};
