import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of ["app.js", "www/app.js"]) {
  test(`${path}: restaurant opening confirms server RPC result without redundant SELECT`, () => {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const start = source.indexOf("async function persistRestaurantOperationalOpenInCloud(nextOpen)");
    const end = source.indexOf("\nfunction setRestaurantStatusControlsDisabled", start);
    assert.ok(start >= 0 && end > start);
    const body = source.slice(start, end);
    assert.match(body, /cloudState\.client\.rpc\("set_current_restaurant_operational_open"/);
    assert.match(body, /result\.restaurant_user_id !== cloudState\.user\?\.id/);
    assert.match(body, /result\.operational_open !== expectedOpen/);
    assert.match(body, /Array\.isArray\(data\) && data\.length === 1/);
    assert.doesNotMatch(body, /verifyRestaurantOperationalOpenInCloud\(/);
    assert.match(body, /if \(error\) throw error/);
  });
}
