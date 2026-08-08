import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/worker/src/s46-packet-pdf.ts", import.meta.url), "utf8");
for (const label of ["Owner", "DOB", "DOD", "Obituary", "Back Story", "Potential Heirs", "Offer/Profit", "Property, Tax and Deed"]) assert.ok(source.includes(label), `missing ${label}`);
assert.match(source, /boldValue: true/);
assert.match(source, /Subtype: "Link"/);
assert.doesNotMatch(source, /Needs review|Discovery subject/);
console.log("s46 North Star packet contract: pass");
