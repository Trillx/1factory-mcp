import type { OneFactoryConfig } from "./config.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface PartMaster {
  ID?: number;
  description?: string | null;
  is_assembly?: boolean;
  is_buy?: boolean;
  is_itar?: boolean;
  part_number: string;
  rev?: string | null;
  status?: "Active" | "Inactive";
  updated_on?: string;
  [key: string]: unknown;
}

export interface SearchPartMastersOptions {
  page?: number;
  pageSize?: number;
  partNumber?: string;
  revision?: string;
  status?: "Active" | "Inactive";
}

export interface RateLimitSnapshot {
  dayLimit: number | undefined;
  dayRemaining: number | undefined;
  dayResetSeconds: number | undefined;
  minuteLimit: number | undefined;
  minuteRemaining: number | undefined;
  minuteResetSeconds: number | undefined;
}

export interface OneFactoryResponse<T> {
  data: T;
  rateLimit: RateLimitSnapshot;
}

export class OneFactoryApiError extends Error {
  readonly status: number;
  readonly upstreamCode: string | undefined;

  constructor(message: string, status: number, upstreamCode?: string) {
    super(message);
    this.name = "OneFactoryApiError";
    this.status = status;
    this.upstreamCode = upstreamCode;
  }
}

function optionalInteger(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function rateLimitFrom(headers: Headers): RateLimitSnapshot {
  return {
    dayLimit: optionalInteger(headers, "x-ratelimit-day-limit"),
    dayRemaining: optionalInteger(headers, "x-ratelimit-day-remaining"),
    dayResetSeconds: optionalInteger(headers, "x-ratelimit-day-reset"),
    minuteLimit: optionalInteger(headers, "x-ratelimit-minute-limit"),
    minuteRemaining: optionalInteger(headers, "x-ratelimit-minute-remaining"),
    minuteResetSeconds: optionalInteger(headers, "x-ratelimit-minute-reset")
  };
}

async function readBoundedBody(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new OneFactoryApiError("1Factory response was too large", 502);
  }

  const body = await response.arrayBuffer();
  if (body.byteLength > MAX_RESPONSE_BYTES) {
    throw new OneFactoryApiError("1Factory response was too large", 502);
  }
  return new TextDecoder().decode(body);
}

function safeUpstreamError(status: number, body: string): OneFactoryApiError {
  let upstreamCode: string | undefined;
  try {
    const parsed = JSON.parse(body) as { code?: unknown };
    if (typeof parsed.code === "string" && parsed.code.length <= 64) {
      upstreamCode = parsed.code;
    }
  } catch {
    // Do not reflect untrusted upstream bodies in MCP errors.
  }

  const suffix = upstreamCode ? ` (${upstreamCode})` : "";
  return new OneFactoryApiError(
    `1Factory request failed with HTTP ${status}${suffix}`,
    status,
    upstreamCode
  );
}

export class OneFactoryClient {
  constructor(
    private readonly config: OneFactoryConfig,
    private readonly fetchImplementation: typeof fetch = fetch
  ) {}

  async searchPartMasters(
    options: SearchPartMastersOptions
  ): Promise<OneFactoryResponse<PartMaster[]>> {
    const query = new URLSearchParams();
    query.set("page", String(options.page ?? 0));
    query.set("page_size", String(options.pageSize ?? 50));

    if (options.partNumber) query.set("part_number", options.partNumber);
    if (options.revision) query.set("rev", options.revision);
    if (options.status) query.set("status", options.status);

    return this.getJson<PartMaster[]>(`/partMasters?${query.toString()}`);
  }

  private async getJson<T>(pathAndQuery: string): Promise<OneFactoryResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs
    );

    try {
      const response = await this.fetchImplementation(
        `${this.config.baseUrl}${pathAndQuery}`,
        {
          headers: {
            Accept: "application/json",
            "x-1factory-key": this.config.apiKey,
            "x-1factory-org": this.config.organizationId
          },
          method: "GET",
          redirect: "error",
          signal: controller.signal
        }
      );

      const body = await readBoundedBody(response);
      if (!response.ok) {
        throw safeUpstreamError(response.status, body);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new OneFactoryApiError(
          "1Factory returned an unexpected content type",
          502
        );
      }

      let data: T;
      try {
        data = JSON.parse(body) as T;
      } catch {
        throw new OneFactoryApiError("1Factory returned invalid JSON", 502);
      }

      return { data, rateLimit: rateLimitFrom(response.headers) };
    } catch (error) {
      if (error instanceof OneFactoryApiError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new OneFactoryApiError("1Factory request timed out", 504);
      }
      throw new OneFactoryApiError("Unable to reach 1Factory", 502);
    } finally {
      clearTimeout(timeout);
    }
  }
}
