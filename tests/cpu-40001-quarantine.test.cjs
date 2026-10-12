'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
for (const filename of ['app.js', 'www/app.js']) {
  test(filename + ': SQLSTATE 40001 failed reconciliation blocks automatic writes', () => {
    const src = fs.readFileSync(path.join(root, filename), 'utf8');
    const start = src.indexOf('catch (reconciliationError)');
    assert.ok(start > 0, 'reconciliation catch exists');
    const section = src.slice(start, start + 1800);
    assert.match(section, /error\?\.code \|\| error\?\.cause\?\.code/);
    assert.match(section, /=== "40001"/);
    assert.match(section, /saveRevisionConflictBackup\(order, remoteRevision\)/);
    assert.match(section, /blockOrderRevisionSync\(order, remoteRevision, "revision_unverified"\)/);
    assert.match(section, /blocked\.code = "RC_ORDERA_REVISION_UNVERIFIED"/);
    assert.ok(section.indexOf('=== "40001"') < section.indexOf('blockOrderRevisionSync('));
  });
}
