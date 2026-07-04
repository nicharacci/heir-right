const { handleRequest } = require("../../../apps/artifact/server");

module.exports = function idiCoreStatusApi(req, res) {
  return handleRequest(req, res);
};
