function createCommandDrawer({ root = document, announce = () => {} } = {}) {
  const composer = root.querySelector(".shell-composer");
  const toggle = root.querySelector("#commandDrawerToggle");
  const panel = root.querySelector("#commandDrawerPanel");
  const closeButton = root.querySelector("#commandDrawerClose");
  const input = root.querySelector("#commandInput");

  if (!composer || !toggle || !panel || !closeButton || !input) {
    throw new Error("The search and commands drawer is unavailable.");
  }

  let open = false;
  let destroyed = false;
  let focusFrame = 0;

  function syncState({ restoreFocus = false } = {}) {
    composer.dataset.commandDrawerOpen = String(open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.inert = open;
    if (!open && restoreFocus) toggle.focus({ preventScroll: true });
    panel.setAttribute("aria-hidden", String(!open));
    panel.inert = !open;
  }

  function openDrawer({ focus = true } = {}) {
    if (destroyed || open) return false;
    open = true;
    syncState();
    if (focus) {
      focusFrame = window.requestAnimationFrame(() => {
        focusFrame = 0;
        if (!destroyed && open) input.focus({ preventScroll: true });
      });
    }
    announce("Search and commands opened.");
    return true;
  }

  function closeDrawer({ restoreFocus = true } = {}) {
    if (destroyed || !open) return false;
    if (focusFrame) {
      window.cancelAnimationFrame(focusFrame);
      focusFrame = 0;
    }
    open = false;
    syncState({ restoreFocus });
    announce("Search and commands closed.");
    return true;
  }

  function onToggleClick() {
    if (open) closeDrawer();
    else openDrawer();
  }

  function onCloseClick() {
    closeDrawer();
  }

  function onKeyDown(event) {
    if (!open || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    closeDrawer();
  }

  syncState();
  toggle.addEventListener("click", onToggleClick);
  closeButton.addEventListener("click", onCloseClick);
  document.addEventListener("keydown", onKeyDown, true);

  return Object.freeze({
    close: closeDrawer,
    destroy() {
      if (destroyed) return false;
      if (focusFrame) window.cancelAnimationFrame(focusFrame);
      toggle.removeEventListener("click", onToggleClick);
      closeButton.removeEventListener("click", onCloseClick);
      document.removeEventListener("keydown", onKeyDown, true);
      open = false;
      syncState();
      destroyed = true;
      return true;
    },
    isOpen: () => open,
    open: openDrawer,
    toggle,
  });
}

export { createCommandDrawer };
