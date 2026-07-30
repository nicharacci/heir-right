const { handleRequest } = require("../../../apps/artifact/server");

module.exports = function taxCollectorReceiptRunApi(req, res) {
  return handleRequest(req, res);
};
