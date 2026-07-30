const { handleRequest } = require("../../apps/artifact/server");

module.exports = function linearSupportApi(req, res) {
  return handleRequest(req, res);
};
