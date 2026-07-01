const { methodGuard, readJsonBody, receiptId, sendJson } = require("../_shared");

function normalizedAccessValue(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function linearConfig() {
  return {
    apiKey: process.env.HEIRRIGHT_LINEAR_API_KEY || process.env.LINEAR_API_KEY || "",
    teamId: process.env.HEIRRIGHT_LINEAR_TEAM_ID || process.env.LINEAR_TEAM_ID || "",
    assigneeId: process.env.HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID || process.env.LINEAR_DEFAULT_ASSIGNEE_ID || "",
    projectId: process.env.HEIRRIGHT_LINEAR_PROJECT_ID || process.env.LINEAR_PROJECT_ID || "",
  };
}

async function linearGraphql(apiKey, query, variables) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Linear API failed with ${response.status}`);
  if (data.errors?.length) throw new Error(data.errors.map((error) => error.message).join("; "));
  return data.data;
}

async function createAccessTicket(config, payload) {
  const input = {
    teamId: config.teamId,
    title: `[HeirRight access] ${payload.action === "remove" ? "Remove" : "Add"} ${payload.value}`,
    description: [
      "Leads engine access request from HeirRight Admin.",
      "",
      `Action: ${payload.action}`,
      `Value: ${payload.value}`,
      `Actor: ${payload.actor || "office user"}`,
      `Requested at: ${payload.requestedAt || new Date().toISOString()}`,
      "",
      "Expected behavior:",
      "Whitelisted company users should be able to access the Leads engine without admin-only intervention.",
    ].join("\n"),
    priority: 3,
  };
  if (config.assigneeId) input.assigneeId = config.assigneeId;
  if (config.projectId) input.projectId = config.projectId;
  const data = await linearGraphql(config.apiKey, `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `, { input });
  if (!data?.issueCreate?.success) throw new Error("Linear issueCreate returned success=false");
  return data.issueCreate.issue;
}

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;
  try {
    const body = await readJsonBody(request);
    const action = body.action === "remove" ? "remove" : "add";
    const value = normalizedAccessValue(body.value);
    if (!value || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$|^[a-z0-9.-]+\.[a-z]{2,}$/i.test(value)) {
      sendJson(response, 400, { ok: false, error: "invalid_access_value", message: "Enter a valid company email or domain." });
      return;
    }
    const payload = {
      action,
      value,
      actor: body.actor || "office user",
      requestedAt: body.requestedAt || new Date().toISOString(),
      requestId: receiptId("access"),
    };
    const webhookUrl = process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL;
    if (webhookUrl) {
      const forwarded = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!forwarded.ok) throw new Error(`Access webhook failed with ${forwarded.status}`);
      sendJson(response, 200, { ok: true, status: "webhook_queued", payload });
      return;
    }
    const config = linearConfig();
    if (config.apiKey && config.teamId) {
      const issue = await createAccessTicket(config, payload);
      sendJson(response, 200, { ok: true, status: "linear_ticket_created", issue, payload });
      return;
    }
    sendJson(response, 202, {
      ok: true,
      status: "local_queue",
      message: "Access request captured locally. Configure HEIRRIGHT_ACCESS_WEBHOOK_URL or Linear env vars for live routing.",
      payload,
    });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: "access_request_failed", message: error.message || "Access request failed." });
  }
};
