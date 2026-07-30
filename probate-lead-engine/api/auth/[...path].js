const { handleRequest } = require("../../apps/artifact/server");

module.exports = function authApi(req, res) {
  req.url = String(req.url || "/").replace(/^\/api\/auth/, "/auth");
  return handleRequest(req, res);
};
