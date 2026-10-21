import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const files = ["app.js", "www/app.js"];
const root = readFileSync(files[0], "utf8");
test("restaurant and Android runtimes keep identical financial close feedback", () => {
  assert.equal(root, readFileSync(files[1], "utf8"));
});

const match = root.match(/function periodCloseFailureMessage\(error\) \{[\s\S]*?\n\}/);
assert.ok(match, "financial close rejection mapper must exist");
const getMessage = (code, locale = "es-ES") => vm.runInNewContext(
  match[0] + "\nperiodCloseFailureMessage({ message: " + JSON.stringify(code) + " })",
  { appUiLocale: () => locale }
);

test("server close guard rejection includes actionable cashier guidance in ES, PL, EN", () => {
  for (const lang of ["es-ES", "pl-PL", "en-GB"]) {
    for (const code of ["RC_ORDERA_CLOSE_ORDERS_UNFINISHED", "RC_ORDERA_CLOSE_CLIENT_ORDER_IN_PROGRESS", "RC_ORDERA_CLOSE_STATION_IN_PREPARATION"]) {
      assert.ok(getMessage(code, lang).length > 35);
    }
    for (const code of ["RC_ORDERA_CLOSE_PAYMENT_NOT_CONFIRMED", "RC_ORDERA_CLOSE_PAYMENT_METHOD_REQUIRED", "RC_ORDERA_CLOSE_UNLINKED_CUSTOMER_UNPAID",
      "RC_ORDERA_CLOSE_UNLINKED_CUSTOMER_NOT_RECONCILED", "RC_ORDERA_CLOSE_REPORT_NOT_RECONCILED", "RC_ORDERA_CLOSE_TENDER_RECONCILIATION_FAILED"]) {
      assert.ok(getMessage(code, lang).length > 35);
    }
    assert.notEqual(getMessage("RC_ORDERA_CLOSE_PAYMENT_METHOD_REQUIRED", lang), getMessage("RC_ORDERA_CLOSE_ORDERS_UNFINISHED", lang));
    assert.doesNotMatch(getMessage("connection aborted", lang), /SQL|RC_ORDERA_/);
  }
});

test("printing always waits for a successfully confirmed cloud close", () => {
  const fn = root.slice(root.indexOf("async function printDailyClose()"), root.indexOf("function renderPrintMonthlyClose("));
  assert.ok(fn.indexOf('await confirmCloudPeriodClosure("day"') < fn.indexOf("renderPrintDailyClose(report)"));
  assert.ok(fn.indexOf('await confirmCloudPeriodClosure("day"') < fn.indexOf("await printRenderedTicket()"));
  assert.match(root, /alert\(periodCloseFailureMessage\(error\)\)/);
});
