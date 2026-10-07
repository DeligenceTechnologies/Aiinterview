import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

// Sign-up needs the access code; tests read it from .env.local like the app does.
if (!process.env.SIGNUP_ACCESS_CODE && existsSync(".env.local")) {
  const m = readFileSync(".env.local", "utf8").match(/^SIGNUP_ACCESS_CODE=(.+)$/m);
  if (m) process.env.SIGNUP_ACCESS_CODE = m[1].trim();
}

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 240_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: {
      // Fake camera/microphone so the candidate flow runs headlessly.
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chromium", permissions: ["camera", "microphone"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
