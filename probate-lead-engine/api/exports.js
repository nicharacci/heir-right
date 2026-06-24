const { handleRequest } = require("../apps/artifact/server");

module.exports = function exportsApi(req, res) {
  return handleRequest(req, res);
};
