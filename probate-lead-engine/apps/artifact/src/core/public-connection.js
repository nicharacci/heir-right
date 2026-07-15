function connectionDisplayValue(value = "") {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();
}

function connectionSlug(value = "") {
  return connectionDisplayValue(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "connection";
}

function normalizePublicConnection(connection = {}) {
  const source = connection && typeof connection === "object" && !Array.isArray(connection) ? connection : {};
  const name = connectionDisplayValue(source.name || source.label || source.provider || source.id || "Connection");
  return Object.freeze({
    id: connectionDisplayValue(source.id || source.provider || connectionSlug(name)),
    label: connectionDisplayValue(source.label || source.name || source.provider || "Connection"),
    mode: connectionDisplayValue(source.mode || source.status || "Needs setup"),
  });
}

export { connectionDisplayValue, connectionSlug, normalizePublicConnection };
