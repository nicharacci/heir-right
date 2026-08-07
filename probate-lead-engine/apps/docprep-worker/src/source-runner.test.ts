import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryProcessRepository } from "@ple/docprep-core";
import { createCloudflareSourceRunner } from "./source-runner.js";

const processCase = async () => {
  const repository = new InMemoryProcessRepository();
  const [intake] = await repository.intake({ estates: [{ estateId: "estate-source-1", name: "Estate of Casey Fox", address: "8 Bay St, Miami, FL", county: "Miami-Dade", sourceFileReferences: [], actor: { email: "operator@heirright.com" } }] }, "source-idempotency-0001");
  return intake.case;
};

test("the Cloudflare source runner accepts only a verified existing Discovery PDF", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL) => {
    const url = String(input); calls.push(url);
    if (url.includes("/api/discovery/file")) return Response.json({ ok: true, exists: true, packetArtifacts: [{ flow: "discovery", contentType: "application/pdf", readbackStatus: "verified", artifactUrl: "/api/reports/pdf?artifactId=packet-1" }] });
    return new Response(new TextEncoder().encode("%PDF-1.7\n"), { headers: { "content-type": "application/pdf" } });
  };
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "ready");
  assert.equal(calls.length, 2);
});

test("the Cloudflare source runner renders a stored reviewed dossier and verifies its PDF", async () => {
  const calls: string[] = [];
  const fetcher = async (input: string | URL) => {
    const url = String(input); calls.push(url);
    if (url.includes("/api/discovery/file")) return Response.json({ ok: true, exists: true, dossier: { id: "dossier-1" } });
    if (url.endsWith("/api/exports")) return Response.json({ ok: true, artifactUrl: "/api/reports/pdf?artifactId=packet-2" });
    return new Response(new TextEncoder().encode("%PDF-1.7\n"), { headers: { "content-type": "application/pdf" } });
  };
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "ready");
  assert.deepEqual(calls.map((url) => new URL(url).pathname), ["/api/discovery/file", "/api/exports", "/api/reports/pdf"]);
});

test("the Cloudflare source runner preserves manual review when Discovery is not persisted", async () => {
  const fetcher = async () => Response.json({ ok: true, exists: false });
  const result = await createCloudflareSourceRunner({ workerUrl: "https://source.example", apiToken: "test-token", fetcher: fetcher as typeof fetch })(await processCase());
  assert.equal(result.kind, "review_required");
});
