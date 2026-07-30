const { handleRequest } = require("../../apps/artifact/server");

module.exports = function publicSourcePullApi(req, res) {
  return handleRequest(req, res);
};
