import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

for (const entry of ["app.js", "www/app.js"]) {
  test(`${entry}: cloud loading always releases the busy flag and refreshes status`, () => {
    const source = readFileSync(resolve(root, entry), "utf8");
    const start = source.indexOf("async function loadCloudData()");
    const end = source.indexOf("function closureReportRange(", start);
    assert.ok(start >= 0 && end > start, "cloud loader must exist");
    const body = source.slice(start, end);
    assert.match(body, /cloudState\.loading\s*=\s*true/);
    assert.match(body, /finally\s*\{\s*cloudState\.loading\s*=\s*false;\s*updateCloudStatus\(\)/);
    assert.match(body, /if\s*\(cloudState\.loading\)\s*return\s*\{\s*ok:\s*false,\s*reason:\s*"busy"/);
    assert.match(body, /schedulePendingDataSyncRetry\(/);
  });
}
