import { setBasePath, setIconPath } from "@awesome.me/webawesome/dist/utilities/base-path.js";
import { unregisterIconLibrary } from "@awesome.me/webawesome/dist/components/icon/library.js";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/select/select.js";
import "@awesome.me/webawesome/dist/components/option/option.js";
import "@awesome.me/webawesome/dist/components/checkbox/checkbox.js";
import "@awesome.me/webawesome/dist/components/radio-group/radio-group.js";
import "@awesome.me/webawesome/dist/components/radio/radio.js";
import "@awesome.me/webawesome/dist/components/switch/switch.js";
import "@awesome.me/webawesome/dist/components/dialog/dialog.js";
import "@awesome.me/webawesome/dist/components/drawer/drawer.js";
import "@awesome.me/webawesome/dist/components/dropdown/dropdown.js";
import "@awesome.me/webawesome/dist/components/dropdown-item/dropdown-item.js";
import "@awesome.me/webawesome/dist/components/tab-group/tab-group.js";
import "@awesome.me/webawesome/dist/components/tab/tab.js";
import "@awesome.me/webawesome/dist/components/tab-panel/tab-panel.js";
import "@awesome.me/webawesome/dist/components/badge/badge.js";
import "@awesome.me/webawesome/dist/components/callout/callout.js";
import "@awesome.me/webawesome/dist/components/progress-bar/progress-bar.js";
import "@awesome.me/webawesome/dist/components/spinner/spinner.js";
import "@awesome.me/webawesome/dist/components/tag/tag.js";
import "@awesome.me/webawesome/dist/components/tooltip/tooltip.js";
import "@awesome.me/webawesome/dist/components/divider/divider.js";
import "@awesome.me/webawesome/dist/components/details/details.js";

const basePath = "/assets/webawesome";
const freeComponents = Object.freeze([
  "badge",
  "button",
  "callout",
  "checkbox",
  "details",
  "dialog",
  "divider",
  "drawer",
  "dropdown",
  "dropdown-item",
  "input",
  "option",
  "progress-bar",
  "radio",
  "radio-group",
  "select",
  "spinner",
  "switch",
  "tab",
  "tab-group",
  "tab-panel",
  "tag",
  "tooltip",
]);

setBasePath(basePath);
setIconPath(`${basePath}/icons`);
// Component internals explicitly use Web Awesome's embedded `system` library.
// Removing the default library prevents an accidental product icon from calling
// Font Awesome's hosted kit endpoints; HeirRight product icons use Nucleo.
unregisterIconLibrary("default");

export { basePath as webAwesomeBasePath, freeComponents as webAwesomeFreeComponents };
