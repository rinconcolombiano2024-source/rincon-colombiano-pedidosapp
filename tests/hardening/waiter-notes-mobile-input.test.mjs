import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync("mesero.js","utf8");
const distribution=readFileSync("www/mesero.js","utf8");
test("waiter Android distribution matches source",()=>assert.equal(distribution,source));
test("waiter per-item note editing never replaces textarea value while typing",()=>{
 const begin=source.search(/waiterElements\.cart\.addEventListener\(\s*["']input["']/);
 const end=source.indexOf('waiterElements.notes.addEventListener("input"',begin);
 assert.ok(begin>=0&&end>begin);
 const handler=source.slice(begin,end);
 assert.match(handler,/item\.note\s*=\s*String\(target\.value \|\| ""\)\.slice\(0, 500\)/);
 assert.doesNotMatch(handler,/target\.value\s*=/);
 assert.doesNotMatch(handler,/setSelectionRange/);
});
test("waiter payload retains each item note and normalizes only when submitting",()=>{
 assert.match(source,/p_items:\s*waiterCart\.map\(\(item\)\s*=>/);
 assert.match(source,/note:\s*String\(item\.note \|\| ""\)\.trim\(\)\.toUpperCase\(\)/);
 assert.match(source,/data-action="note"/);
 assert.match(source,/\.slice\(0, 500\)/);
});
