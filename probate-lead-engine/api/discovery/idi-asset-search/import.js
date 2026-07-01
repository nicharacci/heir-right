const { handleRequest } = require("../../../apps/artifact/server");

module.exports = function idiAssetSearchImportApi(req, res) {
  return handleRequest(req, res);
};
