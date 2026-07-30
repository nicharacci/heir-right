const { handleRequest } = require("../../apps/artifact/server");

module.exports = function externalSourceRunApi(req, res) {
  return handleRequest(req, res);
};
