# ADR 0001: Local STDIO and read-only operation

- Status: accepted
- Date: 2026-07-17

## Decision

The initial server runs locally over STDIO for one configured 1Factory organization and registers read-only tools only. Credentials stay in the process environment and are never accepted as MCP arguments.

## Consequences

This keeps the credential and tenant boundary small and avoids operating a remote authentication service. Teams that need shared or hosted access must design a separate authorization and tenant-isolation architecture rather than exposing this process directly.
