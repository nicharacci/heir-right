const { adminEmails } = require("../admin/access-config");

const {
  clearCookie,
  createSessionToken,
  deniedAccessPage,
  emailAllowed,
  exchangeGoogleCode,
  loginPage,
  parseCookies,
  sendHtml,
  secretMatches,
  sessionCookie,
  storeGoogleWorkspaceConnection,
  stateCookie,
  cookie,
  workspaceIntentCookie,
} = require("./_shared");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendHtml(response, 405, loginPage(request, "Use the Google sign-in button to continue."));
    return;
  }
  const url = new URL(request.url || "/", `https://${request.headers.host || "surface.heirright.com"}`);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expectedState = parseCookies(request)[stateCookie];
  if (!code || !state || !expectedState || !secretMatches(state, expectedState)) {
    sendHtml(response, 400, loginPage(request, "The Google sign-in request expired. Start the login again."));
    return;
  }

  try {
    const { profile, token } = await exchangeGoogleCode(request, code);
    if (!profile.email || !emailAllowed(profile.email)) {
      sendHtml(response, 403, deniedAccessPage(request, profile.email), {
        "set-cookie": [
          clearCookie(sessionCookie, request),
          clearCookie(stateCookie, request),
        ],
      });
      return;
    }
    const connectWorkspace = parseCookies(request)[workspaceIntentCookie] === "google-workspace";
    if (connectWorkspace && !adminEmails(process.env).includes(String(profile.email).trim().toLowerCase())) {
      sendHtml(response, 403, loginPage(request, "Only an approved HeirRight administrator can connect Google Workspace for the organization."), {
        "set-cookie": [
          clearCookie(sessionCookie, request),
          clearCookie(stateCookie, request),
          clearCookie(workspaceIntentCookie, request),
        ],
      });
      return;
    }
    if (connectWorkspace) await storeGoogleWorkspaceConnection(request, profile, token);
    response.statusCode = 302;
    response.setHeader("set-cookie", [
      cookie(sessionCookie, createSessionToken(profile), request),
      clearCookie(stateCookie, request),
      clearCookie(workspaceIntentCookie, request),
    ]);
    response.setHeader("location", connectWorkspace ? "/?googleWorkspace=connected" : "/");
    response.end();
  } catch (error) {
    sendHtml(response, 502, loginPage(request, error.message || "Google sign-in failed."));
  }
};
