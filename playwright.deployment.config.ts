import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const origin = "http://127.0.0.1:4174";
const configuredDeploymentURL = process.env.DEPLOYMENT_BASE_URL?.trim();
const deploymentURL = configuredDeploymentURL
  ? configuredDeploymentURL.endsWith("/") ? configuredDeploymentURL : `${configuredDeploymentURL}/`
  : `${origin}/`;

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: deploymentURL,
  },
  webServer: configuredDeploymentURL ? undefined : {
    command: "pnpm preview --host 127.0.0.1 --port 4174",
    url: `${origin}/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
