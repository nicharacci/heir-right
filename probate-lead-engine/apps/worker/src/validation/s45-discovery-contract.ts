import { strict as assert } from "node:assert";
import { runS45VitalObituary, runS46VitalObituary } from "../s45-browserbase";
import { generateS45Backstory } from "../s45-nous";

async function rejects(action: () => Promise<unknown>, expected: string): Promise<void> {
  await assert.rejects(action, new RegExp(expected));
}

async function main(): Promise<void> {
  await rejects(() => runS45VitalObituary({}, { ownerName: "TEST OWNER" }), "browserbase_vital_workflow_unconfigured");
  await rejects(() => generateS45Backstory({}, { ownerName: "TEST OWNER", dateOfBirth: "01/01/1940", dateOfDeath: "01/01/2020", obituarySnapshot: "Verified source." }), "nous_backstory_unconfigured");

  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    calls.push({ url, body });
    if (url.endsWith("/v1/search")) return new Response(JSON.stringify({
      requestId: "search-test",
      results: [
        { url: "https://www.google.com/search?q=test+obituary", title: "Search page" },
        { url: "https://example.test/obituary", title: "TEST OWNER obituary" },
      ],
    }), { status: 200, headers: { "content-type": "application/json" } });
    if (url.includes("/functions/")) return new Response(JSON.stringify({
      id: "invocation-test",
      status: "COMPLETED",
      sessionId: "session-test",
      results: {
        sourceUrl: "https://example.test/obituary",
        obituarySnapshot: "Verified obituary source sentence.",
        dateOfBirth: "01/01/1940",
        dateOfDeath: "01/01/2020",
      },
    }), { status: 200, headers: { "content-type": "application/json" } });
    if (url === "https://example.test/obituary") return new Response("<html><title>TEST OWNER obituary</title><body>TEST OWNER of Miami-Dade was born January 1, 1940 and passed away January 1, 2020.</body></html>", { status: 200, headers: { "content-type": "text/html" } });
    return new Response(JSON.stringify({ choices: [{ message: { content: "A concise factual background based on the verified obituary source." } }] }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const vital = await runS45VitalObituary({ BROWSERBASE_API_KEY: "test", OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID: "function-test" }, { ownerName: "TEST OWNER" });
    assert.equal(vital.sourceUrl, "https://example.test/obituary");
    assert.equal(vital.dateOfBirth, "01/01/1940");
    const functionCall = calls.find((call) => call.url.includes("/functions/"));
    const searchCall = calls.find((call) => call.url.endsWith("/v1/search"));
    const functionParams = functionCall?.body.params as Record<string, unknown> | undefined;
    assert.ok(String(searchCall?.body.query || "").length <= 200);
    assert.equal(functionParams?.ownerName, "TEST OWNER");
    assert.deepEqual(functionParams?.sourceUrls, ["https://example.test/obituary"]);

    const directVital = await runS46VitalObituary({ BROWSERBASE_API_KEY: "test", OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID: "function-test" }, { ownerName: "TEST OWNER", county: "Miami-Dade", propertyAddress: "1 Main Street, Miami, FL 33101" });
    assert.equal(directVital.sourceUrl, "https://example.test/obituary");
    assert.equal(directVital.accessMode, "direct_destination");
    assert.equal(directVital.dateOfBirth, "January 1, 1940");
    assert.equal(directVital.dateOfDeath, "January 1, 2020");

    globalThis.fetch = async (input) => String(input).endsWith("/v1/search")
      ? new Response(JSON.stringify({ results: [{ url: "https://example.test/obituary", title: "TEST OWNER obituary" }] }), { status: 200, headers: { "content-type": "application/json" } })
      : new Response("<html><title>TEST OWNER obituary</title><body>TEST OWNER lived in Paris, France.</body></html>", { status: 200, headers: { "content-type": "text/html" } });
    const locationMismatch = await runS46VitalObituary({ BROWSERBASE_API_KEY: "test", OBITUARY_VITAL_BROWSERBASE_FUNCTION_ID: "function-test" }, { ownerName: "TEST OWNER", county: "Miami-Dade", propertyAddress: "1 Main Street, Miami, FL 33101" });
    assert.equal(locationMismatch.sourceUrl, "");
    assert.equal(locationMismatch.accessMode, "direct_destination");

    globalThis.fetch = async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      calls.push({ url, body });
      return new Response(JSON.stringify({ choices: [{ message: { content: "A concise factual background based on the verified obituary source." } }] }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const story = await generateS45Backstory({ NOUS_API_KEY: "test", NOUS_BASE_URL: "https://nous.example.test", NOUS_MODEL: "test-model:free", NOUS_FREE_TIER_ONLY: "true" }, {
      ownerName: "TEST OWNER",
      dateOfBirth: "01/01/1940",
      dateOfDeath: "01/01/2020",
      obituarySnapshot: "Verified obituary source sentence.",
    });
    assert.ok(story.length < 500);
    const nousCall = calls.find((call) => call.url.endsWith("/chat/completions"));
    assert.equal(nousCall?.body.model, "test-model:free");
    assert.ok(Array.isArray(nousCall?.body.messages));

    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "The heir is entitled to an inheritance." } }] }), { status: 200, headers: { "content-type": "application/json" } });
    await rejects(() => generateS45Backstory({ NOUS_API_KEY: "test", NOUS_BASE_URL: "https://nous.example.test", NOUS_MODEL: "test-model" }, {
      ownerName: "TEST OWNER", dateOfBirth: "01/01/1940", dateOfDeath: "01/01/2020", obituarySnapshot: "Verified obituary source sentence.",
    }), "nous_backstory_unsupported_legal_conclusion");
    await rejects(() => generateS45Backstory({ NOUS_API_KEY: "test", NOUS_BASE_URL: "https://nous.example.test", NOUS_MODEL: "paid-model", NOUS_FREE_TIER_ONLY: "true" }, {
      ownerName: "TEST OWNER", dateOfBirth: "01/01/1940", dateOfDeath: "01/01/2020", obituarySnapshot: "Verified obituary source sentence.",
    }), "nous_backstory_non_free_model");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

main().then(() => console.log(JSON.stringify({ ok: true, suite: "s45-discovery-contract" }))).catch((error) => { console.error(error); process.exitCode = 1; });
