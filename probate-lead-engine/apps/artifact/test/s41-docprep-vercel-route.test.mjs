import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const handler = require("../../../api/doc-prep/[...path].js");
const { createSessionToken } = require("../api/auth/_shared.js");

function call(options = {}) {
  return new Promise((resolve, reject) => {
    const request = {
      method: options.method || "GET",
      body: options.body,
      url: options.url || "/api/doc-prep/cases?estateId=estate-1",
      headers: { host: "surface.heirright.com", "x-forwarded-proto": "https", ...(options.headers || {}) },
      on() {},
      destroy() {},
    };
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
      end(payload = "") { resolve({ statusCode: this.statusCode, headers: this.headers, body: Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload)) }); },
    };
    Promise.resolve(handler(request, response)).catch(reject);
  });
}

process.env.AUTH_REQUIRED = "true";
process.env.AUTH_ALLOWED_DOMAINS = "heirright.com";
process.env.AUTH_SESSION_SECRET = "s41-process-proxy-session";
process.env.HEIRRIGHT_PROCESS_API_URL = "https://process.example";
process.env.HEIRRIGHT_PROCESS_API_TOKEN = "s41-process-token";

const anonymous = await call();
assert.equal(anonymous.statusCode, 401, "Vercel must enforce the signed client session before process access.");

const session = createSessionToken({ email: "sam@heirright.com", name: "Sam" });
const requests = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  requests.push({ url: String(url), init });
  if (String(url).endsWith("/view")) return new Response(Buffer.from("%PDF-1.7\nverified"), { status: 200, headers: { "content-type": "application/pdf", "content-disposition": "inline; filename=verified.pdf" } });
  return Response.json({ ok: true, case: { id: "case-1" } }, { status: 200 });
};
try {
  const caseResult = await call({
    url: "/api/doc-prep/cases?estateId=estate-1",
    headers: { cookie: `hr_session=${encodeURIComponent(session)}` },
  });
  assert.equal(caseResult.statusCode, 200);
  assert.equal(JSON.parse(caseResult.body.toString()).ok, true);
  assert.equal(requests[0].url, "https://process.example/v1/doc-prep/cases?estateId=estate-1");
  assert.equal(requests[0].init.headers.authorization, "Bearer s41-process-token");
  assert.equal(requests[0].init.headers["x-heirright-actor-email"], "sam@heirright.com");

  const viewed = await call({
    url: "/api/doc-prep/cases/case-1/view",
    headers: { cookie: `hr_session=${encodeURIComponent(session)}` },
  });
  assert.equal(viewed.statusCode, 200);
  assert.equal(viewed.headers["content-disposition"], "inline; filename=verified.pdf");
  assert.deepEqual(viewed.body, Buffer.from("%PDF-1.7\nverified"), "Vercel must preserve verified PDF bytes.");
} finally {
  globalThis.fetch = originalFetch;
}
