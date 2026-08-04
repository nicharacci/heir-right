function fallbackEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeFor(bridge, value) {
  return bridge?.escapeHtml ? bridge.escapeHtml(String(value ?? "")) : fallbackEscape(value);
}

function relativeUpdate(value, now = Date.now()) {
  const timestamp = Number(value || 0);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "Not updated yet";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
}

function documentTone(document = {}) {
  if (document.hasVerifiedFile || document.workflowStatus === "complete") return "complete";
  if (document.workflowStatus === "blocked" || /blocked|missing|needed/i.test(document.status || "")) return "blocked";
  if (document.workflowStatus === "active") return "active";
  return "review";
}

function renderDocumentRow(document, bridge) {
  const escape = (value) => escapeFor(bridge, value);
  const selected = Boolean(document.selected);
  const status = document.hasVerifiedFile ? "Verified" : document.status || document.workflowLabel || "Needs review";
  const source = document.source || "Estate document";
  const aria = `${document.title}. ${status}. ${source}. ${relativeUpdate(document.updatedAt)}. Open document context.`;
  return `
    <article
      class="hr-document-row"
      role="button"
      tabindex="0"
      data-document-open="${escape(document.id)}"
      data-state="${escape(documentTone(document))}"
      aria-current="${selected ? "true" : "false"}"
      aria-label="${escape(aria)}"
    >
      <span class="hr-document-primary">
        <strong>${escape(document.title || "Estate document")}</strong>
        <span>${escape(document.description || "Review this document in the estate packet.")}</span>
      </span>
      <span class="hr-document-meta">
        <span class="hr-document-status" data-state="${escape(documentTone(document))}">${escape(status)}</span>
        <span>${escape(source)}</span>
        <span>${escape(relativeUpdate(document.updatedAt))}</span>
      </span>
    </article>
  `;
}

function mountDocumentRows(root, onOpen, { onError, onStart } = {}) {
  root?.querySelectorAll?.("[data-document-open]").forEach((row) => {
    const open = () => {
      onStart?.(row);
      row.setAttribute?.("aria-busy", "true");
      void Promise.resolve()
        .then(() => onOpen?.(row.dataset.documentOpen, row))
        .then((result) => {
          root.querySelectorAll?.("[data-document-open]").forEach((candidate) => {
            candidate.setAttribute?.("aria-current", candidate === row ? "true" : "false");
          });
          return result;
        })
        .catch((error) => {
          row.focus?.({ preventScroll: true });
          try {
            onError?.(error, row);
          } catch (handlerError) {
            console.error("HeirRight document recovery failed.", handlerError);
          }
        })
        .finally(() => row.removeAttribute?.("aria-busy"));
    };
    row.addEventListener("click", (event) => {
      if (event.target.closest?.("button, a, input, select, textarea, [contenteditable='true']")) return;
      open();
    });
    row.addEventListener("keydown", (event) => {
      if (event.target !== row || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      open();
    });
  });
}

export { documentTone, escapeFor, mountDocumentRows, relativeUpdate, renderDocumentRow };
