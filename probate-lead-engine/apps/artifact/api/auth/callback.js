const {
  clearCookie,
  createSessionToken,
  emailAllowed,
  exchangeGoogleCode,
  loginPage,
  parseCookies,
  sendHtml,
  sessionCookie,
  stateCookie,
  cookie,
} = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendHtml(response, 405, loginPage(request, "Use the Google sign-in button to continue."));
    return;
  }
  const url = new URL(request.url || "/", `https://${request.headers.host || "app.heirright.com"}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = parseCookies(request)[stateCookie];
  if (!code || !state || !expectedState || state !== expectedState) {
    sendHtml(response, 400, loginPage(request, "The Google sign-in request expired. Start the login again."));
    return;
  }

  try {
    const profile = await exchangeGoogleCode(request, code);
    if (!profile.email || !emailAllowed(profile.email)) {
      sendHtml(response, 403, loginPage(request, "This Google account is not approved for the HeirRight workspace."));
      return;
    }
    response.statusCode = 302;
    response.setHeader("set-cookie", [
      cookie(sessionCookie, createSessionToken(profile), request),
      clearCookie(stateCookie, request),
    ]);
    response.setHeader("location", "/");
    response.end();
  } catch (error) {
    sendHtml(response, 502, loginPage(request, error.message || "Google sign-in failed."));
  }
};
