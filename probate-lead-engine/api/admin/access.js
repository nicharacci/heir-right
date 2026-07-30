const { handleRequest } = require("../../apps/artifact/server");

module.exports = function adminAccessApi(req, res) {
  return handleRequest(req, res);
};
