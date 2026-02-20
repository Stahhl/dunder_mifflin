import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "../specs",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8081",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  }
});
