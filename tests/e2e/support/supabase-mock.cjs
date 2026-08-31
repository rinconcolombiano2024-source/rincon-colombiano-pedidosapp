function supabaseMockScript(options = {}) {
  const user = options.user || null;
  const rpcData = options.rpcData || {};
  const rpcDataByUser = options.rpcDataByUser || {};
  const rpcDelayByUser = options.rpcDelayByUser || {};
  const tableData = options.tableData || {};
  const payload = JSON.stringify({ user, rpcData, rpcDataByUser, rpcDelayByUser, tableData }).replaceAll("<", "\\u003c");

  return `
(() => {
  const config = ${payload};
  const result = (data = null, error = null) => Promise.resolve({ data, error });
  const tableValue = (table) => Object.prototype.hasOwnProperty.call(config.tableData, table)
    ? config.tableData[table]
    : null;
  const makeQuery = (table) => {
    const query = new Proxy({}, {
      get(_target, property) {
        if (property === "then") {
          const value = tableValue(table);
          const rows = Array.isArray(value) ? value : value ? [value] : [];
          return result(rows).then.bind(result(rows));
        }
        if (property === "single" || property === "maybeSingle") {
          return () => result(tableValue(table));
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
    getSession: async () => ({
      data: { session: config.user ? { user: config.user, access_token: "test-token" } : null },
      error: null,
    }),
    getUser: async () => ({ data: { user: config.user }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: { user: config.user }, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  };
  window.supabase = {
    createClient: () => ({
      auth,
      from: (table) => makeQuery(table),
      rpc: async (name, args = {}) => {
        const userId = String(args?.p_user_id || "");
        const delay = Number(config.rpcDelayByUser?.[name]?.[userId]) || 0;
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
        const valuesByUser = config.rpcDataByUser?.[name];
        const data = valuesByUser && Object.prototype.hasOwnProperty.call(valuesByUser, userId)
          ? valuesByUser[userId]
          : Object.prototype.hasOwnProperty.call(config.rpcData, name) ? config.rpcData[name] : null;
        return { data, error: null };
      },
      channel: () => channel,
      removeChannel: async () => ({ error: null }),
      functions: { invoke: async () => ({ data: null, error: null }) },
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "" } }),
        }),
      },
    }),
  };
})();`;
}

async function installSupabaseMock(page, options = {}) {
  const body = supabaseMockScript(options);
  await page.route("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4", (route) => route.fulfill({
    status: 200,
    contentType: "text/javascript",
    body,
  }));
  await page.route("**/*.supabase.co/**", (route) => route.abort());
}

module.exports = { installSupabaseMock };
