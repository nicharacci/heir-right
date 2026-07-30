const { handleRequest } = require("../../apps/artifact/server");

module.exports = function deepHealthApi(req, res) {
  return handleRequest(req, res);
};
