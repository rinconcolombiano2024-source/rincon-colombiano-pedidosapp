import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function configureReleaseVersion(gradle, code, version) {
  if (!/^[1-9]\d*$/.test(String(code)) || Number(code) > 2100000000) {
    throw new Error('ANDROID_VERSION_CODE must be an integer from 1 to 2100000000');
  }
  if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) {
    throw new Error('Invalid package release version');
  }
  const codePattern = /^(\s*)versionCode\s+\d+\s*$/gm;
  const namePattern = /^(\s*)versionName\s+"[^"]*"\s*$/gm;
  if ([...gradle.matchAll(codePattern)].length !== 1 || [...gradle.matchAll(namePattern)].length !== 1) {
    throw new Error('Expected exactly one Android versionCode and versionName');
  }
  return gradle.replace(codePattern, `$1versionCode ${code}`)
    .replace(namePattern, `$1versionName "${version}"`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const file = resolve('android/app/build.gradle');
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const updated = configureReleaseVersion(readFileSync(file, 'utf8'), process.env.ANDROID_VERSION_CODE, version);
  writeFileSync(file, updated);
  console.log(`Android release version: ${version} (${process.env.ANDROID_VERSION_CODE})`);
}
