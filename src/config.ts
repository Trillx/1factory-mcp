const ALLOWED_BASE_URLS = new Set([
  "https://www.1factory.co/api/v1",
  "https://www.1factory.com/api/v1",
  "https://val.1factory.co/api/v1",
  "https://val.1factory.com/api/v1"
]);

export interface OneFactoryConfig {
  apiKey: string;
  baseUrl: string;
  enableWrites: boolean;
  organizationId: string;
  requestTimeoutMs: number;
}

export interface SafeConfigurationSummary {
  apiEnvironment:
    | "sandbox"
    | "production"
    | "validated-sandbox"
    | "validated-production";
  requestTimeoutMs: number;
  writesEnabled: boolean;
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function required(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();
  if (!value) {
    throw new ConfigurationError(`${name} is required`);
  }
  return value;
}

function parseBoolean(value: string | undefined, name: string): boolean {
  if (value === undefined || value.trim() === "") {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new ConfigurationError(`${name} must be either true or false`);
}

function parseTimeout(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return 15_000;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > 60_000) {
    throw new ConfigurationError(
      "ONEFACTORY_REQUEST_TIMEOUT_MS must be an integer from 1000 to 60000"
    );
  }
  return parsed;
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConfigurationError("ONEFACTORY_BASE_URL must be a valid URL");
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new ConfigurationError(
      "ONEFACTORY_BASE_URL cannot contain credentials, a query, or a fragment"
    );
  }

  const normalized = url.toString().replace(/\/$/, "");
  if (!ALLOWED_BASE_URLS.has(normalized)) {
    throw new ConfigurationError(
      "ONEFACTORY_BASE_URL must be an allowlisted 1Factory API endpoint"
    );
  }
  return normalized;
}

export function loadConfig(
  environment: NodeJS.ProcessEnv = process.env
): OneFactoryConfig {
  return {
    apiKey: required(environment, "ONEFACTORY_API_KEY"),
    baseUrl: normalizeBaseUrl(
      environment.ONEFACTORY_BASE_URL ?? "https://www.1factory.co/api/v1"
    ),
    enableWrites: parseBoolean(
      environment.ONEFACTORY_ENABLE_WRITES,
      "ONEFACTORY_ENABLE_WRITES"
    ),
    organizationId: required(environment, "ONEFACTORY_ORG_ID"),
    requestTimeoutMs: parseTimeout(environment.ONEFACTORY_REQUEST_TIMEOUT_MS)
  };
}

export function safeConfigurationSummary(
  config: OneFactoryConfig
): SafeConfigurationSummary {
  const environments: Record<
    string,
    SafeConfigurationSummary["apiEnvironment"]
  > = {
    "https://www.1factory.co/api/v1": "sandbox",
    "https://www.1factory.com/api/v1": "production",
    "https://val.1factory.co/api/v1": "validated-sandbox",
    "https://val.1factory.com/api/v1": "validated-production"
  };
  const apiEnvironment = environments[config.baseUrl];
  if (apiEnvironment === undefined) {
    throw new ConfigurationError("Cannot summarize an unapproved API endpoint");
  }

  return {
    apiEnvironment,
    requestTimeoutMs: config.requestTimeoutMs,
    writesEnabled: config.enableWrites
  };
}
