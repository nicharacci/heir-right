const { allowDocPrepSource, proxyWorkerHttp, requireApiAuth, sendJson } = require("../_shared");

module.exports = async function handler(request, response) {
  allowDocPrepSource(request);
  if (requireApiAuth(request, response)) return;
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  const url = new URL(request.url || "/api/discovery/file", "https://surface.heirright.com");
  const estateId = String(url.searchParams.get("estateId") || "").trim();
  if (!estateId) {
    sendJson(response, 400, { ok: false, error: "estate_id_required", message: "Choose an estate before loading its Discovery File." });
    return;
  }
  const proxied = await proxyWorkerHttp(
    request,
    response,
    `/api/discovery/file?estateId=${encodeURIComponent(estateId)}`,
    { method: "GET" }
  );
  if (!proxied) {
    sendJson(response, 503, { ok: false, error: "worker_unavailable", message: "Discovery File storage is unavailable." });
  }
};
