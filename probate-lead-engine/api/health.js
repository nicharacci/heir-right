const { handleRequest } = require("../apps/artifact/server");

module.exports = function healthApi(req, res) {
  req.url = "/health";
  return handleRequest(req, res);
};
