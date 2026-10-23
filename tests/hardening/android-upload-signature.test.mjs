import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = readFileSync(new URL('../../.github/workflows/android-signed-play-manual.yml', import.meta.url), 'utf8');
const sign = workflow.split('\n').find(line => line.trim().startsWith('jarsigner -keystore')).trim();
const verify = workflow.split('\n').find(line => line.trim().startsWith('jarsigner -verify')).trim();
const available = ['java', 'keytool', 'jar', 'jarsigner'].every(command => spawnSync('which', [command]).status === 0);

for (const algorithm of ['RSA', 'EC']) {
  test(`actual upload workflow accepts ${algorithm} self-signed key and rejects wrong signer and tampering`, { skip: !available }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'ordera-signing-test-'));
    const env = { ...process.env, KEYSTORE_PASSWORD: 'temporary-test-only', KEY_PASSWORD: 'temporary-test-only', KEY_ALIAS: 'upload', keyfile: join(dir, 'test.p12'), signed: join(dir, 'test.aab') };
    const run = (command, args) => spawnSync(command, args, { env, encoding: 'utf8' });
    const ok = (result) => assert.equal(result.status, 0, result.stdout + result.stderr);
    try {
      for (const alias of ['upload', 'other']) {
        ok(run('keytool', ['-genkeypair', '-alias', alias, '-keystore', env.keyfile, '-storetype', 'PKCS12', '-storepass:env', 'KEYSTORE_PASSWORD', '-keypass:env', 'KEY_PASSWORD', '-keyalg', algorithm, '-validity', '365', '-dname', 'CN=Temporary test', '-noprompt']));
      }
      writeFileSync(join(dir, 'payload.txt'), 'original content');
      ok(run('jar', ['--create', '--file', env.signed, '-C', dir, 'payload.txt']));
      ok(run('bash', ['-c', sign]));
      ok(run('bash', ['-c', verify]));
      env.KEY_ALIAS = 'other';
      assert.notEqual(run('bash', ['-c', verify]).status, 0, 'Wrong upload identity accepted');
      env.KEY_ALIAS = 'upload';
      writeFileSync(join(dir, 'payload.txt'), 'tampered content');
      ok(run('jar', ['--update', '--file', env.signed, '-C', dir, 'payload.txt']));
      assert.notEqual(run('bash', ['-c', verify]).status, 0, 'Tampered bundle accepted');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}
