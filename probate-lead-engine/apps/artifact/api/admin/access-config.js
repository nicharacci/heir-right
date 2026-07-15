const { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const defaultAccessDomains = "heirright.com,solvys.io,texasequitypros.com";
const runtimeConfigs = new Map();

function splitList(value, fallback = "") {
  return String(value || fallback || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function uniqueList(items) {
  return Array.from(new Set((items || [])
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean)));
}

function normalizedAccessValue(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
}

function accessDomain(value) {
  const normalized = normalizedAccessValue(value);
  return normalized.includes("@") ? normalized.split("@").at(-1) : normalized;
}

function accessValueType(value) {
  return normalizedAccessValue(value).includes("@") ? "email" : "domain";
}

function validAccessValue(value) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$|^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedAccessValue(value));
}

function accessConfigPath(env = process.env) {
  return env.HEIRRIGHT_ACCESS_CONFIG_FILE || join(__dirname, "..", "..", "tmp", "admin-access-config.json");
}

function envAllowedDomains(env = process.env) {
  return uniqueList(splitList(env.AUTH_ALLOWED_DOMAINS || defaultAccessDomains));
}

function envAllowedEmails(env = process.env) {
  return uniqueList(splitList(env.AUTH_ALLOWED_EMAILS || ""));
}

function readStoredConfig(env = process.env) {
  const filePath = accessConfigPath(env);
  if (runtimeConfigs.has(filePath)) return runtimeConfigs.get(filePath);
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.allowedDomains)) return null;
    const config = {
      allowedDomains: uniqueList(parsed.allowedDomains),
      // Older local files only stored domains. Preserve the environment email
      // allowlist during that one-way migration instead of silently dropping it.
      allowedEmails: Array.isArray(parsed.allowedEmails)
        ? uniqueList(parsed.allowedEmails)
        : envAllowedEmails(env),
    };
    runtimeConfigs.set(filePath, config);
    return config;
  } catch {
    return null;
  }
}

function writeStoredConfig(config, env = process.env) {
  const next = {
    allowedDomains: uniqueList(config.allowedDomains),
    allowedEmails: uniqueList(config.allowedEmails),
  };
  const filePath = accessConfigPath(env);
  mkdirSync(dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify({
    ...next,
    updatedAt: new Date().toISOString(),
  }, null, 2));
  renameSync(temporaryPath, filePath);
  runtimeConfigs.set(filePath, next);
  return next;
}

function allowedDomains(env = process.env) {
  return readStoredConfig(env)?.allowedDomains || envAllowedDomains(env);
}

function adminEmails(env = process.env) {
  return uniqueList(splitList(env.HEIRRIGHT_ADMIN_EMAILS || env.SOLVYS_ADMIN_EMAILS || ""));
}

function allowedEmails(env = process.env) {
  return uniqueList([
    ...(readStoredConfig(env)?.allowedEmails || envAllowedEmails(env)),
    ...adminEmails(env),
  ]);
}

function applyAccessChange(action, value, env = process.env) {
  const normalized = normalizedAccessValue(value);
  if (!validAccessValue(normalized)) {
    const error = new Error("Enter a valid company email or domain.");
    error.code = "invalid_access_value";
    throw error;
  }
  const type = accessValueType(normalized);
  const domain = type === "domain" ? normalized : accessDomain(normalized);
  const current = {
    allowedDomains: allowedDomains(env),
    allowedEmails: allowedEmails(env).filter((email) => !adminEmails(env).includes(email)),
  };
  const next = type === "email"
    ? {
        ...current,
        allowedEmails: action === "remove"
          ? current.allowedEmails.filter((item) => item !== normalized)
          : uniqueList([...current.allowedEmails, normalized]),
      }
    : {
        ...current,
        allowedDomains: action === "remove"
          ? current.allowedDomains.filter((item) => item !== normalized)
          : uniqueList([...current.allowedDomains, normalized]),
      };
  const stored = writeStoredConfig(next, env);
  return {
    value: normalized,
    domain,
    type,
    allowedDomains: stored.allowedDomains,
    allowedEmails: uniqueList([...stored.allowedEmails, ...adminEmails(env)]),
  };
}

function accessConfig(env = process.env) {
  return {
    allowedDomains: allowedDomains(env),
    allowedEmails: allowedEmails(env),
    defaultDomains: envAllowedDomains(env),
    source: readStoredConfig(env) ? "local_admin_file" : "environment",
  };
}

function resetAccessConfigForTests() {
  runtimeConfigs.clear();
}

module.exports = {
  accessConfig,
  accessDomain,
  accessValueType,
  adminEmails,
  allowedDomains,
  allowedEmails,
  applyAccessChange,
  defaultAccessDomains,
  envAllowedEmails,
  normalizedAccessValue,
  resetAccessConfigForTests,
  splitList,
  validAccessValue,
};
