import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the actual production helpers, rather than only matching source text.
// No network, database, payment or browser side effects.
for (const file of ['cliente.js', 'www/cliente.js']) {
  const source = readFileSync(file, 'utf8');
  function extract(name) {
    const start = source.indexOf('function ' + name + '(');
    assert.ok(start >= 0, file + ': missing ' + name);
    const end = source.indexOf('\n}', start);
    assert.ok(end > start, file + ': missing function end for ' + name);
    return source.slice(start, end + 2);
  }
  const context = vm.createContext({});
  vm.runInContext([
    extract('customerNormalizeNote'),
    extract('customerNormalizeNoteDraft'),
    extract('customerEscapeHtml'),
  ].join('\n'), context, { timeout: 1000 });

  test(file + ': special instructions are normalized without leaking into another item', () => {
    const first = { id: 'a', note: context.customerNormalizeNote(' sin cebolla ') };
    const second = { id: 'b', note: context.customerNormalizeNote(' salsa aparte ') };
    assert.equal(first.note, 'SIN CEBOLLA');
    assert.equal(second.note, 'SALSA APARTE');
    first.note = context.customerNormalizeNoteDraft('sin hielo');
    assert.equal(first.note, 'SIN HIELO');
    assert.equal(second.note, 'SALSA APARTE');
  });

  test(file + ': hostile note content is escaped before HTML rendering', () => {
    const payload = '<img src=x onerror="alert(1)">&\'';
    const normalized = context.customerNormalizeNote(payload);
    const escaped = context.customerEscapeHtml(normalized);
    assert.ok(!escaped.includes('<img'), 'HTML tags must not survive escaping');
    assert.ok(!escaped.includes('onerror="'), 'raw HTML attribute must not survive escaping');
    assert.ok(escaped.includes('&lt;IMG'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
    assert.ok(escaped.includes('&#039;'));
  });
}
