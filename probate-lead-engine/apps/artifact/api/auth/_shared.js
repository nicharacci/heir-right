const { randomBytes, createHmac } = require("node:crypto");
const { accessConfig } = require("../admin/access-config");

const sessionCookie = process.env.AUTH_SESSION_COOKIE || "hr_session";
const stateCookie = process.env.AUTH_STATE_COOKIE || "hr_oauth_state";
const sessionTtlSeconds = Number(process.env.AUTH_SESSION_TTL_SECONDS || 60 * 60 * 12);

function splitList(value, fallback = "") {
  return String(value || fallback || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function authRequired() {
  return process.env.AUTH_REQUIRED !== "false";
}

function allowedDomains() {
  return accessConfig(process.env).allowedDomains;
}

function allowedEmails() {
  return accessConfig(process.env).allowedEmails;
}

function originFor(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "surface.heirright.com";
  const proto = req.headers["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function redirectUriFor(req) {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI || `${originFor(req)}/auth/callback`;
}

function oauthConfigured(req) {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID
      && process.env.GOOGLE_OAUTH_CLIENT_SECRET
      && process.env.AUTH_SESSION_SECRET
      && redirectUriFor(req)
  );
}

function parseCookies(req) {
  const out = {};
  for (const pair of String(req.headers.cookie || "").split(";")) {
    const index = pair.indexOf("=");
    if (index === -1) continue;
    out[pair.slice(0, index).trim()] = decodeURIComponent(pair.slice(index + 1).trim());
  }
  return out;
}

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function sign(value) {
  return createHmac("sha256", process.env.AUTH_SESSION_SECRET || "")
    .update(value)
    .digest("base64url");
}

function emailAllowed(email) {
  const normalized = String(email || "").toLowerCase();
  const domain = normalized.split("@").at(-1);
  return allowedEmails().includes(normalized) || allowedDomains().includes(domain);
}

function secureCookie(req) {
  return originFor(req).startsWith("https:") ? "; Secure" : "";
}

function cookie(name, value, req, maxAgeSeconds = sessionTtlSeconds) {
  const maxAge = maxAgeSeconds ? `; Max-Age=${maxAgeSeconds}` : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax${maxAge}${secureCookie(req)}`;
}

function clearCookie(name, req) {
  return cookie(name, "", req, 0);
}

function createSessionToken(profile) {
  const email = String(profile.email || "").toLowerCase();
  const payload = {
    email,
    name: profile.name || email,
    picture: profile.picture || "",
    domain: email.split("@").at(-1) || "",
    mode: "google",
    exp: Math.floor(Date.now() / 1000) + sessionTtlSeconds,
  };
  const encoded = base64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

function readSession(req) {
  const token = parseCookies(req)[sessionCookie];
  if (!token || !process.env.AUTH_SESSION_SECRET) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!emailAllowed(payload.email)) return null;
    return payload;
  } catch {
    return null;
  }
}

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [key, value] of Object.entries({ "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers })) {
    res.setHeader(key, value);
  }
  res.end(`${JSON.stringify(body, null, 2)}\n`);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sendHtml(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [key, value] of Object.entries({ "content-type": "text/html; charset=utf-8", "cache-control": "no-store", ...headers })) {
    res.setHeader(key, value);
  }
  res.end(body);
}

function loginPage(req, message = "Sign in with your HeirRight Google account to review lead packets.") {
  const configured = oauthConfigured(req);
  const domainText = allowedDomains().join(", ") || "heirright.com";
  const emailText = allowedEmails().join(", ") || "approved admin emails";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HeirRight Login</title>
  <style>
    :root { color-scheme: light; --page:#f2f2f7; --text:#1d1d1f; --muted:#6e7681; --line:rgba(16,24,40,.12); --glass:rgba(255,255,255,.74); }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--page); color:var(--text); font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; }
    main { width:min(420px, calc(100vw - 32px)); padding:22px; border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:saturate(180%) blur(28px); -webkit-backdrop-filter:saturate(180%) blur(28px); }
    h1 { margin:0 0 8px; font-size:24px; letter-spacing:0; }
    p { margin:0 0 14px; color:var(--muted); line-height:1.45; }
    a { display:inline-flex; align-items:center; justify-content:center; min-height:40px; width:100%; color:#fff; background:#2f3137; text-decoration:none; border-radius:9px; font-weight:720; }
    .meta { margin-top:14px; padding-top:14px; border-top:1px solid var(--line); font-size:12px; }
    code { font-family:"SFMono-Regular","SF Mono",ui-monospace,Menlo,Consolas,monospace; color:var(--text); }
  </style>
</head>
<body>
  <main>
    <h1>HeirRight</h1>
    <p>${escapeHtml(message)}</p>
    ${configured ? `<a href="/auth/login">Continue with Google</a>` : `<p><strong>Google sign-in is not set up yet.</strong></p>`}
    <p class="meta">Allowed domains: <code>${escapeHtml(domainText)}</code><br>Admin access: <code>${escapeHtml(emailText)}</code></p>
  </main>
</body>
</html>`;
}

function deniedAccessPage(req, email = "") {
  const domainText = allowedDomains().join(", ") || "heirright.com";
  const deniedDomain = String(email || "").toLowerCase().split("@").at(-1) || "this account";
  const safeDeniedCopy = deniedDomain.includes(".")
    ? `The ${deniedDomain} domain is not on the approved HeirRight access list.`
    : "This Google account is not on the approved HeirRight access list.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="6; url=/">
  <title>Access not approved</title>
  <style>
    :root { color-scheme: light; --page:#f2f2f7; --text:#1d1d1f; --muted:#6e7681; --line:rgba(16,24,40,.12); --glass:rgba(255,255,255,.78); --danger:#a12c2c; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:var(--page); color:var(--text); font-family:Inter,-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif; }
    main { width:min(440px, calc(100vw - 32px)); padding:24px; border:1px solid var(--line); border-radius:14px; background:var(--glass); backdrop-filter:saturate(180%) blur(28px); -webkit-backdrop-filter:saturate(180%) blur(28px); box-shadow:0 18px 70px rgba(15,23,42,.14); }
    .eyebrow { margin:0 0 8px; color:var(--danger); font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
    h1 { margin:0 0 8px; font-size:24px; letter-spacing:0; }
    p { margin:0 0 14px; color:var(--muted); line-height:1.45; }
    a { display:inline-flex; align-items:center; justify-content:center; min-height:40px; width:100%; color:#fff; background:#2f3137; text-decoration:none; border-radius:9px; font-weight:720; }
    .meta { margin-top:14px; padding-top:14px; border-top:1px solid var(--line); font-size:12px; }
    code { font-family:"SFMono-Regular","SF Mono",ui-monospace,Menlo,Consolas,monospace; color:var(--text); }
  </style>
</head>
<body>
  <main>
    <p class="eyebrow">Access denied</p>
    <h1>Access not approved</h1>
    <p>${escapeHtml(safeDeniedCopy)}</p>
    <p>Use an approved business Google account to enter HeirRight. You will be returned to the home page in a few seconds.</p>
    <a href="/">Return to HeirRight</a>
    <p class="meta">Approved domains: <code>${escapeHtml(domainText)}</code></p>
  </main>
  <script>window.setTimeout(function(){ window.location.replace("/"); }, 6000);</script>
</body>
</html>`;
}

function sessionBody(req) {
  const session = readSession(req);
  return {
    authenticated: Boolean(session),
    user: session ? {
      email: session.email,
      name: session.name,
      picture: session.picture || null,
      domain: session.domain,
      mode: session.mode,
    } : null,
    auth: {
      required: authRequired(),
      configured: oauthConfigured(req),
      allowedDomains: allowedDomains(),
      allowedEmails: allowedEmails(),
    },
  };
}

async function exchangeGoogleCode(req, code) {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUriFor(req),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error(`Google token exchange failed: ${tokenResponse.status}`);
  const token = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) throw new Error(`Google profile lookup failed: ${profileResponse.status}`);
  return profileResponse.json();
}

module.exports = {
  authRequired,
  clearCookie,
  cookie,
  createSessionToken,
  emailAllowed,
  exchangeGoogleCode,
  deniedAccessPage,
  loginPage,
  oauthConfigured,
  parseCookies,
  randomBytes,
  redirectUriFor,
  readSession,
  sendHtml,
  sendJson,
  sessionBody,
  sessionCookie,
  stateCookie,
};
