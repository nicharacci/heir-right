const { readJsonBody, receiptId, requireApiAdmin, requireApiAuth, sendJson } = require("../_shared");
const {
  accessConfig,
  accessDomain,
  accessValueType,
  applyAccessChange,
  normalizedAccessValue,
  validAccessValue,
} = require("./access-config");

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

async function routeAccessRequest(payload) {
  const webhookUrl = process.env.HEIRRIGHT_ACCESS_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const forwarded = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!forwarded.ok) throw new Error(`Access webhook failed with ${forwarded.status}`);
      return { status: "webhook_queued" };
    } catch (error) {
      return { status: "routing_failed", message: error.message || "Access webhook failed." };
    }
  }

  const config = linearConfig();
  if (config.apiKey && config.teamId) {
    try {
      const issue = await createAccessTicket(config, payload);
      return { status: "linear_ticket_created", issue };
    } catch (error) {
      return { status: "routing_failed", message: error.message || "Linear access ticket failed." };
    }
  }

  return {
    status: "not_configured",
    message: "Configure the access webhook or Linear routing before requesting a production sign-in change.",
  };
}

module.exports = async function handler(request, response) {
  if (requireApiAuth(request, response)) return;
  if (request.method === "GET" || request.method === "HEAD") {
    sendJson(response, 200, { ok: true, ...accessConfig(process.env) });
    return;
  }
  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    sendJson(response, 405, { ok: false, error: "method_not_allowed" });
    return;
  }
  if (requireApiAdmin(request, response)) return;
  try {
    const body = await readJsonBody(request);
    const action = body.action === "remove" ? "remove" : "add";
    const value = normalizedAccessValue(body.value);
    if (!value || !validAccessValue(value)) {
      sendJson(response, 400, { ok: false, error: "invalid_access_value", message: "Enter a valid company email or domain." });
      return;
    }
    const type = accessValueType(value);
    const payload = {
      action,
      value,
      type,
      domain: accessDomain(value),
      actor: body.actor || "office user",
      requestedAt: body.requestedAt || new Date().toISOString(),
      requestId: receiptId("access"),
    };

    // A local file is deterministic for the developer server, but it is not a
    // durable production database on Vercel. Only the explicit local auth-off
    // mode mutates it. Production requests are routed for an environment-backed
    // allowlist change and report that access remains unchanged until deployed.
    if (process.env.AUTH_REQUIRED === "false") {
      const applied = applyAccessChange(action, value, process.env);
      const routing = await routeAccessRequest({ ...payload, ...applied });
      sendJson(response, 200, {
        ok: true,
        applied: true,
        persistence: "local_file",
        status: action === "remove" ? "access_removed" : "access_added",
        routing,
        allowedDomains: applied.allowedDomains,
        allowedEmails: applied.allowedEmails,
        payload: { ...payload, ...applied },
        message: `${type === "email" ? "Email" : "Domain"} access was updated in the local development sign-in gate.`,
      });
      return;
    }

    const routing = await routeAccessRequest(payload);
    const current = accessConfig(process.env);
    if (routing.status === "not_configured" || routing.status === "routing_failed") {
      sendJson(response, routing.status === "routing_failed" ? 502 : 503, {
        ok: false,
        applied: false,
        status: "access_change_not_recorded",
        error: routing.status === "routing_failed" ? "access_request_routing_failed" : "access_request_routing_not_configured",
        routing,
        allowedDomains: current.allowedDomains,
        allowedEmails: current.allowedEmails,
        payload,
        message: routing.message,
      });
      return;
    }

    sendJson(response, 202, {
      ok: true,
      applied: false,
      approvalRequired: true,
      status: "access_change_requested",
      routing,
      allowedDomains: current.allowedDomains,
      allowedEmails: current.allowedEmails,
      payload,
      message: "The approval request was recorded. Production sign-in access has not changed; update the environment allowlist and redeploy after approval.",
    });
  } catch (error) {
    sendJson(response, error.code === "invalid_access_value" ? 400 : 500, {
      ok: false,
      error: error.code || "access_request_failed",
      message: error.message || "Access request failed.",
    });
  }
};
