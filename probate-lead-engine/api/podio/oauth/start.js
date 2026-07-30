const { handleRequest } = require("../../../apps/artifact/server");

module.exports = function podioOAuthStartApi(req, res) {
  return handleRequest(req, res);
};
