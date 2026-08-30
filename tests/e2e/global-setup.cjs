const { startStaticServer } = require("../../scripts/serve-static.cjs");

module.exports = async () => {
  const server = await startStaticServer(8765);

  return async () => {
    server.closeAllConnections?.();
    await new Promise((resolve) => server.close(resolve));
  };
};
