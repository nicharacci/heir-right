const { handleRequest } = require("../../apps/artifact/server");

module.exports = function discoveryFileApi(req, res) {
  return handleRequest(req, res);
};
