const { requireApiAuth } = require("../_shared");

function workerApiBase() {
  return String(process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "").replace(/\/+$/, "");
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const host = request.headers.host || "localhost";
  const query = new URL(request.url || "/api/reports/pdf", `https://${host}`).searchParams;
  const artifactId = String(query.get("artifactId") || "");
  if (!/^packet-[0-9]+-[a-f0-9]{16}$/.test(artifactId)) {
    sendJson(response, 400, {
      ok: false,
      error: "invalid_artifact_id",
      message: "Generate a packet before opening its PDF.",
    });
    return;
  }

  const base = workerApiBase();
  if (!base) {
    sendJson(response, 503, {
      ok: false,
      error: "worker_not_configured",
      message: "Packet rendering is unavailable until the worker connection is configured.",
    });
    return;
  }

  try {
    const headers = {};
    if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
    const upstream = await fetch(`${base}/api/reports/pdf?artifactId=${encodeURIComponent(artifactId)}`, { headers });
    const body = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = upstream.status;
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    const disposition = upstream.headers.get("content-disposition");
    if (disposition) response.setHeader("Content-Disposition", disposition);
    const contentHash = upstream.headers.get("x-heirright-content-hash");
    if (contentHash) response.setHeader("X-HeirRight-Content-Hash", contentHash);
    const artifactIdHeader = upstream.headers.get("x-heirright-artifact-id");
    if (artifactIdHeader) response.setHeader("X-HeirRight-Artifact-Id", artifactIdHeader);
    response.end(body);
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      error: "packet_fetch_failed",
      message: error instanceof Error ? error.message : "Packet retrieval failed.",
    });
  }
};
