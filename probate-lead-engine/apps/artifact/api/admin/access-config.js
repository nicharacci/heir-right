const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const defaultAccessDomains = "heirright.com,solvys.io,texasequitypros.com";
let runtimeDomains = null;

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

function validAccessValue(value) {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$|^[a-z0-9.-]+\.[a-z]{2,}$/i.test(normalizedAccessValue(value));
}

function accessConfigPath(env = process.env) {
  return env.HEIRRIGHT_ACCESS_CONFIG_FILE || join(__dirname, "..", "..", "tmp", "admin-access-config.json");
}

function envAllowedDomains(env = process.env) {
  return uniqueList(splitList(env.AUTH_ALLOWED_DOMAINS || defaultAccessDomains));
}

function readStoredDomains(env = process.env) {
  if (runtimeDomains) return runtimeDomains;
  const filePath = accessConfigPath(env);
  try {
    if (!existsSync(filePath)) return null;
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    const domains = uniqueList(parsed.allowedDomains);
    if (!domains.length) return null;
    runtimeDomains = domains;
    return domains;
  } catch {
    return null;
  }
}

function writeStoredDomains(domains, env = process.env) {
  const next = uniqueList(domains);
  runtimeDomains = next;
  const filePath = accessConfigPath(env);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({
    allowedDomains: next,
    updatedAt: new Date().toISOString(),
  }, null, 2));
  return next;
}

function allowedDomains(env = process.env) {
  return readStoredDomains(env) || envAllowedDomains(env);
}

function allowedEmails(env = process.env) {
  return uniqueList(splitList(env.AUTH_ALLOWED_EMAILS || env.SOLVYS_ADMIN_EMAILS || ""));
}

function applyAccessChange(action, value, env = process.env) {
  const normalized = normalizedAccessValue(value);
  if (!validAccessValue(normalized)) {
    const error = new Error("Enter a valid company email or domain.");
    error.code = "invalid_access_value";
    throw error;
  }
  const domain = accessDomain(normalized);
  const current = allowedDomains(env);
  const next = action === "remove"
    ? current.filter((item) => item !== domain)
    : uniqueList([...current, domain]);
  return {
    value: normalized,
    domain,
    allowedDomains: writeStoredDomains(next.length ? next : envAllowedDomains(env), env),
  };
}

function accessConfig(env = process.env) {
  return {
    allowedDomains: allowedDomains(env),
    allowedEmails: allowedEmails(env),
    defaultDomains: envAllowedDomains(env),
    source: readStoredDomains(env) ? "admin" : "environment",
  };
}

function resetAccessConfigForTests() {
  runtimeDomains = null;
}

module.exports = {
  accessConfig,
  accessDomain,
  allowedDomains,
  allowedEmails,
  applyAccessChange,
  defaultAccessDomains,
  normalizedAccessValue,
  resetAccessConfigForTests,
  splitList,
  validAccessValue,
};
