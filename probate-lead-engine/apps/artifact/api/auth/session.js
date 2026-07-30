const { sendJson, sessionBody } = require("./_shared");

module.exports = function handler(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.setHeader("Allow", "GET, HEAD");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  sendJson(response, 200, sessionBody(request));
};
