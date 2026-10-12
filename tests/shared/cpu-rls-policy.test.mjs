import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const sql = readFileSync(new URL("../../MIGRACION-V91-72-CPU-RLS-INITPLAN.sql", import.meta.url), "utf8");
test("RLS optimization requires exact policy preflight and preserves ownership checks", () => {
  assert.match(sql, /RC_ORDERA_RLS_POLICY_DRIFT/);
  assert.match(sql, /ok_count <> 5/);
  assert.equal((sql.match(/ALTER POLICY /g) || []).length, 5);
  assert.equal((sql.match(/\(SELECT auth\.uid\(\)\)/g) || []).length, 7);
  assert.match(sql, /WITH CHECK \(\(SELECT auth\.uid\(\)\) = user_id\)/);
  assert.doesNotMatch(sql, /\b(?:DROP POLICY|CREATE POLICY|GRANT|REVOKE|DELETE FROM|TRUNCATE|DISABLE ROW LEVEL SECURITY)\b/i);
});
