const { handleRequest } = require("../../apps/artifact/server");

module.exports = function connectionStatusApi(req, res) {
  return handleRequest(req, res);
};
