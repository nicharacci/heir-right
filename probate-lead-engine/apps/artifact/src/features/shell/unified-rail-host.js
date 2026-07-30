import { runtime } from "../../core/feature-registry.js";
import { iconMarkup } from "../../ui/icon-facade.js";

const RAIL_EXIT_MS = 320;
const RAIL_WIDTH_STEP = 16;

const RAIL_ACTION_ERRORS = Object.freeze({
  "open-document": "The verified file could not be opened. Confirm this estate's current document and try again.",
  "download-document": "The verified file could not be downloaded. Confirm this estate's current document and try again.",
  "open-packet": "The current verified packet could not be opened. Confirm the active revision and try again.",
  "download-packet": "The current verified packet could not be downloaded. Confirm the active revision and try again.",
  "approve-packet": "The current packet could not be approved. Confirm the verified revision and try again.",
  "deliver-google-packet": "The approved packet could not be sent. Review the Google setup and try again.",
  "chatgpt-work": "The ChatGPT Work handoff could not continue. Confirm the current packet and try again.",
  "open-chatgpt-work": "The ChatGPT Work handoff could not continue. Confirm the current packet and try again.",
  "review-contact-candidate": "The IDI contact decision could not be saved. Confirm this estate's current report and try again.",
  "save-source-capture": "The source evidence could not be saved. Confirm the selected estate and try again.",
});

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

function focusableElements(root) {
  return [...root.querySelectorAll(
    'button:not([disabled]), wa-button:not([disabled]):not([loading]), wa-icon-button:not([disabled]):not([loading]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => (
    !element.hidden
    && element.getAttribute("aria-hidden") !== "true"
    && element.getClientRects().length > 0
  ));
}

function focusTargetAvailable(target) {
  if (!(target instanceof HTMLElement) || !target.isConnected || target.disabled) return false;
  let current = target;
  while (current) {
    if (current.hidden || current.inert || current.getAttribute?.("aria-hidden") === "true") return false;
    current = current.parentElement;
  }
  return target.getClientRects().length > 0;
}

function focusAndConfirm(target) {
  if (!focusTargetAvailable(target)) return false;
  target.focus({ preventScroll: true });
  return document.activeElement === target;
}

function setRailDisclosureState(target, expanded) {
  if (!target?.matches?.("[data-shell-open-context]")) return false;
  target.setAttribute("aria-expanded", String(expanded));
  return true;
}

function syncRailTriggerSemantics(state) {
  const trigger = document.querySelector("#s38OpenRail");
  if (!trigger) return;
  trigger.setAttribute("aria-controls", "s38UnifiedRail");
  trigger.setAttribute("aria-expanded", String(Boolean(state.open)));
  if (state.mobileSheet) trigger.setAttribute("aria-haspopup", "dialog");
  else trigger.removeAttribute("aria-haspopup");
}

function operatorRailError(actionId = "") {
  return RAIL_ACTION_ERRORS[actionId]
    || "That estate action could not finish. Review the current file and try again.";
}

function createRailActionFeedback(region) {
  const message = region.querySelector("[data-unified-rail-error-message]");
  return Object.freeze({
    show(copy) {
      message.textContent = String(copy || operatorRailError());
      region.hidden = false;
      region.dataset.visible = "true";
    },
    clear() {
      message.textContent = "";
      region.hidden = true;
      delete region.dataset.visible;
    },
  });
}

function backgroundElementsFor(layer, body = document.body) {
  const background = [];
  let current = layer;
  while (current?.parentElement) {
    const parent = current.parentElement;
    [...parent.children].forEach((element) => {
      if (element !== current && !background.includes(element)) background.push(element);
    });
    if (parent === body) break;
    current = parent;
  }
  return background;
}

function createBackgroundInertController(layer, body = document.body) {
  let records = [];
  return Object.freeze({
    apply() {
      if (records.length) return false;
      records = backgroundElementsFor(layer, body).map((element) => ({
        element,
        inert: Boolean(element.inert),
        inertAttribute: element.hasAttribute?.("inert") ?? false,
      }));
      records.forEach(({ element }) => {
        element.inert = true;
      });
      return true;
    },
    restore() {
      if (!records.length) return false;
      records.forEach(({ element, inert, inertAttribute }) => {
        element.inert = inert;
        if (!inert && !inertAttribute) element.removeAttribute?.("inert");
      });
      records = [];
      return true;
    },
    active() {
      return records.length > 0;
    },
  });
}

function isTextEntry(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function isApplicationShortcut(event) {
  if (isTextEntry(event.target)) return false;
  if (["/", "?"].includes(event.key)) return true;
  if (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key)) return true;
  return Boolean((event.metaKey || event.ctrlKey || event.altKey) && event.key.length === 1);
}

function containMobileRailKeydown(event, rail, focusEntry) {
  if (!rail.contains(event.target)) {
    event.preventDefault();
    event.stopImmediatePropagation?.();
    focusEntry();
    return true;
  }
  if (!isApplicationShortcut(event)) return false;
  if (["/", "?"].includes(event.key) || (event.altKey && ["ArrowUp", "ArrowDown"].includes(event.key))) {
    event.preventDefault();
  }
  event.stopImmediatePropagation?.();
  return true;
}

async function executeRailAction({ controls = [], execute, onReject = () => {} }) {
  const records = [...new Set(controls.filter(Boolean))].map((control) => ({
    control,
    disabled: Boolean(control.disabled),
    busy: control.getAttribute?.("aria-busy"),
  }));
  records.forEach(({ control }) => {
    control.disabled = true;
    control.setAttribute?.("aria-busy", "true");
  });
  try {
    return { ok: true, value: await execute() };
  } catch (error) {
    onReject(error);
    return { ok: false, error };
  } finally {
    records.forEach(({ control, disabled, busy }) => {
      control.disabled = disabled;
      if (busy === null || busy === undefined) control.removeAttribute?.("aria-busy");
      else control.setAttribute?.("aria-busy", busy);
    });
  }
}

function createUnifiedRailHost({ bridge, content, announce = () => {} }) {
  const layer = document.createElement("div");
  layer.className = "shell-unified-rail-layer";
  layer.dataset.open = "false";
  layer.hidden = true;
  layer.innerHTML = `
    <button class="shell-rail-backdrop" type="button" aria-label="Close Case Journey" data-unified-rail-close></button>
    <aside id="s38UnifiedRail" class="shell-unified-rail" aria-label="Case Journey" aria-hidden="true">
      <div class="shell-rail-resizer" role="separator" aria-orientation="vertical" aria-label="Resize Case Journey" tabindex="0"></div>
      <header class="shell-rail-header">
        <div class="shell-rail-heading">
          <span class="shell-rail-kicker" data-unified-rail-label>Case Journey</span>
          <strong data-unified-rail-estate>No estate selected</strong>
          <span data-unified-rail-meta>Choose an estate to begin.</span>
        </div>
        <button class="shell-rail-close" type="button" aria-label="Close Case Journey" title="Close Case Journey" data-unified-rail-close>
          ${iconMarkup("close", { size: 18 })}
        </button>
      </header>
      <div class="shell-rail-tabs" role="tablist" aria-label="Case Journey sections" aria-orientation="horizontal"></div>
      <div class="shell-rail-action-error" role="alert" aria-live="assertive" aria-atomic="true" data-unified-rail-error hidden>
        <span class="shell-rail-action-error-copy"><strong>Action needs attention</strong><span data-unified-rail-error-message></span></span>
        <button type="button" data-unified-rail-retry>Retry</button>
      </div>
      <div id="s38UnifiedRailPanel" class="shell-rail-content" role="tabpanel" data-unified-rail-content tabindex="-1"></div>
    </aside>
  `;
  content.append(layer);

  const rail = layer.querySelector("#s38UnifiedRail");
  const backdrop = layer.querySelector(".shell-rail-backdrop");
  const tabs = layer.querySelector(".shell-rail-tabs");
  const railContent = layer.querySelector("[data-unified-rail-content]");
  const resizer = layer.querySelector(".shell-rail-resizer");
  const actionError = layer.querySelector("[data-unified-rail-error]");
  const actionFeedback = createRailActionFeedback(actionError);
  const backgroundInert = createBackgroundInertController(layer);
  const mobileQuery = window.matchMedia("(max-width: 819px)");
  let appState = bridge.readState();
  let railState = runtime.rails.snapshot();
  let closeTimer = null;
  let activeTabSignature = "";
  let invoker = null;
  let resizing = null;
  let failedAction = null;
  let destroyed = false;

  function clearActionError() {
    failedAction = null;
    actionFeedback.clear();
  }

  function setRailGeometry(state) {
    const descriptor = state.active;
    const width = Number(state.width || descriptor?.defaultWidth || 392);
    layer.style.setProperty("--s38-active-rail-width", `${width}px`);
    resizer.setAttribute("aria-valuemin", String(descriptor?.minWidth || 340));
    resizer.setAttribute("aria-valuemax", String(descriptor?.maxWidth || 480));
    resizer.setAttribute("aria-valuenow", String(width));
    resizer.setAttribute("aria-valuetext", `${state.active?.label || "Context"} ${width} pixels wide`);
  }

  function renderTabs(state) {
    const descriptor = state.active;
    const signature = descriptor
      ? `${descriptor.id}:${state.activeTab}:${descriptor.tabs.map((tab) => `${tab.id}:${tab.label}`).join("|")}`
      : "";
    if (signature === activeTabSignature) return;
    activeTabSignature = signature;
    tabs.innerHTML = descriptor?.tabs.map((tab, index) => `
      <button id="s38UnifiedRailTab${index}" type="button" role="tab" data-unified-rail-tab="${bridge.escapeHtml(tab.id)}" aria-controls="s38UnifiedRailPanel" aria-selected="${tab.id === state.activeTab}" tabindex="${tab.id === state.activeTab ? 0 : -1}">${bridge.escapeHtml(tab.label)}</button>
    `).join("") || "";
    const selectedTab = tabs.querySelector('[aria-selected="true"]');
    if (selectedTab) railContent.setAttribute("aria-labelledby", selectedTab.id);
    else railContent.removeAttribute("aria-labelledby");
  }

  function focusRailTab(tabId) {
    return [...tabs.querySelectorAll("[data-unified-rail-tab]")]
      .find((button) => button.dataset.unifiedRailTab === tabId)
      ?.focus({ preventScroll: true });
  }

  function renderContent({ animate = false } = {}) {
    if (!railState.active) {
      railContent.innerHTML = `
        <div class="journey-rail-empty">
          <span class="journey-rail-empty-icon">${iconMarkup("timeline", { size: 21 })}</span>
          <h3>Case Journey is ready</h3>
          <p>Choose an estate file to load its review steps.</p>
        </div>
      `;
      return;
    }
    if (animate) {
      railContent.dataset.transition = "changing";
      window.setTimeout(() => delete railContent.dataset.transition, reducedMotion() ? 1 : 200);
    }
    const rendered = runtime.rails.render({ state: appState, bridge });
    if (rendered instanceof Node) {
      railContent.replaceChildren(rendered);
    } else {
      railContent.innerHTML = typeof rendered === "string" ? rendered : "";
    }
  }

  function syncHeader(state) {
    const label = state.active?.label || "Case Journey";
    const closeLabel = `Close ${label}`;
    layer.querySelector("[data-unified-rail-label]").textContent = label;
    layer.querySelector("[data-unified-rail-estate]").textContent = appState.selectedEstate?.title || "No estate selected";
    layer.querySelector("[data-unified-rail-meta]").textContent = appState.selectedEstate?.address || "Choose an estate to begin.";
    rail.setAttribute("aria-label", label);
    tabs.setAttribute("aria-label", `${label} sections`);
    resizer.setAttribute("aria-label", `Resize ${label}`);
    layer.querySelectorAll("[data-unified-rail-close]").forEach((control) => {
      control.setAttribute("aria-label", closeLabel);
      control.setAttribute("title", closeLabel);
    });
  }

  function restoreInvokerFocus() {
    const source = invoker;
    invoker = null;
    setRailDisclosureState(source, false);
    const fallback = document.querySelector("#s38OpenRail");
    if (focusAndConfirm(source)) return true;
    return fallback !== source && focusAndConfirm(fallback);
  }

  function finishClose() {
    if (railState.open || destroyed) return;
    layer.hidden = true;
    layer.dataset.open = "false";
    rail.classList.remove("is-closing", "is-open", "is-opening");
    rail.setAttribute("aria-hidden", "true");
    document.body.classList.remove("s38-mobile-rail-open");
  }

  function closeRail() {
    if (closeTimer) window.clearTimeout(closeTimer);
    rail.classList.remove("is-open", "is-opening");
    rail.classList.add("is-closing");
    layer.dataset.open = "closing";
    clearActionError();
    backgroundInert.restore();
    restoreInvokerFocus();
    rail.setAttribute("aria-hidden", "true");
    closeTimer = window.setTimeout(finishClose, reducedMotion() ? 1 : RAIL_EXIT_MS);
  }

  function focusRailEntry() {
    if (!railState.open || destroyed) return;
    const selectedTab = tabs.querySelector('[aria-selected="true"]');
    (selectedTab || railContent).focus({ preventScroll: true });
  }

  function railActionId(control) {
    return control?.dataset?.railActionId || control?.dataset?.railAction || "";
  }

  function findRailActionControl(actionId) {
    return [...railContent.querySelectorAll("[data-rail-action-id], [data-rail-action]")]
      .find((control) => railActionId(control) === actionId && focusTargetAvailable(control))
      || null;
  }

  function captureRailContentFocus() {
    const active = document.activeElement;
    if (active === layer.querySelector("[data-unified-rail-retry]")) {
      return { actionId: failedAction?.actionId || "", fallback: true };
    }
    if (!railContent.contains(active)) return null;
    const action = active.closest?.("[data-rail-action-id], [data-rail-action]");
    return { actionId: railActionId(action), fallback: true };
  }

  function restoreRailContentFocus(descriptor) {
    if (!descriptor || !railState.open || destroyed) return false;
    const action = descriptor.actionId ? findRailActionControl(descriptor.actionId) : null;
    if (focusAndConfirm(action)) return true;
    focusRailEntry();
    return rail.contains(document.activeElement);
  }

  function openRail({ focusOnOpen = false } = {}) {
    if (closeTimer) {
      window.clearTimeout(closeTimer);
      closeTimer = null;
    }
    layer.hidden = false;
    layer.dataset.open = "true";
    rail.classList.remove("is-closing");
    rail.classList.add("is-opening");
    rail.setAttribute("aria-hidden", "false");
    setRailDisclosureState(invoker, true);
    if (mobileQuery.matches) {
      backgroundInert.apply();
      document.body.classList.add("s38-mobile-rail-open");
    }
    window.requestAnimationFrame(() => {
      if (!railState.open || destroyed) return;
      rail.classList.remove("is-opening");
      rail.classList.add("is-open");
      if (focusOnOpen) focusRailEntry();
    });
  }

  function syncRail(next, previous = railState) {
    const opening = Boolean(next.open && (!previous.open || layer.hidden));
    const contextChanged = previous.activeId !== next.activeId || previous.activeTab !== next.activeTab;
    if (opening && !invoker) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement !== document.body && !rail.contains(activeElement)) {
        invoker = activeElement;
      }
    }
    if (previous.activeId !== next.activeId || previous.activeTab !== next.activeTab) clearActionError();
    railState = next;
    syncRailTriggerSemantics(next);
    setRailGeometry(next);
    renderTabs(next);
    syncHeader(next);
    renderContent({ animate: previous.activeTab !== next.activeTab });
    rail.dataset.mobileSheet = String(Boolean(next.mobileSheet));
    if (next.mobileSheet) {
      rail.setAttribute("role", "dialog");
      if (next.open) rail.setAttribute("aria-modal", "true");
      else rail.removeAttribute("aria-modal");
    } else {
      rail.removeAttribute("role");
      rail.removeAttribute("aria-modal");
    }
    backdrop.hidden = !next.mobileSheet || !next.open;
    if (next.open) openRail({ focusOnOpen: opening });
    else if (!layer.hidden) closeRail();
    if (next.open && contextChanged && !opening) focusRailEntry();
  }

  async function runAction(button, descriptor = null) {
    const actionId = descriptor?.actionId || button.dataset.railActionId || button.dataset.railAction;
    if (!actionId) return;
    clearActionError();
    const dataset = descriptor?.dataset || { ...button.dataset };
    const payload = {
      ...dataset,
      bridge,
      state: appState,
      view: dataset.nextView,
      documentId: dataset.documentId,
      formData: button.form
        ? Object.fromEntries(new FormData(button.form).entries())
        : undefined,
    };
    const result = await executeRailAction({
      controls: [button],
      execute: () => runtime.rails.runAction(actionId, payload),
    });
    if (result.ok) {
      clearActionError();
      if (!rail.contains(document.activeElement)) {
        restoreRailContentFocus({ actionId, fallback: true });
      }
      return result.value;
    }
    const message = operatorRailError(actionId);
    failedAction = { actionId, dataset };
    actionFeedback.show(message);
    announce(message);
    const actionControl = findRailActionControl(actionId);
    if (!focusAndConfirm(actionControl)) {
      focusAndConfirm(layer.querySelector("[data-unified-rail-retry]"));
    }
    return null;
  }

  function onClick(event) {
    const close = event.target.closest("[data-unified-rail-close]");
    if (close) {
      runtime.rails.setOpen(false);
      return;
    }
    const retry = event.target.closest("[data-unified-rail-retry]");
    if (retry && failedAction?.actionId) {
      const descriptor = failedAction;
      const actionControl = findRailActionControl(descriptor.actionId);
      if (!focusAndConfirm(actionControl)) focusRailEntry();
      clearActionError();
      void runAction(actionControl || retry, descriptor);
      return;
    }
    const tab = event.target.closest("[data-unified-rail-tab]");
    if (tab) {
      clearActionError();
      const tabId = tab.dataset.unifiedRailTab;
      runtime.rails.selectTab(tabId);
      focusRailTab(tabId);
      return;
    }
    const action = event.target.closest("[data-rail-action-id], [data-rail-action]");
    if (action && layer.contains(action)) void runAction(action);
  }

  function onKeyDown(event) {
    if (!railState.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation?.();
      runtime.rails.setOpen(false);
      return;
    }
    if (mobileQuery.matches && containMobileRailKeydown(event, rail, focusRailEntry)) return;
    const focusedTab = event.target instanceof Element
      ? event.target.closest("[data-unified-rail-tab]")
      : null;
    if (focusedTab && ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      const tabButtons = [...tabs.querySelectorAll("[data-unified-rail-tab]")];
      const current = Math.max(0, tabButtons.indexOf(focusedTab));
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabButtons.length - 1
          : (current + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length;
      const nextTab = tabButtons[nextIndex];
      if (nextTab) {
        event.preventDefault();
        const nextTabId = nextTab.dataset.unifiedRailTab;
        runtime.rails.selectTab(nextTabId);
        focusRailTab(nextTabId);
      }
      return;
    }
    if (event.key !== "Tab" || !mobileQuery.matches) return;
    const focusable = focusableElements(rail);
    if (!focusable.length) {
      event.preventDefault();
      railContent.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onFocusIn(event) {
    if (!railState.open || !mobileQuery.matches || rail.contains(event.target)) return;
    event.stopImmediatePropagation?.();
    focusRailEntry();
  }

  function stopResize() {
    resizing = null;
    document.body.classList.remove("s38-rail-resizing");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", stopResize);
    window.removeEventListener("pointercancel", stopResize);
  }

  function onPointerMove(event) {
    if (!resizing) return;
    runtime.rails.setWidth(resizing.width + resizing.x - event.clientX);
  }

  function onPointerDown(event) {
    if (mobileQuery.matches) return;
    event.preventDefault();
    resizing = { x: event.clientX, width: Number(railState.width || 392) };
    document.body.classList.add("s38-rail-resizing");
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", stopResize, { once: true });
    window.addEventListener("pointercancel", stopResize, { once: true });
  }

  function onResizeKeyDown(event) {
    const width = Number(railState.width || 392);
    const min = Number(railState.active?.minWidth || 340);
    const max = Number(railState.active?.maxWidth || 480);
    const commands = {
      ArrowLeft: Math.min(max, width + RAIL_WIDTH_STEP),
      ArrowRight: Math.max(min, width - RAIL_WIDTH_STEP),
      Home: min,
      End: max,
    };
    if (!(event.key in commands)) return;
    event.preventDefault();
    runtime.rails.setWidth(commands[event.key]);
  }

  function onMobileChange(event) {
    syncRailTriggerSemantics({ ...railState, mobileSheet: event.matches });
    runtime.rails.setMobileSheet(event.matches);
    if (!event.matches) {
      backgroundInert.restore();
      document.body.classList.remove("s38-mobile-rail-open");
    } else if (railState.open) {
      backgroundInert.apply();
      document.body.classList.add("s38-mobile-rail-open");
      focusRailEntry();
    }
  }

  layer.addEventListener("click", onClick);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("focusin", onFocusIn, true);
  resizer.addEventListener("pointerdown", onPointerDown);
  resizer.addEventListener("keydown", onResizeKeyDown);
  resizer.addEventListener("dblclick", () => runtime.rails.setWidth(392));
  mobileQuery.addEventListener?.("change", onMobileChange);
  syncRailTriggerSemantics({ ...railState, mobileSheet: mobileQuery.matches });
  runtime.rails.setMobileSheet(mobileQuery.matches);
  const unsubscribe = runtime.rails.subscribe((next) => syncRail(next, railState));

  return {
    element: layer,
    open({ railId = "case-journey", tab = "overview", source = null } = {}) {
      invoker = source instanceof HTMLElement ? source : document.activeElement;
      runtime.rails.activate(railId, {
        tab,
        open: true,
        mobileSheet: mobileQuery.matches,
      });
    },
    close() {
      runtime.rails.setOpen(false);
    },
    updateApplicationState(next) {
      const focusedControl = captureRailContentFocus();
      appState = next;
      clearActionError();
      syncHeader(railState);
      renderContent();
      restoreRailContentFocus(focusedControl);
    },
    snapshot() {
      return railState;
    },
    destroy() {
      destroyed = true;
      if (closeTimer) window.clearTimeout(closeTimer);
      stopResize();
      unsubscribe();
      layer.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
      resizer.removeEventListener("pointerdown", onPointerDown);
      resizer.removeEventListener("keydown", onResizeKeyDown);
      mobileQuery.removeEventListener?.("change", onMobileChange);
      document.body.classList.remove("s38-mobile-rail-open", "s38-rail-resizing");
      backgroundInert.restore();
      restoreInvokerFocus();
      layer.remove();
    },
  };
}

export {
  RAIL_EXIT_MS,
  RAIL_WIDTH_STEP,
  backgroundElementsFor,
  containMobileRailKeydown,
  createBackgroundInertController,
  createRailActionFeedback,
  createUnifiedRailHost,
  executeRailAction,
  focusAndConfirm,
  focusTargetAvailable,
  focusableElements,
  operatorRailError,
};
