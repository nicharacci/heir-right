import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../apps/worker/src/s46-discovery-worker.ts", import.meta.url), "utf8");
assert.match(source, /S46_MAX_BATCH_FILES/);
assert.match(source, /S46_MAX_BATCH_BYTES/);
assert.match(source, /original_order/);
assert.match(source, /batch_order/);
assert.match(source, /const childKey = `\$\{key\.slice\(0, 70\)\}:\$\{source\.sha\}`/);
assert.match(source, /for \(let index = 0; index < parts\.length; index \+= 1\)/);
console.log("s46 batch contract: pass");
