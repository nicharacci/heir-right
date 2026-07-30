const { proxyWorkerHttp, requireApiAuth, sendJson } = require("./_shared");
const demoLatestRun = require("../demo/latest-run.json");

const runtimeArtifacts = new Map([
  ["latest-run.json", { workerPath: "/latest-run.json", fallback: () => demoLatestRun }],
  ["daily-run.json", { workerPath: "/daily-run.json", fallback: () => null }],
  ["fresh-lead-batch.json", { workerPath: "/fresh-lead-batch.json", fallback: () => ({ leadRuns: [] }) }],
  ["qualification-review.json", { workerPath: "/qualification-review.json", fallback: () => null }],
]);

function requestedArtifact(request) {
  const queryValue = Array.isArray(request.query?.name) ? request.query.name[0] : request.query?.name;
  if (queryValue) return String(queryValue).trim();
  try {
    const url = new URL(request.url || "/", "https://surface.heirright.com");
    const searchName = url.searchParams.get("name");
    if (searchName) return searchName;
    const pathName = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
    return runtimeArtifacts.has(pathName) ? pathName : "";
  } catch {
    return "";
  }
}

module.exports = async function runtimeArtifactHandler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  const name = requestedArtifact(request);
  const artifact = runtimeArtifacts.get(name);
  if (!artifact) {
    sendJson(response, 404, { ok: false, error: "runtime_artifact_not_found" });
    return;
  }

  try {
    const proxied = await proxyWorkerHttp(request, response, artifact.workerPath, { method: "GET" });
    if (proxied) return;
    sendJson(response, 200, artifact.fallback());
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      error: "runtime_artifact_unavailable",
      message: error instanceof Error ? error.message : "The authenticated runtime artifact is unavailable.",
    });
  }
};

module.exports.requestedArtifact = requestedArtifact;
module.exports.runtimeArtifacts = runtimeArtifacts;
