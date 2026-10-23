import test from 'node:test';
import assert from 'node:assert/strict';
import { configureReleaseVersion } from '../../scripts/android-release-version.mjs';

const template = 'android {\n    defaultConfig {\n        applicationId "com.rcordera.app"\n        versionCode 1\n        versionName "1.0"\n    }\n}\n';
test('release version changes only native version metadata and can be incremented', () => {
  const first = configureReleaseVersion(template, '2', '91.0.4');
  assert.equal(first, template.replace('versionCode 1', 'versionCode 2').replace('"1.0"', '"91.0.4"'));
  assert.equal(configureReleaseVersion(first, '3', '91.0.5'), template.replace('versionCode 1', 'versionCode 3').replace('"1.0"', '"91.0.5"'));
});
test('reject invalid Play version codes and script injection', () => {
  for (const code of [undefined, '', '0', '-1', '1.5', '1e3', '01', '2100000001', '2\nexec']) {
    assert.throws(() => configureReleaseVersion(template, code, '91.0.4'));
  }
  assert.match(configureReleaseVersion(template, '2100000000', '91.0.4'), /versionCode 2100000000/);
  assert.throws(() => configureReleaseVersion(template, '2', '91.0.4"; exec'));
});
test('reject unknown or duplicate native metadata without silently creating a bad release', () => {
  assert.throws(() => configureReleaseVersion(template.replace('versionCode 1', 'versionCode compute()'), '2', '91.0.4'));
  assert.throws(() => configureReleaseVersion(template + '\nversionName "other"\n', '2', '91.0.4'));
});
