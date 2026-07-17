import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SafeConfigurationSummary } from "./config.js";
import {
  OneFactoryApiError,
  type OneFactoryClient,
  type RecordScope,
} from "./onefactory-client.js";

const pageInput = {
  page: z.number().int().min(0).max(9).default(0),
  page_size: z.number().int().min(1).max(100).default(50),
};

const scopeInput = z.enum([
  "manufacturing",
  "receiving",
  "supplier",
  "customer",
]);

const scopedListInput = {
  ...pageInput,
  scope: scopeInput,
  part_number: z.string().trim().min(1).max(255).optional(),
  revision: z.string().trim().max(255).optional(),
};

const scopedGetInput = {
  scope: scopeInput,
  id: z.number().int().positive(),
};

const searchPartMastersInput = {
  page: z.number().int().min(0).default(0).describe("Zero-based result page"),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Number of records to return; limited to 100 by this server"),
  part_number: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .optional()
    .describe("Exact or API-supported part-number filter"),
  revision: z.string().trim().max(255).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
};

const SERVER_NAME = "1factory-mcp";
const SERVER_VERSION = "0.2.0-beta.1";
const STATUS_URI = "onefactory://server/status";

function errorResult(error: unknown, operation: string) {
  const message =
    error instanceof OneFactoryApiError
      ? error.message
      : `Unexpected error while ${operation}`;
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

function dataResult(
  data: unknown,
  rateLimit: unknown,
  pagination?: { page: number; pageSize: number },
) {
  const output: Record<string, unknown> = {
    ...(pagination === undefined
      ? {}
      : { page: pagination.page, page_size: pagination.pageSize }),
    ...(Array.isArray(data)
      ? { count: data.length, records: data }
      : { record: data }),
    rate_limit: rateLimit,
  };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(output) }],
    structuredContent: output,
  };
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createServer(
  client: OneFactoryClient,
  configuration: SafeConfigurationSummary,
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "This server is read-only. Prefer narrow filters and bounded pages. Never request or reveal 1Factory credentials.",
    },
  );

  server.registerResource(
    "server_status",
    STATUS_URI,
    {
      title: "1Factory MCP server status",
      description:
        "Non-secret server configuration and version information. Reading this resource does not contact 1Factory.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({
            api_environment: configuration.apiEnvironment,
            name: SERVER_NAME,
            request_timeout_ms: configuration.requestTimeoutMs,
            transport: "stdio",
            upstream_checked: false,
            version: SERVER_VERSION,
            writes_enabled: configuration.writesEnabled,
          }),
        },
      ],
    }),
  );

  server.registerTool(
    "search_part_masters",
    {
      title: "Search 1Factory part masters",
      description:
        "Search part-master records in the configured 1Factory organization using bounded pagination.",
      inputSchema: searchPartMastersInput,
      annotations: {
        ...readOnlyAnnotations,
      },
    },
    async ({ page, page_size, part_number, revision, status }) => {
      try {
        const result = await client.searchPartMasters({
          page,
          pageSize: page_size,
          ...(part_number === undefined ? {} : { partNumber: part_number }),
          ...(revision === undefined ? {} : { revision }),
          ...(status === undefined ? {} : { status }),
        });

        const output = {
          count: result.data.length,
          page,
          page_size,
          records: result.data,
          rate_limit: result.rateLimit,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output) }],
          structuredContent: output,
        };
      } catch (error) {
        const message =
          error instanceof OneFactoryApiError
            ? error.message
            : "Unexpected error while searching 1Factory part masters";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_plans",
    {
      title: "List 1Factory plans",
      description: "List bounded plan summaries from one explicit API scope.",
      inputSchema: scopedListInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, page, page_size, part_number, revision }) => {
      try {
        const result = await client.listPlans(scope as RecordScope, {
          page,
          pageSize: page_size,
          ...(part_number === undefined ? {} : { partNumber: part_number }),
          ...(revision === undefined ? {} : { revision }),
        });
        return dataResult(result.data, result.rateLimit, {
          page,
          pageSize: page_size,
        });
      } catch (error) {
        return errorResult(error, "listing 1Factory plans");
      }
    },
  );

  server.registerTool(
    "get_plan",
    {
      title: "Get a 1Factory plan",
      description:
        "Get an allowlisted plan detail record by numeric ID and API scope.",
      inputSchema: scopedGetInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, id }) => {
      try {
        const result = await client.getPlan(scope as RecordScope, id);
        return dataResult(result.data, result.rateLimit);
      } catch (error) {
        return errorResult(error, "getting a 1Factory plan");
      }
    },
  );

  server.registerTool(
    "list_inspections",
    {
      title: "List 1Factory inspections",
      description:
        "List bounded inspection summaries from one explicit API scope.",
      inputSchema: scopedListInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, page, page_size, part_number, revision }) => {
      try {
        const result = await client.listInspections(scope as RecordScope, {
          page,
          pageSize: page_size,
          ...(part_number === undefined ? {} : { partNumber: part_number }),
          ...(revision === undefined ? {} : { revision }),
        });
        return dataResult(result.data, result.rateLimit, {
          page,
          pageSize: page_size,
        });
      } catch (error) {
        return errorResult(error, "listing 1Factory inspections");
      }
    },
  );

  server.registerTool(
    "get_inspection",
    {
      title: "Get a 1Factory inspection",
      description:
        "Get allowlisted inspection details by numeric ID and API scope.",
      inputSchema: scopedGetInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, id }) => {
      try {
        const result = await client.getInspection(scope as RecordScope, id);
        return dataResult(result.data, result.rateLimit);
      } catch (error) {
        return errorResult(error, "getting a 1Factory inspection");
      }
    },
  );

  server.registerTool(
    "list_fais",
    {
      title: "List 1Factory FAIs",
      description:
        "List bounded first-article inspection summaries from one API scope.",
      inputSchema: scopedListInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, page, page_size, part_number, revision }) => {
      try {
        const result = await client.listFais(scope as RecordScope, {
          page,
          pageSize: page_size,
          ...(part_number === undefined ? {} : { partNumber: part_number }),
          ...(revision === undefined ? {} : { revision }),
        });
        return dataResult(result.data, result.rateLimit, {
          page,
          pageSize: page_size,
        });
      } catch (error) {
        return errorResult(error, "listing 1Factory FAIs");
      }
    },
  );

  server.registerTool(
    "get_fai",
    {
      title: "Get a 1Factory FAI",
      description:
        "Get allowlisted first-article inspection details by ID and API scope.",
      inputSchema: scopedGetInput,
      annotations: readOnlyAnnotations,
    },
    async ({ scope, id }) => {
      try {
        const result = await client.getFai(scope as RecordScope, id);
        return dataResult(result.data, result.rateLimit);
      } catch (error) {
        return errorResult(error, "getting a 1Factory FAI");
      }
    },
  );

  server.registerTool(
    "list_suppliers",
    {
      title: "List 1Factory suppliers",
      description:
        "List bounded supplier summaries without contacts or addresses.",
      inputSchema: pageInput,
      annotations: readOnlyAnnotations,
    },
    async ({ page, page_size }) => {
      try {
        const result = await client.listSuppliers({
          page,
          pageSize: page_size,
        });
        return dataResult(result.data, result.rateLimit, {
          page,
          pageSize: page_size,
        });
      } catch (error) {
        return errorResult(error, "listing 1Factory suppliers");
      }
    },
  );

  server.registerTool(
    "get_supplier",
    {
      title: "Get a 1Factory supplier",
      description:
        "Get an allowlisted supplier record without contacts or addresses.",
      inputSchema: { id: z.number().int().positive() },
      annotations: readOnlyAnnotations,
    },
    async ({ id }) => {
      try {
        const result = await client.getSupplier(id);
        return dataResult(result.data, result.rateLimit);
      } catch (error) {
        return errorResult(error, "getting a 1Factory supplier");
      }
    },
  );

  server.registerTool(
    "list_qms_records",
    {
      title: "List 1Factory QMS records",
      description:
        "List bounded NCR, CAPA, or complaint summaries using an explicit type.",
      inputSchema: {
        ...pageInput,
        record_type: z.enum(["ncr", "capa", "complaint"]),
      },
      annotations: readOnlyAnnotations,
    },
    async ({ record_type, page, page_size }) => {
      try {
        const result = await client.listQmsRecords(record_type, {
          page,
          pageSize: page_size,
        });
        return dataResult(result.data, result.rateLimit, {
          page,
          pageSize: page_size,
        });
      } catch (error) {
        return errorResult(error, "listing 1Factory QMS records");
      }
    },
  );

  return server;
}
