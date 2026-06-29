function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
      resolve(request.body);
      return;
    }

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

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload, null, 2));
}

function methodGuard(request, response) {
  if (request.method === "POST") return false;
  response.setHeader("Allow", "POST");
  sendJson(response, 405, { ok: false, error: "method_not_allowed" });
  return true;
}

function workerApiBase() {
  return process.env.HEIRRIGHT_WORKER_URL || process.env.WORKER_API_URL || process.env.WORKER_BASE_URL || "";
}

async function proxyWorkerJson(pathname, body) {
  const base = workerApiBase().replace(/\/+$/, "");
  if (!base) return null;
  const headers = { "content-type": "application/json" };
  if (process.env.HEIRRIGHT_API_TOKEN) headers.authorization = `Bearer ${process.env.HEIRRIGHT_API_TOKEN}`;
  const response = await fetch(`${base}${pathname}`, {
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

function sendProxied(response, proxied) {
  response.statusCode = proxied.status;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", proxied.contentType);
  response.end(proxied.body);
}

function normalizeAssetAddress(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/\b(street)\b/g, "st")
    .replace(/\b(avenue)\b/g, "ave")
    .replace(/\b(road)\b/g, "rd")
    .replace(/\b(drive)\b/g, "dr")
    .replace(/\b(court)\b/g, "ct")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function ownerLastName(value = "") {
  return String(value || "")
    .replace(/\b(est|estate|of|the)\b/gi, " ")
    .replace(/[^a-zA-Z\s'-]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .at(-1)?.toLowerCase() || "";
}

function idiLockKey(body = {}) {
  return [
    String(body.provider || "idi").toLowerCase(),
    normalizeAssetAddress(body.propertyAddress || body.address || body.assetAddress),
    ownerLastName(body.ownerName || body.estateName),
  ].filter(Boolean).join(":");
}

function receiptId(prefix = "artifact") {
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${random}`;
}

module.exports = {
  idiLockKey,
  methodGuard,
  proxyWorkerJson,
  readJsonBody,
  receiptId,
  sendJson,
  sendProxied,
};
