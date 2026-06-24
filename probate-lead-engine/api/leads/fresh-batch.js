const { handleRequest } = require("../../apps/artifact/server");

module.exports = function freshBatchApi(req, res) {
  return handleRequest(req, res);
};
