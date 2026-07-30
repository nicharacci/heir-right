const { handleRequest } = require("../../../apps/artifact/server");

module.exports = function podioOAuthCallbackApi(req, res) {
  return handleRequest(req, res);
};
