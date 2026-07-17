import { describe, expect, it } from "vitest";

import {
  ConfigurationError,
  loadConfig,
  safeConfigurationSummary
} from "../src/config.js";

const validEnvironment = {
  ONEFACTORY_API_KEY: "test-key",
  ONEFACTORY_BASE_URL: "https://www.1factory.co/api/v1",
  ONEFACTORY_ORG_ID: "test-org"
};

describe("loadConfig", () => {
  it("defaults to the sandbox and disables writes", () => {
    const config = loadConfig({
      ONEFACTORY_API_KEY: "test-key",
      ONEFACTORY_ORG_ID: "test-org"
    });

    expect(config.baseUrl).toBe("https://www.1factory.co/api/v1");
    expect(config.enableWrites).toBe(false);
  });

  it("rejects a non-1Factory base URL", () => {
    expect(() =>
      loadConfig({
        ...validEnvironment,
        ONEFACTORY_BASE_URL: "https://example.com/api/v1"
      })
    ).toThrow(ConfigurationError);
  });

  it("rejects credentials embedded in the base URL", () => {
    expect(() =>
      loadConfig({
        ...validEnvironment,
        ONEFACTORY_BASE_URL:
          "https://username:password@www.1factory.co/api/v1"
      })
    ).toThrow(ConfigurationError);
  });

  it("requires both upstream credential values", () => {
    expect(() => loadConfig({})).toThrow("ONEFACTORY_API_KEY is required");
  });

  it("produces a summary without credentials or organization identifiers", () => {
    const config = loadConfig(validEnvironment);
    const summary = safeConfigurationSummary(config);

    expect(summary).toEqual({
      apiEnvironment: "sandbox",
      requestTimeoutMs: 15_000,
      writesEnabled: false
    });
    expect(JSON.stringify(summary)).not.toContain("test-key");
    expect(JSON.stringify(summary)).not.toContain("test-org");
  });
});
