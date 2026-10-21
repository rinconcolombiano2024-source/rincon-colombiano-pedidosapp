import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
for (const file of ["cliente.js","www/cliente.js"]) {
  test(file + ": Google Maps must reject missing or invalid route distance", () => {
    const source = readFileSync(new URL("../../" + file, import.meta.url),"utf8");
    const start = source.indexOf("function customerGetGoogleMapsDistance(origin, destination)");
    const end = source.indexOf("function customerAddressComponent(",start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start,end);
    assert.match(body,/element\.status !== "OK"/);
    assert.match(body,/Number\(element\.distance\?\.value\)/);
    assert.match(body,/!Number\.isFinite\(meters\) \|\| meters <= 0/);
    assert.match(body,/reject\(new Error\(customerT\("mapsRouteError"/);
    assert.match(body,/Math\.round\(\(meters \/ 1000\) \* 10\) \/ 10/);
  });
}
