import { getLegacyBridge } from "../core/feature-registry.js";

const semanticIcons = Object.freeze({
  dashboard: "people-three",
  estates: "search-estate",
  documents: "open-book",
  outreach: "scheduled-drips",
  queue: "batch-tray",
  admin: "admin-shield",
  settings: "gear",
  help: "open-book",
  discovery: "magnifier-route",
  journey: "panel-right",
  drawer: "panel-right",
  complete: "check-circle",
  timeline: "packet-clock",
  review: "flag",
  edit: "pencil",
  delete: "trash",
  actions: "sliders",
  close: "close",
});

function resolveIcon(name) {
  const resolved = semanticIcons[name] || name;
  if (!Object.values(semanticIcons).includes(resolved)) throw new Error(`Unknown HeirRight icon: ${name}`);
  return resolved;
}

function iconMarkup(name, { size = 19, className = "" } = {}) {
  const bridge = getLegacyBridge();
  if (!bridge) throw new Error("HeirRight icons are available after the legacy bridge is ready.");
  return bridge.icon(resolveIcon(name), size, className);
}

export { iconMarkup, resolveIcon, semanticIcons };
