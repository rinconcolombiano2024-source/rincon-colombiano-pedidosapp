const fs = require("node:fs");
const { defineConfig } = require("@playwright/test");

const windowsChrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const executablePath = process.env.CHROME_PATH
  || (process.platform === "win32" && fs.existsSync(windowsChrome) ? windowsChrome : undefined);

module.exports = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  ...(process.env.RC_E2E_FULL_MATRIX==="1" ? {projects:[
    {name:"mobile",use:{viewport:{width:390,height:844}}},
    {name:"tablet",use:{viewport:{width:1024,height:768}}},
    {name:"desktop",use:{viewport:{width:1440,height:900}}},
  ]} : {}),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  outputDir: "test-results",
  globalSetup: require.resolve("./tests/e2e/global-setup.cjs"),
  use: {
    baseURL: "http://127.0.0.1:8765",
    browserName: "chromium",
    headless: true,
    viewport: { width: 390, height: 844 },
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
});
