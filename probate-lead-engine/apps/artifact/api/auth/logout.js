const { clearCookie, sessionCookie } = require("./_shared");

module.exports = function handler(request, response) {
  response.statusCode = 302;
  response.setHeader("set-cookie", clearCookie(sessionCookie, request));
  response.setHeader("location", "/");
  response.end();
};
