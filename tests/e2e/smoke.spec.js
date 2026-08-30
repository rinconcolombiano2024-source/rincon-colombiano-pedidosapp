const { test, expect } = require("@playwright/test");

const supabaseMock = `
(() => {
  const result = (data = []) => Promise.resolve({ data, error: null });
  const makeQuery = () => {
    const query = new Proxy({}, {
      get(_target, property) {
        if (property === "then") return result().then.bind(result());
        if (property === "single" || property === "maybeSingle") {
          return () => result(null);
        }
        return () => query;
      }
    });
    return query;
  };
  const channel = {
    on() { return this; },
    subscribe() { return this; },
    unsubscribe() {},
  };
  const auth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  };
  window.supabase = {
    createClient: () => ({
      auth,
      from: () => makeQuery(),
      rpc: async () => ({ data: null, error: null }),
      channel: () => channel,
      removeChannel() {},
      functions: { invoke: async () => ({ data: null, error: null }) },
      storage: { from: () => ({ upload: async () => ({ data: null, error: null }) }) },
    }),
  };
})();`;

const screens = [
  { name: "principal", path: "/index.html?app=v91.0.3", selector: ".app-shell" },
  { name: "cliente", path: "/cliente.html?app=v91.0.3&lang=es", selector: ".customer-app-shell" },
  { name: "colaborador", path: "/colaborador.html?app=v91.0.3&lang=es", selector: ".collaborator-app-shell" },
  { name: "mesero", path: "/mesero.html?app=v91.0.3&lang=es", selector: ".waiter-shell" },
  { name: "administracion", path: "/admin.html?app=v91.0.3&lang=es", selector: ".platform-admin-shell" },
];

test.beforeEach(async ({ page }) => {
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body: supabaseMock,
  }));
  await page.route("**/*.supabase.co/**", (route) => route.abort());
});

for (const screen of screens) {
  test(`${screen.name}: inicia sin errores fatales`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const response = await page.goto(screen.path, { waitUntil: "domcontentloaded" });
    expect(response?.ok()).toBeTruthy();
    await expect(page.locator(screen.selector)).toHaveCount(1);
    await page.waitForTimeout(400);

    const duplicateIds = await page.evaluate(() => {
      const counts = new Map();
      document.querySelectorAll("[id]").forEach((element) => {
        counts.set(element.id, (counts.get(element.id) || 0) + 1);
      });
      return [...counts.entries()].filter(([, count]) => count > 1);
    });
    expect(duplicateIds).toEqual([]);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    expect(pageErrors).toEqual([]);
  });
}
