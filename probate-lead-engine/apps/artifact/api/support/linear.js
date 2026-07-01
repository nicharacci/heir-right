const { methodGuard, readJsonBody, receiptId, sendJson } = require("../_shared");

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function requiredLinearEnv() {
  const apiKey = env("HEIRRIGHT_LINEAR_API_KEY", env("LINEAR_API_KEY"));
  const teamId = env("HEIRRIGHT_LINEAR_TEAM_ID", env("LINEAR_TEAM_ID"));
  return {
    apiKey,
    teamId,
    assigneeId: env("HEIRRIGHT_LINEAR_DEFAULT_ASSIGNEE_ID", env("LINEAR_DEFAULT_ASSIGNEE_ID")),
    projectId: env("HEIRRIGHT_LINEAR_PROJECT_ID", env("LINEAR_PROJECT_ID")),
    labelIds: env("HEIRRIGHT_LINEAR_LABEL_IDS", env("HEIRRIGHT_LINEAR_INCIDENT_LABEL_IDS", env("LINEAR_LABEL_IDS")))
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

async function linearGraphql(apiKey, query, variables) {
  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      authorization: apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Linear API failed with ${response.status}`);
  if (body.errors?.length) throw new Error(body.errors.map((error) => error.message).join("; "));
  if (!body.data) throw new Error("Linear API returned no data");
  return body.data;
}

function priorityForSeverity(value) {
  const severity = String(value || "medium").toLowerCase();
  if (severity === "critical" || severity === "urgent") return 1;
  if (severity === "high") return 2;
  if (severity === "low") return 4;
  return 3;
}

function safeTitle(value) {
  return String(value || "HeirRight support request").replace(/\s+/g, " ").trim().slice(0, 240);
}

function descriptionForTicket(payload, attachmentMeta = null) {
  const context = payload.context || {};
  return [
    "Auto-filed HeirRight Leads support ticket.",
    "",
    "Request:",
    payload.message || "Support request submitted from the HeirRight Admin tab.",
    "",
    "Routing:",
    "- Product: HeirRight Leads",
    "- Source: " + String(payload.source || "HeirRight Admin"),
    "- Actor: " + String(payload.actor || "office user"),
    "- Severity: " + String(payload.severity || "medium"),
    "- Notification: Linear should notify the configured Solvys assignee when this issue is created.",
    "",
    attachmentMeta
      ? [
          "Uploaded PDF:",
          "- Name: " + attachmentMeta.name,
          "- Size: " + attachmentMeta.size,
          "- SHA-256: " + attachmentMeta.sha256,
          attachmentMeta.assetUrl ? "- Linear file: " + attachmentMeta.assetUrl : "",
        ].filter(Boolean).join("\n")
      : "Uploaded PDF: none",
    "",
    "Expected behavior:",
    "A non-admin office user should complete the selected product loop without manual Solvys intervention.",
    "",
    "Context:",
    "```json",
    JSON.stringify(context, null, 2).slice(0, 9000),
    "```",
  ].filter(Boolean).join("\n");
}

async function uploadLinearFile(config, attachment) {
  if (!attachment?.base64) return null;
  const contentType = attachment.type || "application/pdf";
  const filename = attachment.name || "heirright-support.pdf";
  const bytes = Buffer.from(attachment.base64, "base64");
  const data = await linearGraphql(config.apiKey, `
    mutation FileUpload($contentType: String!, $filename: String!, $size: Int!, $makePublic: Boolean, $metaData: JSON) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size, makePublic: $makePublic, metaData: $metaData) {
        success
        uploadFile {
          uploadUrl
          assetUrl
          contentType
          filename
          size
          headers { key value }
        }
      }
    }
  `, {
    contentType,
    filename,
    size: bytes.length,
    makePublic: false,
    metaData: {
      source: "HeirRight Admin support intake",
      sha256: attachment.sha256 || "",
    },
  });
  const upload = data.fileUpload?.uploadFile;
  if (!data.fileUpload?.success || !upload?.uploadUrl) throw new Error("Linear fileUpload returned success=false");
  const headers = {};
  for (const header of upload.headers || []) headers[header.key] = header.value;
  headers["content-type"] = upload.contentType || contentType;
  headers["cache-control"] = "public, max-age=31536000";
  const put = await fetch(upload.uploadUrl, {
    method: "PUT",
    headers,
    body: bytes,
  });
  if (!put.ok) throw new Error(`Linear file upload failed with ${put.status}`);
  return {
    assetUrl: upload.assetUrl,
    contentType: upload.contentType || contentType,
    filename: upload.filename || filename,
    size: upload.size || bytes.length,
    sha256: attachment.sha256 || "",
    name: filename,
  };
}

async function attachLinearFile(config, issueId, attachmentMeta) {
  if (!attachmentMeta?.assetUrl) return;
  const data = await linearGraphql(config.apiKey, `
    mutation AttachmentCreate($input: AttachmentCreateInput!) {
      attachmentCreate(input: $input) { success }
    }
  `, {
    input: {
      issueId,
      title: attachmentMeta.name || attachmentMeta.filename || "HeirRight support PDF",
      subtitle: "Uploaded from HeirRight Admin",
      url: attachmentMeta.assetUrl,
      metadata: {
        source: "HeirRight Admin support intake",
        sha256: attachmentMeta.sha256 || "",
        size: String(attachmentMeta.size || ""),
      },
    },
  });
  if (!data.attachmentCreate?.success) throw new Error("Linear attachmentCreate returned success=false");
}

async function createLinearIssue(config, payload, attachmentMeta) {
  const input = {
    teamId: config.teamId,
    title: `[HeirRight ${payload.severity || "medium"}] ${safeTitle(payload.title)}`,
    description: descriptionForTicket(payload, attachmentMeta),
    priority: priorityForSeverity(payload.severity),
  };
  if (config.assigneeId) input.assigneeId = config.assigneeId;
  if (config.projectId) input.projectId = config.projectId;
  if (config.labelIds.length) input.labelIds = config.labelIds;
  try {
    return await createLinearIssueWithInput(config, input);
  } catch (error) {
    if (!input.labelIds?.length) throw error;
    const retryInput = { ...input };
    delete retryInput.labelIds;
    return createLinearIssueWithInput(config, retryInput);
  }
}

async function createLinearIssueWithInput(config, input) {
  const data = await linearGraphql(config.apiKey, `
    mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url }
      }
    }
  `, { input });
  if (!data.issueCreate?.success || !data.issueCreate.issue) throw new Error("Linear issueCreate returned success=false");
  return data.issueCreate.issue;
}

module.exports = async function handler(request, response) {
  if (methodGuard(request, response)) return;
  try {
    const payload = await readJsonBody(request);
    const config = requiredLinearEnv();
    if (!config.apiKey || !config.teamId) {
      sendJson(response, 503, {
        ok: false,
        error: "linear_not_configured",
        message: "Linear support filing needs HEIRRIGHT_LINEAR_API_KEY and HEIRRIGHT_LINEAR_TEAM_ID.",
        ticketId: receiptId("linear-setup-needed"),
      });
      return;
    }
    const attachmentMeta = await uploadLinearFile(config, payload.attachment).catch((error) => ({
      name: payload.attachment?.name || "Uploaded PDF",
      size: payload.attachment?.size || 0,
      sha256: payload.attachment?.sha256 || "",
      uploadError: error.message,
    }));
    const issue = await createLinearIssue(config, payload, attachmentMeta);
    if (attachmentMeta?.assetUrl) await attachLinearFile(config, issue.id, attachmentMeta).catch(() => null);
    sendJson(response, 200, { ok: true, issue, attachment: attachmentMeta });
  } catch (error) {
    sendJson(response, 500, { ok: false, error: "linear_ticket_failed", message: error.message || "Linear support ticket failed." });
  }
};
