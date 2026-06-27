const MAX_FIELD_LENGTH = 1200;

function clean(value) {
  return String(value ?? "").trim().slice(0, MAX_FIELD_LENGTH);
}

function receiptId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const random = globalThis.crypto?.randomUUID?.().slice(0, 8)
    ?? Math.random().toString(36).slice(2, 10);
  return `HR-${stamp}-${random.toUpperCase()}`;
}

async function readBody(request) {
  if (request.body && typeof request.body === "object" && !Buffer.isBuffer(request.body)) {
    return request.body;
  }
  if (typeof request.body === "string") {
    return request.body ? JSON.parse(request.body) : {};
  }
  if (Buffer.isBuffer(request.body)) {
    const rawBody = request.body.toString("utf8");
    return rawBody ? JSON.parse(rawBody) : {};
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString("utf8");
  if (!rawBody) return {};
  return JSON.parse(rawBody);
}

function summarizeSubmission(submission, delivery) {
  return {
    receiptId: submission.receiptId,
    receivedAt: submission.receivedAt,
    source: submission.source,
    hasName: Boolean(submission.name),
    hasEmail: Boolean(submission.email),
    hasPhone: Boolean(submission.phone),
    hasAddress: Boolean(submission.address),
    notesLength: submission.notes.length,
    delivery,
  };
}

async function forwardToWebhook(submission) {
  const webhookUrl = process.env.HEIRRIGHT_DEMO_FORM_WEBHOOK_URL;
  if (!webhookUrl) return { forwarded: false };

  const headers = {
    "content-type": "application/json; charset=utf-8",
  };
  if (process.env.HEIRRIGHT_DEMO_FORM_WEBHOOK_SECRET) {
    headers.authorization = `Bearer ${process.env.HEIRRIGHT_DEMO_FORM_WEBHOOK_SECRET}`;
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(submission),
  });

  return {
    forwarded: response.ok,
    status: response.status,
  };
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    response.status(405).json({ ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = await readBody(request);
    const trap = clean(body.companyWebsite);
    if (trap) {
      response.status(200).json({
        ok: true,
        receiptId: receiptId(),
        message: "Request received.",
      });
      return;
    }

    const submission = {
      receiptId: receiptId(),
      receivedAt: new Date().toISOString(),
      source: clean(body.source) || "heirright-site-v3",
      address: clean(body.address),
      name: clean(body.name),
      email: clean(body.email),
      phone: clean(body.phone),
      notes: clean(body.notes),
    };

    const missing = [];
    if (!submission.address) missing.push("address");
    if (!submission.name) missing.push("name");
    if (!submission.phone) missing.push("phone");
    if (!submission.email || !submission.email.includes("@")) missing.push("email");

    if (missing.length) {
      response.status(400).json({
        ok: false,
        error: "missing_required_fields",
        missing,
        message: "Please complete the required consultation fields before submitting.",
      });
      return;
    }

    const delivery = await forwardToWebhook(submission);
    console.log("HeirRight consultation request", summarizeSubmission(submission, delivery));

    response.status(200).json({
      ok: true,
      receiptId: submission.receiptId,
      message: "Request received. The HeirRight team can review the property details and follow up.",
      delivery: delivery.forwarded ? "webhook" : "server-receipt",
    });
  } catch (error) {
    console.error("HeirRight consultation request failed", {
      message: error instanceof Error ? error.message : "Unknown request failure",
    });
    response.status(500).json({
      ok: false,
      error: "request_failed",
      message: "The request could not be saved. Please contact HeirRight or try again shortly.",
    });
  }
}
