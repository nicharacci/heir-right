const modalFocusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function modalFocusableElements(dialog) {
  return [...(dialog?.querySelectorAll?.(modalFocusableSelector) || [])]
    .filter((element) => !element.hidden && element.getAttribute?.("aria-hidden") !== "true");
}

function containModalKeydown(event, dialog, { onEscape, activeElement = globalThis.document?.activeElement } = {}) {
  if (!event || !dialog) return false;
  if (event.key === "Escape") {
    event.preventDefault?.();
    event.stopPropagation?.();
    onEscape?.();
    return true;
  }
  if (event.key !== "Tab") return false;
  const focusable = modalFocusableElements(dialog);
  if (!focusable.length) {
    event.preventDefault?.();
    dialog.tabIndex = -1;
    dialog.focus?.({ preventScroll: true });
    return true;
  }
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && (activeElement === first || !dialog.contains?.(activeElement))) {
    event.preventDefault?.();
    last.focus?.({ preventScroll: true });
    return true;
  }
  if (!event.shiftKey && (activeElement === last || !dialog.contains?.(activeElement))) {
    event.preventDefault?.();
    first.focus?.({ preventScroll: true });
    return true;
  }
  return false;
}

export { containModalKeydown, modalFocusableElements, modalFocusableSelector };
