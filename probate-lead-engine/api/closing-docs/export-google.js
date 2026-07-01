const { handleRequest } = require("../../apps/artifact/server");

module.exports = function closingDocsGoogleExportApi(req, res) {
  return handleRequest(req, res);
};
