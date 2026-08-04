import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { clientDefaultEstatesCsv, clientDefaultEstatesFileName } from "../src/data/client-default-estates.mjs";

const legacy = fs.readFileSync(new URL("../src/legacy/app.js", import.meta.url), "utf8");
const parser = legacy.slice(
  legacy.indexOf("function parseDelimitedRows"),
  legacy.indexOf("function estateFileImportItems")
);
const api = vm.runInNewContext(`${parser}\n({ csvFileImportItems });`, {
  crmBatchImportLimit: 250,
  normalizeCrmImport: (value) => value,
});

const estates = api.csvFileImportItems(clientDefaultEstatesCsv, clientDefaultEstatesFileName);
assert.equal(estates.length, 51, "all client CSV estate rows must be retained");
assert.ok(estates.every((estate) => estate.sourceRecordId.startsWith("CVS.csv:row-")), "default estates need stable source-row identity");
assert.ok(estates.every((estate) => !/[\uFFFD\u0000-\u001F]/.test(`${estate.ownerName} ${estate.propertyAddress}`)), "default estate text must remove malformed import characters");
assert.ok(estates.every((estate) => estate.ownerName && estate.propertyAddress), "default estates need reviewable identity and address values");

const incomplete = api.csvFileImportItems("First Name;Last Name;Address\nReview;Estate;\n", "incomplete.csv");
assert.equal(incomplete.length, 1, "incomplete records must remain importable for review");
assert.equal(incomplete[0].propertyAddress, "Address needs review");
assert.match(incomplete[0].notes, /Needs review: missing address field\./);

assert.match(legacy, /async function addRowsToQueue[\s\S]*await queueEstatesForDocPrep\(validRows\)[\s\S]*setActiveShellView\("dossiers", "Doc Prep"\)/, "Estate Search queue actions must persist into the Doc Prep workflow and open that workbench");

console.log("S41 client default estate intake passed");
