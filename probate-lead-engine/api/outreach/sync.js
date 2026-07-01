const { handleRequest } = require("../../apps/artifact/server");

module.exports = function outreachSyncApi(req, res) {
  return handleRequest(req, res);
};
