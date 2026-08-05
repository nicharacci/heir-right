function gridStatus(root, message, tone = "neutral") {
  const status = root?.querySelector?.("[data-grid-status]");
  if (!status) return;
  status.textContent = String(message || "");
  if (tone === "neutral") delete status.dataset.tone;
  else status.dataset.tone = tone;
}

export { gridStatus };
