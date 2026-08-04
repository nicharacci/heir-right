const { clearCookie, cookie, googleOAuthScopes, loginPage, oauthConfigured, randomBytes, redirectUriFor, sendHtml, stateCookie, workspaceIntentCookie } = require("./_shared");

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

  const url = new URL(request.url || "/", `https://${request.headers.host || "surface.heirright.com"}`);
  const connectWorkspace = url.searchParams.get("integration") === "google-workspace";
  const state = randomBytes(24).toString("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
    redirect_uri: redirectUriFor(request),
    response_type: "code",
    scope: googleOAuthScopes(connectWorkspace),
    state,
    prompt: connectWorkspace ? "select_account consent" : "select_account",
  });
  if (connectWorkspace) {
    params.set("access_type", "offline");
    params.set("include_granted_scopes", "true");
  }
  response.statusCode = 302;
  response.setHeader("set-cookie", [
    cookie(stateCookie, state, request, 600),
    connectWorkspace ? cookie(workspaceIntentCookie, "google-workspace", request, 600) : clearCookie(workspaceIntentCookie, request),
  ]);
  response.setHeader("location", `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  response.end();
};
