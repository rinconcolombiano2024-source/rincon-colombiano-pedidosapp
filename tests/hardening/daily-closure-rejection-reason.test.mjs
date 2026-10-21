import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of ["app.js", "www/app.js"]) {
  test(`${path}: daily close surfaces server rejection without bypassing validation`, () => {
    const source = readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
    const handler = source.indexOf('elements.printDailyCloseButton.addEventListener("click"');
    assert.ok(handler > 0);
    const block = source.slice(handler, handler + 500);
    assert.match(block, /printDailyClose\(\)\.catch/);
    assert.match(block, /error\?\.message/);
    assert.doesNotMatch(block, /printRenderedTicket/);
    const confirm = source.indexOf("async function confirmCloudPeriodClosure(");
    assert.ok(confirm > 0);
    const check = source.slice(confirm, confirm + 1200);
    assert.match(check, /pendingOrdersCount\(\)/);
    assert.match(check, /close_current_restaurant_period/);
    const print = source.indexOf("async function printDailyClose(");
    assert.ok(print > 0);
    const printBody = source.slice(print, print + 600);
    assert.ok(printBody.indexOf('confirmCloudPeriodClosure("day"') < printBody.indexOf("renderPrintDailyClose(report)"));
  });
}
