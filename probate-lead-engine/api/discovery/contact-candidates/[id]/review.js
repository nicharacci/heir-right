const { handleRequest } = require("../../../../apps/artifact/server");

module.exports = function contactCandidateReviewApi(req, res) {
  return handleRequest(req, res);
};
