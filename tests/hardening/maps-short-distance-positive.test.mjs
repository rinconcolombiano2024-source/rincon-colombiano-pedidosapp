import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
for (const file of ["cliente.js", "www/cliente.js"]) {
  test(`${file}: Google Maps distances under 50m cannot round to zero`, () => {
    const source=readFileSync(new URL("../../"+file,import.meta.url),"utf8");
    const match=source.match(/distanceKm:\s*(Math\.max\(0\.1, Math\.round\(\(meters \/ 1000\) \* 10\) \/ 10\))/);
    assert.ok(match,"Expected minimum positive rounded distance");
    const quoteKm=Function("meters",`return ${match[1]}`);
    for (const meters of [1,5,20,49,50,150,1000]) {
      assert.ok(quoteKm(meters)>0,`Positive route ${meters}m must not become zero`);
    }
    assert.equal(quoteKm(20),0.1);
    assert.equal(quoteKm(150),0.2);
    assert.match(source,/!Number\.isFinite\(meters\) \|\| meters <= 0/);
    assert.match(source,/TravelMode\.DRIVING/);
  });
}
