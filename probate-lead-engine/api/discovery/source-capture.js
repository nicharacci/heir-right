const { handleRequest } = require("../../apps/artifact/server");

module.exports = function sourceCaptureApi(req, res) {
  return handleRequest(req, res);
};
