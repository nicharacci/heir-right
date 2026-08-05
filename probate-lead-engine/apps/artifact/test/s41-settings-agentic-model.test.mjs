import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const artifactRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(artifactRoot, relativePath), "utf8");
const legacy = read("src/legacy/app.js");
const mounted = read("src/features/beui-runtime/mounted-app.tsx");
const settings = read("src/features/beui-tabs/settings.tsx");

assert.match(legacy, /agenticModelStatus: publicAgenticModelStatus/);
assert.match(legacy, /agenticModelPreference: publicAgenticModelPreference/);
assert.match(legacy, /verifiedFreeModels/);
assert.match(legacy, /id === "beui-load-agentic-model-status"/);
assert.match(legacy, /id === "beui-set-agentic-model"[\s\S]*verifiedFreeModels\.includes/);
assert.match(legacy, /id === "beui-set-agentic-model"[\s\S]*storageSetItem\(agenticModelPreferenceKey/);
assert.match(legacy, /id === "beui-refresh-connection"[\s\S]*loadAgenticModelStatus/);
assert.match(mounted, /beui-load-agentic-model-status/);
assert.match(mounted, /beui-set-agentic-model/);
assert.match(mounted, /verifiedFreeModels/);
assert.match(settings, /Nous Portal/);
assert.match(settings, /const modelOptions = \["dynamic-free-catalog", \.\.\.verifiedFreeModels/);
assert.match(settings, /Refresh status/);
assert.doesNotMatch(settings, />Open control</);
assert.match(settings, /disabled=\{!agenticModelStatus\?\.loaded \|\| !onAgenticModelChange\}/);

console.log("S41 settings agentic model contract passed (public status, catalog validation, load/refresh, and truthful controls verified)");
