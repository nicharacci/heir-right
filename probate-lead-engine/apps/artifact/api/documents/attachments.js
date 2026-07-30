const { requireApiAuth, sendJson } = require("../_shared");
const { effectiveSession } = require("../auth/_shared");

function workerApiBase() {
  return String(process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "").replace(/\/+$/, "");
}

function readBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) return Promise.resolve(request.body);
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 4_200_000) {
        reject(new Error("Supporting documents must be 3 MB or smaller."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (error) { reject(error); }
    });
  });
}

function workerHeaders(request, contentType = "") {
  const headers = {};
  if (contentType) headers["content-type"] = contentType;
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  if (request.headers.cookie) headers.cookie = request.headers.cookie;
  return headers;
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  const base = workerApiBase();
  if (!base) {
    sendJson(response, 503, { ok: false, error: "worker_unavailable", message: "Supporting document storage is unavailable." });
    return;
  }
  if (!new Set(["GET", "POST", "DELETE"]).has(request.method)) {
    response.setHeader("Allow", "GET, POST, DELETE");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  try {
    const host = request.headers.host || "surface.heirright.com";
    const inputUrl = new URL(request.url || "/api/documents/attachments", `https://${host}`);
    let body;
    if (request.method === "POST") {
      body = await readBody(request);
      const session = effectiveSession(request);
      body.uploadedBy = session?.email || "approved HeirRight user";
    }
    const upstream = await fetch(`${base}/api/documents/attachments${inputUrl.search}`, {
      method: request.method,
      headers: workerHeaders(request, body ? "application/json" : ""),
      body: body ? JSON.stringify(body) : undefined,
    });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    response.statusCode = upstream.status;
    response.setHeader("Cache-Control", upstream.headers.get("cache-control") || "private, no-store");
    response.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    for (const header of ["content-disposition", "x-heirright-artifact-id", "x-heirright-content-hash"]) {
      const value = upstream.headers.get(header);
      if (value) response.setHeader(header, value);
    }
    response.end(bytes);
  } catch (error) {
    sendJson(response, 400, { ok: false, error: "request_failed", message: error instanceof Error ? error.message : "Supporting document request failed." });
  }
};
