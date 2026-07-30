const { handleRequest } = require("../../apps/artifact/server");

module.exports = function reportPdfApi(req, res) {
  return handleRequest(req, res);
};
