const { handleRequest } = require("../../apps/artifact/server");

module.exports = function activepiecesOutreachApi(req, res) {
  return handleRequest(req, res);
};
