#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { ConfigurationError, loadConfig } from "./config.js";
import { OneFactoryClient } from "./onefactory-client.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new OneFactoryClient(config);
  const server = createServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message =
    error instanceof ConfigurationError
      ? error.message
      : "onefactory-mcp failed to start";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
