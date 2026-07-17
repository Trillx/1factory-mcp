import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

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

export function createServer(client: OneFactoryClient): McpServer {
  const server = new McpServer(
    { name: "onefactory-mcp", version: "0.1.0" },
    {
      instructions:
        "This server is read-only. Prefer narrow filters and bounded pages. Never request or reveal 1Factory credentials."
    }
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
