function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function workerApiBase() {
  return process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "";
}

async function proxyWorkerExport(body) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return null;
  const headers = { "content-type": "application/json" };
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  const response = await fetch(`${base}/api/exports`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    contentType: response.headers.get("content-type") || "application/json; charset=utf-8",
    body: await response.text(),
  };
}

function blockedResponse(body) {
  const routes = Array.isArray(body?.routes) ? body.routes : [];
  return {
    ok: false,
    status: "blocked",
    routes: routes.map((route) => ({ route, mode: "blocked", readbackOk: false })),
    blockers: [
      "Worker export API is not configured for this production app. Configure HEIRRIGHT_WORKER_URL before any live CRM, Google, email, SMS, or Resend mutation.",
      "No Podio card, Google Doc, Google Sheet row, email, SMS, or Resend message was created.",
    ],
    readbackEvidence: {
      status: "blocked",
      message: "Production artifact app stopped before write because export credentials and worker API routing are not configured.",
    },
  };
}

module.exports = async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.statusCode = 405;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    return;
  }

  try {
    const body = await readBody(request);
    const proxied = await proxyWorkerExport(body);
    if (proxied) {
      response.statusCode = proxied.status;
      response.setHeader("Content-Type", proxied.contentType);
      response.end(proxied.body);
      return;
    }

    response.statusCode = 503;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(blockedResponse(body), null, 2));
  } catch (error) {
    response.statusCode = 400;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify({
      ok: false,
      error: "request_failed",
      message: error instanceof Error ? error.message : "Export request failed before any write.",
    }));
  }
};
