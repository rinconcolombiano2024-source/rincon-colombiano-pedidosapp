const { test, expect } = require('@playwright/test');
const { installSupabaseMock } = require('./support/supabase-mock.cjs');

test.beforeEach(async ({ page }) => {
  await installSupabaseMock(page);
  await page.goto('/restaurante.html', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof saveSettingsWhenPossible === 'function');
  await page.evaluate(() => {
    cloudState.configured = true;
    cloudState.user = { id: '00000000-0000-4000-8000-000000000012' };
    businessLogoUrl = '';
    businessName = 'First restaurant';
    localStoreCurrentSettings();
    markSettingsPending();
    const originalRpc = cloudState.client.rpc.bind(cloudState.client);
    cloudState.client.rpc = (name, args) => {
      if (name !== 'save_current_restaurant_settings') return originalRpc(name, args);
      window.settingsRequest = args;
      return new Promise(resolve => { window.finishSettingsRequest = resolve; });
    };
    window.settingsSave = saveSettingsWhenPossible({ silent: true });
  });
  await page.waitForFunction(() => typeof window.finishSettingsRequest === 'function');
});

test('late settings confirmation preserves the newer local draft and next-save revision', async ({ page }) => {
  const result = await page.evaluate(async () => {
    businessName = 'Newer restaurant name';
    localStoreCurrentSettings();
    const token = markSettingsPending();
    window.finishSettingsRequest({ error: null, data: {
      settings: window.settingsRequest.p_settings, profile: {}, settingsRevision: 7,
    } });
    const outcome = await window.settingsSave;
    return { pending: outcome.pending, name: businessName,
      stored: localStorage.getItem(STORAGE_KEYS.businessName),
      tokenUnchanged: currentSettingsPendingToken() === token,
      revision: storedCloudRevision(STORAGE_KEYS.settingsRevision) };
  });
  expect(result).toEqual({ pending: true, name: 'Newer restaurant name',
    stored: 'Newer restaurant name', tokenUnchanged: true, revision: 7 });
});

for (const replaceClient of [false, true]) {
  test(`late settings response cannot alter a new restaurant (${replaceClient ? 'new' : 'same'} client)`, async ({ page }) => {
    const result = await page.evaluate(async replaceClient => {
      cloudState.user = { id: '00000000-0000-4000-8000-000000000013' };
      if (replaceClient) cloudState.client = { ...cloudState.client };
      businessName = 'Second restaurant';
      localStoreCurrentSettings();
      storeCloudRevision(STORAGE_KEYS.settingsRevision, 23);
      storeConfirmedCloudSettings({ businessName: 'Second restaurant' });
      const token = markSettingsPending();
      window.finishSettingsRequest({ error: null, data: {
        settings: window.settingsRequest.p_settings, profile: {}, settingsRevision: 99,
      } });
      const outcome = await window.settingsSave;
      return { code: outcome.error?.code, pending: outcome.pending,
        name: businessName, stored: localStorage.getItem(STORAGE_KEYS.businessName),
        tokenUnchanged: token === currentSettingsPendingToken(),
        revision: storedCloudRevision(STORAGE_KEYS.settingsRevision),
        confirmed: readConfirmedCloudSettings()?.businessName };
    }, replaceClient);
    expect(result).toEqual({ code: 'SETTINGS_SESSION_CHANGED', pending: false,
      name: 'Second restaurant', stored: 'Second restaurant', tokenUnchanged: true,
      revision: 23, confirmed: 'Second restaurant' });
  });
}
