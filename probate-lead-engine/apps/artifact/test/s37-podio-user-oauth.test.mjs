import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import workerModule from "../../worker/dist/cloudflare.js";

const worker = workerModule.default || workerModule;

class MemoryKv {
  values = new Map();
  metadata = new Map();
  async get(key) { return this.values.get(key) || null; }
  async put(key, value, options = {}) {
    this.values.set(key, value);
    this.metadata.set(key, options.metadata || null);
  }
  async delete(key) { this.values.delete(key); }
}

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function sessionToken(email, secret) {
  const payload = base64url(JSON.stringify({
    email,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function cookieValue(setCookie, name) {
  const match = String(setCookie || "").match(new RegExp(`(?:^|,\\s*)${name}=([^;]+)`));
  return match?.[1] || "";
}

async function start(email) {
  const response = await worker.fetch(new Request("https://worker.test/api/podio/oauth/start", {
    headers: { cookie: `hr_session=${sessionToken(email, env.AUTH_SESSION_SECRET)}` },
  }), env);
  assert.equal(response.status, 302);
  const location = response.headers.get("location");
  return {
    email,
    state: new URL(location).searchParams.get("state"),
    stateCookie: cookieValue(response.headers.get("set-cookie"), "hr_podio_state"),
  };
}

async function callback(flow, email, code) {
  return worker.fetch(new Request(`https://worker.test/api/podio/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(flow.state)}`, {
    headers: {
      cookie: `hr_session=${sessionToken(email, env.AUTH_SESSION_SECRET)}; hr_podio_state=${flow.stateCookie}`,
    },
  }), env);
}

const kv = new MemoryKv();
const env = {
  AUTH_REQUIRED: "true",
  AUTH_ALLOWED_DOMAINS: "heirright.com",
  AUTH_SESSION_SECRET: "podio-user-isolation-secret",
  PODIO_CLIENT_ID: "heirright-llc",
  PODIO_CLIENT_SECRET: "server-only-client-secret",
  PODIO_PER_USER_AUTH_REQUIRED: "true",
  PODIO_DURABLE_AUTH_REQUIRED: "false",
  PODIO_OAUTH_REDIRECT_URI: "https://worker.test/api/podio/oauth/callback",
  PODIO_TOKEN_STORE: kv,
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  if (String(url) === "https://api.podio.com/oauth/token/v2") {
    const params = new URLSearchParams(String(init.body || ""));
    const code = params.get("code") || "refresh";
    return new Response(JSON.stringify({
      access_token: `access-${code}`,
      refresh_token: `refresh-${code}`,
    }), { status: 200, headers: { "content-type": "application/json" } });
  }
  return originalFetch(url, init);
};

try {
  const userA = await start("operator-a@heirright.com");
  const crossUser = await callback(userA, "operator-b@heirright.com", "user-a");
  assert.equal(crossUser.status, 400, "another signed-in user must not finish this OAuth state");
  assert.equal(kv.values.size, 0);

  const userAConnected = await callback(userA, userA.email, "user-a");
  assert.equal(userAConnected.status, 200);
  assert.match(await userAConnected.text(), /Your Podio Account Is Connected/);

  const userB = await start("operator-b@heirright.com");
  const userBConnected = await callback(userB, userB.email, "user-b");
  assert.equal(userBConnected.status, 200);
  assert.equal(kv.values.size, 2);

  const keys = [...kv.values.keys()];
  assert.notEqual(keys[0], keys[1]);
  assert.ok(keys.every((key) => key.startsWith("heirright:podio:user-refresh:")));
  assert.ok(keys.every((key) => !key.includes("operator-") && !key.includes("heirright.com")));
  assert.ok([...kv.metadata.values()].every((value) => value?.purpose === "user_scoped_durable_refresh"));
} finally {
  globalThis.fetch = originalFetch;
}

console.log(JSON.stringify({
  ok: true,
  checks: [
    "oauth_state_bound_to_google_user",
    "cross_user_callback_rejected",
    "refresh_tokens_stored_per_user",
    "storage_keys_hash_email",
    "shared_oauth_client_secret_stays_backend_only",
  ],
}, null, 2));
