import assert from "node:assert/strict";
import test from "node:test";
import worker from "./cloudflare.js";

class MemoryKv {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const appToken = "test-app-token";
const brokerToken = "test-drive-broker-token";
const exportEmail = "operator@heirright.example";

function env() {
  return {
    AUTH_REQUIRED: "true",
    AUTH_ALLOWED_EMAILS: exportEmail,
    AUTH_SESSION_SECRET: "test-session-secret",
    HEIRRIGHT_API_TOKEN: appToken,
    HEIRRIGHT_DOC_PREP_DRIVE_BROKER_TOKEN: brokerToken,
    GOOGLE_OAUTH_CLIENT_ID: "test-google-client",
    GOOGLE_OAUTH_CLIENT_SECRET: "test-google-secret",
    GOOGLE_WORKSPACE_DESTINATION_EMAIL: exportEmail,
    PACKET_ARTIFACTS: new MemoryKv(),
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return response.json() as Promise<Record<string, unknown>>;
}

test("the S41 Drive broker returns only a short-lived token for its configured account and folder", async () => {
  const runtime = env();
  const connection = await worker.fetch(new Request("https://worker.test/api/google-workspace/connection", {
    method: "POST",
    headers: { authorization: `Bearer ${appToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      email: exportEmail,
      accessToken: "test-short-lived-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    }),
  }), runtime);
  assert.equal(connection.status, 200);

  const destination = await worker.fetch(new Request("https://worker.test/api/google-workspace/connection", {
    method: "POST",
    headers: { authorization: `Bearer ${appToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      action: "select_destination",
      email: exportEmail,
      destinationId: "test-drive-folder",
      destinationName: "S41 test destination",
    }),
  }), runtime);
  assert.equal(destination.status, 200);

  const denied = await worker.fetch(new Request("https://worker.test/internal/doc-prep/google-drive-credentials", { method: "POST" }), runtime);
  assert.equal(denied.status, 401);
  assert.equal(Object.hasOwn(await json(denied), "accessToken"), false);

  const brokered = await worker.fetch(new Request("https://worker.test/internal/doc-prep/google-drive-credentials", {
    method: "POST",
    headers: { authorization: `Bearer ${brokerToken}` },
  }), runtime);
  const body = await json(brokered);
  assert.equal(brokered.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.accessToken, "test-short-lived-access-token");
  assert.equal(body.parentFolderId, "test-drive-folder");
  assert.equal(Object.hasOwn(body, "refreshToken"), false);
  assert.equal(Object.hasOwn(body, "email"), false);
});
