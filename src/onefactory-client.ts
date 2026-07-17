import type { OneFactoryConfig } from "./config.js";
import type { z } from "zod";
import {
  boundedList,
  faiDetailSchema,
  faiSchema,
  inspectionDetailSchema,
  inspectionSchema,
  partMasterSchema,
  planDetailSchema,
  planSchema,
  qmsRecordSchema,
  supplierSchema,
} from "./schemas.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_PAGE_SIZE = 100;
const MAX_RESULT_WINDOW = 1_000;

const partMasterListSchema = boundedList(partMasterSchema);

export type PartMaster = z.infer<typeof partMasterSchema>;

export interface SearchPartMastersOptions {
  page?: number;
  pageSize?: number;
  partNumber?: string;
  revision?: string;
  status?: "Active" | "Inactive";
}

export type RecordScope =
  "customer" | "manufacturing" | "receiving" | "supplier";
export type QmsRecordType = "capa" | "complaint" | "ncr";

export interface ListOptions {
  page?: number;
  pageSize?: number;
  partNumber?: string;
  revision?: string;
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
    minuteResetSeconds: optionalInteger(headers, "x-ratelimit-minute-reset"),
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
    upstreamCode,
  );
}

function paginationQuery(options: ListOptions): URLSearchParams {
  const page = options.page ?? 0;
  const pageSize = options.pageSize ?? 50;
  if (
    !Number.isInteger(page) ||
    page < 0 ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > MAX_PAGE_SIZE ||
    page * pageSize + pageSize > MAX_RESULT_WINDOW
  ) {
    throw new OneFactoryApiError(
      "Requested page exceeds the server pagination limits",
      400,
    );
  }
  const query = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });
  if (options.partNumber) query.set("part_number", options.partNumber);
  if (options.revision) query.set("rev", options.revision);
  return query;
}

function scopePrefix(scope: RecordScope): string {
  return {
    customer: "/cus",
    manufacturing: "/mfg",
    receiving: "/rec",
    supplier: "/sup",
  }[scope];
}

function redactFields(value: unknown, fields: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactFields(entry, fields));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !fields.has(key))
        .map(([key, entry]) => [key, redactFields(entry, fields)]),
    );
  }
  return value;
}

export class OneFactoryClient {
  constructor(
    private readonly config: OneFactoryConfig,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async searchPartMasters(
    options: SearchPartMastersOptions,
  ): Promise<OneFactoryResponse<PartMaster[]>> {
    const query = paginationQuery(options);

    if (options.partNumber) query.set("part_number", options.partNumber);
    if (options.revision) query.set("rev", options.revision);
    if (options.status) query.set("status", options.status);

    return this.getJson(
      `/partMasters?${query.toString()}`,
      partMasterListSchema,
    );
  }

  async listPlans(scope: RecordScope, options: ListOptions) {
    return this.getJson(
      `${scopePrefix(scope)}/plans?${paginationQuery(options).toString()}`,
      boundedList(planSchema),
    );
  }

  async getPlan(scope: RecordScope, id: number) {
    return this.getJson(`${scopePrefix(scope)}/plans/${id}`, planDetailSchema);
  }

  async listInspections(scope: RecordScope, options: ListOptions) {
    return this.getJson(
      `${scopePrefix(scope)}/inspections?${paginationQuery(options).toString()}`,
      boundedList(inspectionSchema),
    );
  }

  async getInspection(scope: RecordScope, id: number) {
    return this.getJson(
      `${scopePrefix(scope)}/inspections/${id}`,
      inspectionDetailSchema,
    );
  }

  async listFais(scope: RecordScope, options: ListOptions) {
    return this.getJson(
      `${scopePrefix(scope)}/fais?${paginationQuery(options).toString()}`,
      boundedList(faiSchema),
    );
  }

  async getFai(scope: RecordScope, id: number) {
    return this.getJson(`${scopePrefix(scope)}/fais/${id}`, faiDetailSchema);
  }

  async listSuppliers(options: ListOptions) {
    return this.getJson(
      `/sup?${paginationQuery(options).toString()}`,
      boundedList(supplierSchema),
    );
  }

  async getSupplier(id: number) {
    return this.getJson(`/sup/${id}`, supplierSchema);
  }

  async listQmsRecords(type: QmsRecordType, options: ListOptions) {
    const path = { capa: "capas", complaint: "complaints", ncr: "ncrs" }[type];
    return this.getJson(
      `/qms/${path}?${paginationQuery(options).toString()}`,
      boundedList(qmsRecordSchema),
    );
  }

  private async getJson<TSchema extends z.ZodType>(
    pathAndQuery: string,
    schema: TSchema,
  ): Promise<OneFactoryResponse<z.output<TSchema>>> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.config.requestTimeoutMs,
    );

    try {
      const response = await this.fetchImplementation(
        `${this.config.baseUrl}${pathAndQuery}`,
        {
          headers: {
            Accept: "application/json",
            "x-1factory-key": this.config.apiKey,
            "x-1factory-org": this.config.organizationId,
          },
          method: "GET",
          redirect: "error",
          signal: controller.signal,
        },
      );

      const body = await readBoundedBody(response);
      if (!response.ok) {
        throw safeUpstreamError(response.status, body);
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        throw new OneFactoryApiError(
          "1Factory returned an unexpected content type",
          502,
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
          502,
        );
      }

      return {
        data: redactFields(
          validated.data,
          this.config.redactedFields,
        ) as z.output<TSchema>,
        rateLimit: rateLimitFrom(response.headers),
      };
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
