const { readJsonBody, sendJson, sendWorkspaceResult, workspaceSession, workspaceWorkerRequest } = require("../google-workspace/_shared");

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
    const estateId = String(body.estateId || "").trim();
    const flow = String(body.flow || "").trim();
    const packetRevision = Number(body.packetRevision);
    const artifactId = String(body.artifactId || "").trim();
    const action = body.action === undefined
      ? "approve"
      : typeof body.action === "string" ? body.action.trim() : "";
    if (!estateId || estateId.length > 500
      || !["discovery", "closing-docs"].includes(flow)
      || !Number.isInteger(packetRevision) || packetRevision < 1
      || !/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)
      || (body.action !== undefined && typeof body.action !== "string")
      || !["approve", "status"].includes(action)) {
      sendJson(response, 400, {
        ok: false,
        error: "packet_approval_binding_required",
        message: "Approval needs the exact estate, workflow, current revision, and verified packet.",
      });
      return;
    }
    sendWorkspaceResult(response, await workspaceWorkerRequest(request, "/api/doc-prep/packet-approval", {
      method: "POST",
      body: { action, estateId, flow, packetRevision, artifactId, actorEmail: session.email },
    }));
  } catch (error) {
    sendJson(response, error.statusCode || 502, {
      ok: false,
      error: "packet_approval_failed",
      message: error.message || "Packet approval is unavailable.",
    });
  }
};
