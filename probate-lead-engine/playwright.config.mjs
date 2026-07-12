import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./apps/artifact/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["line"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  webServer: {
    command: "AUTH_REQUIRED=false HEIRRIGHT_LOCAL_BACKEND_ONLY=true pnpm --filter @ple/artifact dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 30_000
  }
});
