import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  OneFactoryConfig,
  SafeConfigurationSummary
} from "../src/config.js";
import { OneFactoryClient } from "../src/onefactory-client.js";
import { createServer } from "../src/server.js";

const config: OneFactoryConfig = {
  apiKey: "integration-secret-key",
  baseUrl: "https://www.1factory.co/api/v1",
  enableWrites: false,
  organizationId: "integration-secret-org",
  requestTimeoutMs: 5_000
};

const summary: SafeConfigurationSummary = {
  apiEnvironment: "sandbox",
  requestTimeoutMs: 5_000,
  writesEnabled: false
};

const connectedClients: Client[] = [];

afterEach(async () => {
  await Promise.all(connectedClients.splice(0).map(async (client) => client.close()));
});

async function connectTestClient(fetchImplementation: typeof fetch) {
  const oneFactoryClient = new OneFactoryClient(config, fetchImplementation);
  const server = createServer(oneFactoryClient, summary);
  const client = new Client({ name: "onefactory-mcp-test", version: "1.0.0" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connectedClients.push(client);

  return { client, server };
}

describe("MCP server integration", () => {
  it("lists and invokes the bounded read-only part-master tool", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify([{ part_number: "P-200", rev: "B" }]), {
        headers: { "content-type": "application/json" },
        status: 200
      })
    );
    const { client, server } = await connectTestClient(fetchMock);

    try {
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(1);
      expect(tools.tools[0]).toMatchObject({
        name: "search_part_masters",
        annotations: {
          destructiveHint: false,
          readOnlyHint: true
        }
      });

      const result = await client.callTool({
        name: "search_part_masters",
        arguments: { page: 0, page_size: 10, part_number: "P-200" }
      });

      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toMatchObject({
        count: 1,
        page: 0,
        page_size: 10,
        records: [{ part_number: "P-200", rev: "B" }]
      });
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      await server.close();
    }
  });

  it("exposes status without contacting upstream or revealing credentials", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const { client, server } = await connectTestClient(fetchMock);

    try {
      const resources = await client.listResources();
      expect(resources.resources).toEqual([
        expect.objectContaining({ uri: "onefactory://server/status" })
      ]);

      const result = await client.readResource({
        uri: "onefactory://server/status"
      });
      const resource = result.contents[0];
      expect(resource).toBeDefined();
      expect(resource).toHaveProperty("text");
      const status = JSON.parse(
        resource && "text" in resource ? resource.text : "{}"
      ) as Record<string, unknown>;
      const serialized = JSON.stringify(status);

      expect(status).toMatchObject({
        api_environment: "sandbox",
        name: "onefactory-mcp",
        upstream_checked: false,
        writes_enabled: false
      });
      expect(serialized).not.toContain("integration-secret-key");
      expect(serialized).not.toContain("integration-secret-org");
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      await server.close();
    }
  });
});
