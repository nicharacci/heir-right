const { cookie, loginPage, oauthConfigured, randomBytes, redirectUriFor, sendHtml, stateCookie } = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendHtml(response, 405, loginPage(request, "Use the Google sign-in button to continue."));
    return;
  }
  if (!oauthConfigured(request)) {
    sendHtml(response, 503, loginPage(request, "Google sign-in setup is incomplete. Add the approved access details before beta access opens."));
    return;
  }

  const state = randomBytes(24).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUriFor(request),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  response.statusCode = 302;
  response.setHeader("set-cookie", cookie(stateCookie, state, request, 600));
  response.setHeader("location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.end();
};
