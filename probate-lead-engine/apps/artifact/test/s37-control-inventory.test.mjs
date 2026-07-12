import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
const openings = [...html.matchAll(/<button\b[^>]*>/gi)].map((match) => match[0]);
const sourceWithoutButtonOpenings = html.replace(/<button\b[^>]*>/gi, "");
const companionAttributes = new Set([
  "data-active",
  "data-add-docprep-flow",
  "data-document-id",
  "data-estate-id",
  "data-hover-description",
  "data-hover-label",
  "data-process-row",
  "data-state",
]);

const unwired = openings.filter((opening) => {
  const id = opening.match(/\bid=["']([^"']+)["']/i)?.[1];
  const actionAttributes = [...opening.matchAll(/\b(data-[a-z-]+)(?=\s|=|>)/g)]
    .map((match) => match[1])
    .filter((attribute) => !companionAttributes.has(attribute));
  const idIsHandled = Boolean(id && sourceWithoutButtonOpenings.includes(id));
  const actionIsHandled = actionAttributes.some((attribute) => sourceWithoutButtonOpenings.includes(attribute));
  const formSubmit = /\btype=["']submit["']/i.test(opening);
  const inlineHandler = /\bonclick\s*=/i.test(opening);
  const focusHelp = /\baria-describedby=["']shellInfoPopover["']/i.test(opening)
    && html.includes(".shell-info-wrap:focus-within .shell-info-popover");
  return !(idIsHandled || actionIsHandled || formSubmit || inlineHandler || focusHelp);
});

assert.ok(openings.length >= 150, `Expected the full product control inventory, found ${openings.length} buttons.`);
assert.deepEqual(unwired, [], `Buttons without a command, form action, or accessible help behavior:\n${unwired.join("\n")}`);
assert.doesNotMatch(html, /source of truth for S11|run the local validation command|data-shell-command="linear-sync"|data-shell-command="dry-run"/i);
assert.match(html, /data-shell-command="refresh-packet"/);
assert.match(html, /data-shell-command="open-admin"/);
assert.match(html, /action === "refresh-packet"/);
assert.match(html, /action === "open-admin"/);

console.log(JSON.stringify({ ok: true, checks: [
  "every_button_has_a_command_or_form_contract",
  "companion_data_attributes_not_mistaken_for_actions",
  "focus_and_touch_help_control_has_visible_behavior",
  "dashboard_commands_perform_real_product_actions",
], buttonCount: openings.length }, null, 2));
