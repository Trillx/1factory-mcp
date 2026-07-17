# Threat Model

## Scope and assets

This model covers the local STDIO server, its MCP client connection, and outbound HTTPS requests to one allowlisted 1Factory organization. The protected assets are the API key, organization ID, quality and manufacturing records, and the integrity of released packages.

Public multi-tenant hosting, browser credential collection, write tools, persistent caching, and production telemetry are outside this model and remain unsupported.

## Trust boundaries

1. The local operator supplies credentials through the process environment.
2. The MCP client sends untrusted tool arguments over STDIO.
3. The server validates and translates those arguments into fixed 1Factory API routes.
4. The allowlisted 1Factory endpoint returns untrusted JSON.
5. CI creates public source and release artifacts without access to 1Factory secrets.

## Principal threats and controls

| Threat                     | Primary controls                                                                                                             | Residual risk                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Credential disclosure      | Credentials never appear in tool schemas; errors are normalized; payload logging is absent                                   | A compromised local process can read environment variables                        |
| SSRF or arbitrary proxying | Four exact HTTPS base URLs; fixed route construction; redirects rejected                                                     | DNS or upstream infrastructure compromise is outside this project                 |
| Cross-organization access  | Organization ID is server configuration, never a tool argument                                                               | The organization-level key may grant broader access than an individual user needs |
| Excessive data extraction  | Page size capped at 100; result window capped at 1,000; explicit scopes and record types                                     | Repeated calls can still accumulate data; client-side policy remains important    |
| Sensitive-field leakage    | Runtime schemas strip unknown fields; sensitive supplier/contact/attachment fields are omitted; optional recursive redaction | Approved fields may still contain confidential business data                      |
| Malicious upstream data    | Runtime validation, string limits, JSON/content-type checks, and a 2 MiB body cap                                            | Valid strings may contain misleading content for a model                          |
| Denial of service          | Timeouts, response-size limits, bounded arrays, and rate-limit surfacing                                                     | Upstream latency and repeated valid requests can still consume resources          |
| Supply-chain compromise    | Locked dependencies, immutable CI actions, audits, secret scanning, SBOMs, and checksums                                     | Checksums prove artifact integrity, not maintainer trust                          |
| Accidental writes          | No write tools are registered; write configuration remains false by default                                                  | A future write phase requires a separate review of this model                     |

## Security assumptions

- The workstation, MCP client, Node.js runtime, and environment-variable injection mechanism are trusted and patched.
- The operator has authorization to expose the selected records to the configured MCP client and model.
- TLS verification has not been disabled or intercepted by an untrusted party.
- 1Factory enforces the permissions associated with the configured organization credential.

## Review triggers

Review this model before adding a write tool, remote transport, caching, telemetry, attachment retrieval, user authentication, multiple organizations, or any new upstream host.
