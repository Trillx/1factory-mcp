import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { SafeConfigurationSummary } from "./config.js";
import {
  OneFactoryApiError,
  type OneFactoryClient
} from "./onefactory-client.js";

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
  status: z.enum(["Active", "Inactive"]).optional()
};

const SERVER_NAME = "onefactory-mcp";
const SERVER_VERSION = "0.1.0";
const STATUS_URI = "onefactory://server/status";

export function createServer(
  client: OneFactoryClient,
  configuration: SafeConfigurationSummary
): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "This server is read-only. Prefer narrow filters and bounded pages. Never request or reveal 1Factory credentials."
    }
  );

  server.registerResource(
    "server_status",
    STATUS_URI,
    {
      title: "1Factory MCP server status",
      description:
        "Non-secret server configuration and version information. Reading this resource does not contact 1Factory.",
      mimeType: "application/json"
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
            writes_enabled: configuration.writesEnabled
          })
        }
      ]
    })
  );

  server.registerTool(
    "search_part_masters",
    {
      title: "Search 1Factory part masters",
      description:
        "Search part-master records in the configured 1Factory organization using bounded pagination.",
      inputSchema: searchPartMastersInput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false
      }
    },
    async ({ page, page_size, part_number, revision, status }) => {
      try {
        const result = await client.searchPartMasters({
          page,
          pageSize: page_size,
          ...(part_number === undefined ? {} : { partNumber: part_number }),
          ...(revision === undefined ? {} : { revision }),
          ...(status === undefined ? {} : { status })
        });

        const output = {
          count: result.data.length,
          page,
          page_size,
          records: result.data,
          rate_limit: result.rateLimit
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output) }],
          structuredContent: output
        };
      } catch (error) {
        const message =
          error instanceof OneFactoryApiError
            ? error.message
            : "Unexpected error while searching 1Factory part masters";
        return {
          content: [{ type: "text" as const, text: message }],
          isError: true
        };
      }
    }
  );

  return server;
}
