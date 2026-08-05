import assert from "node:assert/strict";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const artifactRoot = path.dirname(testRoot);
const repoRoot = path.resolve(artifactRoot, "../..");
const iconBankPath = path.join(artifactRoot, "src/ui/beui-icon-bank.tsx");
const accountPath = path.join(artifactRoot, "src/ui/beui-account-control.tsx");
const featureRoot = path.join(artifactRoot, "src/features/beui-tabs");
const cssPath = path.join(artifactRoot, "src/styles/beui-tabs.css");
const mappingPath = path.join(repoRoot, "docs/design/S41-plasmic-beui-tabs.md");
const entryPath = path.join(artifactRoot, "src/entry.js");
const iconBank = fs.readFileSync(iconBankPath, "utf8");
const account = fs.readFileSync(accountPath, "utf8");
const entry = fs.readFileSync(entryPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const mapping = fs.readFileSync(mappingPath, "utf8");

function readFeature(fileName) {
  return fs.readFileSync(path.join(featureRoot, fileName), "utf8");
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const featureFiles = walk(featureRoot).filter((file) => /\.(ts|tsx)$/.test(file));
const featureSource = featureFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

assert.match(iconBank, /from "lucide-react"/);
assert.match(iconBank, /BEUI_ICON_BANK/);
for (const semanticName of [
  "dashboard",
  "estates",
  "export",
  "outreach",
  "queue",
  "admin",
  "settings",
  "integrations",
  "help",
  "account",
  "switchAccount",
  "logout",
]) {
  assert.match(iconBank, new RegExp(`\\b${semanticName}:`), `missing semantic icon: ${semanticName}`);
}
assert.doesNotMatch(iconBank, /<svg\b|backgroundImage|initials|picture/);
assert.match(account, /BeuiAccountIdentity/);
assert.match(account, /authenticated/);
assert.match(account, /identity\.email/);
assert.match(account, /\/auth\/login\?prompt=select_account/);
assert.match(account, /\/auth\/logout/);
assert.doesNotMatch(account, /avatar|initials|picture|<img\b|<svg\b/i);
assert.doesNotMatch(entry, /beui-icon-bank|beui-tabs|beui-account-control/);
assert.equal(
  crypto.createHash("sha256").update(entry).digest("hex"),
  "9ff9802a949a24aef77d959bc4dd8d1bdaae81184c40ce3979b4246cd8368d66",
  "mounted artifact entry.js must remain byte-identical",
);

const requiredSurfaceFiles = [
  "beui-tabs.tsx",
  "dashboard.tsx",
  "estates.tsx",
  "export.tsx",
  "outreach.tsx",
  "queue.tsx",
  "admin.tsx",
  "settings.tsx",
  "help-demos.tsx",
  "shared.tsx",
  "contract.ts",
  "tabs.tsx",
  "index.ts",
];
for (const fileName of requiredSurfaceFiles) {
  assert.ok(fs.existsSync(path.join(featureRoot, fileName)), `missing owned surface file: ${fileName}`);
}
for (const exportName of [
  "BeuiChassis",
  "ManageEstatesDashboard",
  "EstatesSurface",
  "ExportSurface",
  "OutreachSurface",
  "QueueSurface",
  "AdminSurface",
  "SettingsSurface",
  "HelpDemosSurface",
]) {
  assert.match(featureSource, new RegExp(`(?:export )?(?:function|const|\\{[^}]*\\b)\\s*${exportName}\\b`), `missing surface export: ${exportName}`);
}

const contract = readFeature("contract.ts");
for (const routeId of ["dashboard", "find-estates", "export", "drips", "queue", "admin", "settings", "help-demos"]) {
  assert.match(contract, new RegExp(`\\b${routeId.replace("-", "\\-")}\\b`), `missing route: ${routeId}`);
}
assert.match(contract, /dossiers:.*renderInT4: false/s);
assert.match(contract, /Manage Estates/);
assert.match(contract, /Help & Demos/);

const estates = readFeature("estates.tsx");
assert.match(estates, /accept="\.pdf,\.csv,application\/pdf,text\/csv"/);
assert.match(estates, /onEstateFilesAdded/);
assert.match(estates, /Incomplete records stay available for review/);
assert.match(estates, /s40-queue-estates/);
assert.match(estates, /selectedEstateIds/);
assert.match(featureSource, /data-beui-control="estate-file-upload"/);

const help = readFeature("help-demos.tsx");
for (const targetId of ["estate-file-upload", "estate-search", "queue-export", "export-table", "settings-integrations", "account-chip"]) {
  assert.match(contract, new RegExp(`targetId: "${targetId}"`), `missing Help target mapping: ${targetId}`);
  assert.match(featureSource + account, new RegExp(targetId.replace("-", "\\-")), `Help target is not a real selector: ${targetId}`);
}
assert.match(help, /onNavigate\(demo\.route\)/);
assert.match(help, /onSpotlight\(demo\.targetId\)/);
assert.doesNotMatch(help, /fetch\(|onCommand|localStorage|sessionStorage|document\.|window\./);

const forbiddenVisibleCopy = /CRM|readiness|audit/i;
assert.doesNotMatch(featureSource, forbiddenVisibleCopy, "retired CRM/readiness/audit copy must stay out of T4 modules");
assert.doesNotMatch(account, forbiddenVisibleCopy);
assert.doesNotMatch(css, /gradient|purple|glow|<svg\b/i);
assert.match(css, /:focus-visible/);
assert.match(css, /:disabled/);
assert.match(css, /prefers-reduced-motion/);
assert.match(css, /max-width: 680px/);
assert.doesNotMatch(featureSource + account, /<svg\b|@radix|@mui|antd|heroicons/i);
assert.match(iconBank, /from "lucide-react"/);
assert.match(featureSource, /beui-foundation/);
assert.match(mapping, /Exact no-fit gaps/);
assert.match(mapping, /unmounted/);

const packageRoot = artifactRoot;
let typescript;
try {
  typescript = await import("typescript");
} catch (error) {
  throw new Error(`TypeScript is required for the full unmounted chassis compile: ${error.message}`);
}
const ts = typescript.default ?? typescript;
const uiConfigPath = path.join(packageRoot, "tsconfig.ui.json");
const uiConfig = ts.readConfigFile(uiConfigPath, ts.sys.readFile);
assert.equal(uiConfig.error, undefined, "artifact UI tsconfig must be readable");
const parsed = ts.parseJsonConfigFileContent(
  {
    ...uiConfig.config,
    include: [
      ...(uiConfig.config.include ?? []),
      "src/features/beui-tabs/**/*.ts",
      "src/features/beui-tabs/**/*.tsx",
      "src/ui/beui-icon-bank.tsx",
      "src/ui/beui-account-control.tsx",
    ],
  },
  ts.sys,
  packageRoot,
);
const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
const diagnostics = ts.getPreEmitDiagnostics(program);
assert.equal(
  diagnostics.length,
  0,
  diagnostics.slice(0, 12).map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")).join("\n"),
);

const gitDiffNames = execFileSync("git", ["diff", "--name-only"], { cwd: path.resolve(repoRoot, ".."), encoding: "utf8" });
assert.doesNotMatch(gitDiffNames, /(^|\n)(probate-lead-engine\/)?apps\/artifact\/src\/(entry\.js|legacy\/app\.js)/);

assert.ok(fs.existsSync(repoRoot), "repository root must remain attached");
console.log(`s41 beui tabs contract passed (${featureFiles.length} TypeScript modules compiled; routes, intake, Help mappings, account state, CSS states, and mounted entry verified)`);
