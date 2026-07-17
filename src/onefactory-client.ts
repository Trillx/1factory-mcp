import type { OneFactoryConfig } from "./config.js";
import { z } from "zod";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export const partMasterSchema = z
  .object({
    ID: z.number().int().optional(),
    description: z.string().max(255).nullable().optional(),
    is_assembly: z.boolean().optional(),
    is_buy: z.boolean().optional(),
    part_number: z.string().min(1).max(255),
    rev: z.string().max(255).nullable().optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
    updated_on: z.string().optional()
  });

const partMasterListSchema = z.array(partMasterSchema).max(500);

export type PartMaster = z.infer<typeof partMasterSchema>;

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

    return this.getJson(
      `/partMasters?${query.toString()}`,
      partMasterListSchema
    );
  }

  private async getJson<TSchema extends z.ZodType>(
    pathAndQuery: string,
    schema: TSchema
  ): Promise<OneFactoryResponse<z.output<TSchema>>> {
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

      let parsed: unknown;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        throw new OneFactoryApiError("1Factory returned invalid JSON", 502);
      }

      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        throw new OneFactoryApiError(
          "1Factory returned data that did not match the expected schema",
          502
        );
      }

      return { data: validated.data, rateLimit: rateLimitFrom(response.headers) };
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
