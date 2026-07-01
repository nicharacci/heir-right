const { handleRequest } = require("../../apps/artifact/server");

module.exports = function podioDiagnosticsApi(req, res) {
  return handleRequest(req, res);
};
