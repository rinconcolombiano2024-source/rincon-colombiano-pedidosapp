import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync('cliente.js', 'utf8');
const androidSource = readFileSync('www/cliente.js', 'utf8');

test('item notes have an explicit accessible label and per-line identity', () => {
  assert.equal(source, androidSource, 'Web and Android customer scripts must match');
  assert.match(source, /<label class="customer-item-note-label" for="customer-note-\$\{customerEscapeHtml\(item\.id\)\}"/);
  assert.match(source, /id="customer-note-\$\{customerEscapeHtml\(item\.id\)\}" class="customer-note-input"/);
  assert.match(source, /data-action="note"/);
  assert.match(source, /item\.note = customerNormalizeNoteDraft\(event\.target\.value\)/);
  assert.match(source, /const item = customerCart\.find\(\(entry\) => entry\.id === row\.dataset\.id\)/);
});

test('item notes have distinct translations and are escaped before HTML insertion', () => {
  for (const label of [
    'Observaciones para este producto',
    'Uwagi do tego produktu',
    'Instructions for this item',
  ]) assert.ok(source.includes(label), label);
  assert.match(source, /customerEscapeHtml\(customerT\("itemNoteLabel"\)\)/);
  assert.match(source, /customerEscapeHtml\(\s*item\.note\s*\)/);
  assert.match(source, /maxlength="250"/);
});

test('notes remain part of the per-item order snapshot, independent of prices', () => {
  assert.match(source, /const itemNote = customerNormalizeNote\(item\.note\)/);
  assert.match(source, /options_snapshot:\s*\{[\s\S]*?note: itemNote,/);
  assert.match(source, /total_snapshot: itemTotal,[\s\S]*?note: itemNote,/);
  assert.match(source, /const itemTotal = Math\.round\(unitPrice \* quantity \* 100\) \/ 100/);
});
