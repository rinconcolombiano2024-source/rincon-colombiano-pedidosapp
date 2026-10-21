import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
for (const file of ["cliente.js", "www/cliente.js"]) {
  test(`${file}: directory loading resolves with an error instead of hanging forever`, () => {
    const code = readFileSync(resolve(root, file), "utf8");
    const start = code.indexOf("async function customerLoadRestaurantDirectoryNow(");
    const end = code.indexOf("async function customerSelectRestaurant(", start);
    assert.ok(start !== -1 && end > start);
    const loader = code.slice(start, end);
    assert.match(loader, /Promise\.race\(\[/);
    assert.match(loader, /DIRECTORY_TIMEOUT/);
    assert.match(loader, /12000/);
    assert.match(loader, /clearTimeout\(directoryTimer\)/);
    assert.match(loader, /customerT\("restaurantLoadError"\)/);
    assert.match(loader, /if \(error && customerIsMissingRpc\(error\)\)/);
    assert.match(loader, /customerRenderRestaurantDirectory\(\)/);
  });
}
