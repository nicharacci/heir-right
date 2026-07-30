const { buildIdiCoreStatus } = require("../../connections/status");
const { requireApiAuth } = require("../../_shared");

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = 200;
  response.end(JSON.stringify(buildIdiCoreStatus(process.env), null, 2));
};
