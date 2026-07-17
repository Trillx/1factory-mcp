# 1Factory MCP Server

An open-source Model Context Protocol (MCP) bridge for the [1Factory API](https://www.1factory.com/api-doc/index.html).

> [!IMPORTANT]
> This is an independent community project. It is not affiliated with, endorsed by, or supported by 1Factory. Confirm that your 1Factory agreement and your organization's policies permit API access through an MCP client before using this software.

## Project status

The `0.2.0-beta.1` line provides a security-focused, read-only preview for exposing selected 1Factory operations as MCP tools. It is:

- read-only by default;
- configured for one 1Factory organization at a time;
- run locally over MCP STDIO where practical;
- tested against the 1Factory sandbox before production use; and
- explicit about every operation that creates or changes data.

Do not describe the project as production-ready until its authentication, authorization, tenant isolation, logging, and write safeguards have been independently reviewed.

Repository guidance:

- [Implementation roadmap](docs/ROADMAP.md)
- [Data exposure reference](docs/DATA_EXPOSURE.md)
- [Threat model](docs/THREAT_MODEL.md)
- [Security policy](SECURITY.md)
- [Contribution guide](CONTRIBUTING.md)

## Development quickstart

The server provides ten read-only MCP tools over local STDIO. It validates upstream responses at runtime, strips fields that are not approved for model-visible results, defaults to the 1Factory sandbox, and refuses non-allowlisted API hosts.

The `onefactory://server/status` resource reports the server version, transport, timeout, write setting, and named API environment. It never returns credentials or the organization identifier, and reading it does not contact 1Factory.

Prerequisites:

- Node.js 20 or newer
- A 1Factory sandbox organization ID and API key

```bash
npm install
cp .env.example .env
npm run build
npm test
```

Load the environment variables through your local secret-management approach, then configure your MCP client to launch `node dist/index.js`. Do not place secrets directly in shared MCP configuration files.

For a pinned package tarball downloaded from a GitHub release, verify it with the release's `SHA256SUMS` file before installing. Release artifacts also include a CycloneDX SBOM.

## Read-only tools

| Tool                                 | Purpose                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| `search_part_masters`                | Search bounded part-master summaries                                            |
| `list_plans`, `get_plan`             | List or retrieve plans in manufacturing, receiving, supplier, or customer scope |
| `list_inspections`, `get_inspection` | List or retrieve inspections in an explicit scope                               |
| `list_fais`, `get_fai`               | List or retrieve first-article inspections in an explicit scope                 |
| `list_suppliers`, `get_supplier`     | List or retrieve minimized supplier records                                     |
| `list_qms_records`                   | List NCRs, CAPAs, or complaints selected by an explicit enum                    |

Every list request returns one page, with at most 100 records and a maximum 1,000-record pagination window. See the [data exposure reference](docs/DATA_EXPOSURE.md) for the field policy.

Optional organization-specific redaction is configured by field name:

```dotenv
ONEFACTORY_REDACT_FIELDS=root_cause,customer_name
```

## Fictional example prompts

- "List the first 20 manufacturing plans for fictional part `DEMO-100`, revision `A`."
- "Get receiving inspection ID `42` and summarize its status."
- "List open NCR summaries for the fictional demo organization, one page only."
- "Show supplier ID `7` and omit any field named `customer_name` under the configured policy."

Never copy production values into prompts, documentation, issues, or test fixtures.

## What the integration can expose

The public 1Factory API covers part masters, manufacturing and receiving plans, inspections, first-article inspections (FAIs), customers, suppliers, QMS records, and work-order lists. The published specification is available as [OpenAPI 3.0 JSON](https://www.1factory.com/api/v1/1factory-api.json).

A first release should concentrate on narrowly scoped tools such as:

- searching part masters;
- listing and retrieving plans;
- listing and retrieving inspections and FAIs;
- listing and retrieving supplier information; and
- listing NCRs, CAPAs, and complaints.

Write-capable tools should be a separate, opt-in feature added only after the read-only implementation has been tested and reviewed.

## Security model

### 1. Treat both 1Factory headers as secrets

Every API request requires:

- `x-1factory-org`: the 1Factory organization identifier; and
- `x-1factory-key`: the organization's API key.

Although the organization identifier may be less sensitive than the key, treat both as credentials because together they identify the target tenant.

Requirements:

- Never hard-code credentials in source code, images, fixtures, command-line examples, or container layers.
- Never accept the API key as an MCP tool argument. Tool arguments and results may be visible to the model, client, traces, or logs.
- Load credentials from environment variables or a supported secret manager.
- Never commit `.env` files. Provide an `.env.example` containing placeholders only.
- Redact authorization headers and secret values from errors, telemetry, traces, and debug output.
- Rotate the API key immediately if it is exposed, and remove the exposed value from Git history and build artifacts.
- Use separate credentials for development, testing, and production.

Recommended placeholder configuration:

```dotenv
ONEFACTORY_BASE_URL=https://www.1factory.co/api/v1
ONEFACTORY_ORG_ID=replace-with-org-id
ONEFACTORY_API_KEY=replace-with-api-key
ONEFACTORY_ENABLE_WRITES=false
```

The `.co` endpoint above is the sandbox listed in the 1Factory specification. Confirm the correct environment with your 1Factory administrator before testing.

### 2. Prefer the smallest deployment model

| Deployment                  | Recommended use                                | Minimum security requirements                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local STDIO                 | One user or one controlled workstation         | Environment-based secrets, local process permissions, read-only tools by default                                                                                                              |
| Private remote server       | One organization or a controlled internal team | HTTPS, authenticated MCP access, secret manager, network restrictions, centralized redacted audit logs                                                                                        |
| Public multi-tenant service | Multiple unrelated organizations               | Per-user authentication, encrypted per-tenant credentials, strict tenant isolation, authorization checks on every request, abuse controls, incident response, and independent security review |

Do not turn a single organization's API key into a shared public service credential. A hosted service must maintain a separate credential boundary for every 1Factory organization and must never select the tenant from an untrusted model-supplied value alone.

### 3. Authentication is not user authorization

The 1Factory API uses organization-level API-key authentication. Possession of that key does not prove that an individual MCP user is permitted to view or change every record available to the organization.

For any shared or hosted deployment:

- authenticate the MCP user independently;
- map the authenticated identity to an allowed 1Factory organization on the server;
- enforce tool and record-level permissions server-side;
- deny access by default when no policy matches;
- prevent callers from overriding organization IDs, base URLs, or credentials; and
- record who initiated write operations without logging sensitive payloads.

If these controls are not implemented, limit the server to a local, single-user deployment.

### 4. Keep write operations disabled by default

Some API operations have significant effects:

- `PUT /partMasters` creates a part master or overwrites the matching part number and revision.
- `PUT /partMasters/assemblies` replaces assembly relationships.
- `PUT /mfg/workOrderList` and `PUT /rec/workOrderList` replace the corresponding work-order lists.
- Inspection and FAI `POST` operations create production records.

Write tools should:

- require `ONEFACTORY_ENABLE_WRITES=true` or an equivalent explicit server policy;
- be separately allowlisted instead of enabled as a group;
- clearly describe their effect in tool metadata;
- validate inputs against the published OpenAPI schema;
- display a concise preview and request confirmation before execution;
- use idempotency or duplicate detection where the upstream API permits it;
- return enough information to verify the created or changed record; and
- never silently retry a non-idempotent request after an uncertain timeout.

Read operations must not automatically trigger follow-up writes.

### 5. Constrain all outbound requests

The MCP server should be an API adapter, not a general-purpose HTTP proxy.

- Allowlist the supported 1Factory base URLs.
- Reject arbitrary schemes, hosts, ports, redirects, and user-supplied base URLs.
- Require HTTPS outside explicitly isolated local development.
- Set connection and response timeouts.
- Limit response sizes and pagination depth.
- Validate content types before parsing responses.
- Do not return raw upstream headers when they might contain operational or security details.
- Treat all upstream strings as untrusted data when rendering UI or logs.

These controls reduce server-side request forgery (SSRF), accidental data exfiltration, and denial-of-service risk.

### 6. Respect rate limits

The 1Factory documentation currently lists default limits of 60 requests per minute and 1,000 requests per day. It also returns rate-limit headers. These values may change, so the implementation should follow the response headers rather than relying only on hard-coded limits.

The server should:

- use API-side filters instead of downloading entire datasets;
- enforce bounded pagination (`page_size` is documented with a maximum of 500);
- cache safe read-only results briefly where data freshness permits;
- avoid automatic page walking unless explicitly requested and bounded;
- surface a clear error when the upstream service returns HTTP 429; and
- avoid retry storms by honoring reset information and applying backoff.

Caching must be isolated by organization and must never mix results from different tenants.

### 7. Protect regulated and sensitive manufacturing data

1Factory states that its platform may host sensitive and regulated information, including ITAR-related data. Inspection measurements, drawings, specifications, supplier records, QMS records, user information, and part metadata may also be confidential even when they are not export-controlled.

Before enabling the integration, the deploying organization should determine:

- whether the records contain ITAR data, CUI, export-controlled technical data, personal data, or customer-confidential information;
- whether its contracts allow that data to be processed by the selected MCP client, model provider, hosting provider, logging platform, and observability tools;
- which regions and personnel may process or access the data;
- required retention and deletion periods; and
- whether legal, security, export-control, customer, or compliance approval is required.

Do not assume that 1Factory's own hosting controls automatically extend to the MCP server or to any downstream AI service. Each additional system creates a separate data-processing boundary.

Where regulated data cannot leave an approved boundary, do not expose it through a remotely hosted MCP server. Consider a local deployment with strict tool and field allowlists, or do not use the integration for that data.

### 8. Minimize model-visible data

Return only the fields required to answer the user's request.

- Prefer summaries and bounded result sets over full record dumps.
- Avoid returning user email addresses, comments, costs, or supplier details unless required.
- Make detailed measurement and specification retrieval a separate explicit tool.
- Do not place secrets, internal stack traces, or complete upstream requests in tool results.
- Add configurable field redaction for organization-specific sensitive fields.
- Keep MCP tool descriptions free of confidential examples copied from production.

### 9. Log safely

Useful audit events include tool name, authenticated actor, tenant identifier represented by a non-secret internal ID, timestamp, outcome, upstream status code, request correlation ID, and whether a write occurred.

Do not log:

- API keys or authorization headers;
- complete MCP arguments or API payloads by default;
- inspection measurements, specifications, comments, or attachments;
- personal data unless explicitly required and protected; or
- full upstream responses.

Provide configurable log retention, access controls, and deletion procedures. Security logging should be useful without becoming a second copy of the customer's quality system.

## Secure development requirements

Before publishing a release:

- pin dependencies and enable automated dependency vulnerability alerts;
- run secret scanning in local hooks and CI;
- run static analysis, linting, tests, and dependency audits in CI;
- generate an SBOM for release artifacts where practical;
- publish checksums or signed release artifacts;
- use least-privilege CI permissions and short-lived publishing credentials;
- prohibit pull requests from accessing production secrets;
- test that credentials are redacted from every error path;
- test cross-tenant isolation if multi-tenancy exists;
- fuzz or property-test tool inputs and pagination boundaries;
- test timeouts, HTTP 429 responses, malformed JSON, redirects, and partial failures; and
- conduct a focused security review before enabling writes or public hosting.

## Suggested safe defaults

An implementation should start with defaults similar to these:

- read-only tools enabled;
- all write tools disabled;
- STDIO transport enabled;
- remote listening disabled or bound to loopback;
- production base URL disabled until explicitly selected;
- base URL allowlisting enabled;
- maximum page size and total-record limits enforced;
- response caching disabled until tenant-safe caching is implemented;
- payload logging disabled;
- TLS verification enabled; and
- debug mode disabled in production.

Fail closed when configuration is missing or ambiguous. Do not fall back from sandbox to production or from an authenticated mode to an unauthenticated mode.

## Incident response

If a credential or sensitive record is exposed:

1. Stop the affected server or disable the relevant tools.
2. Revoke and rotate the 1Factory API key.
3. Preserve minimal, access-controlled evidence needed for investigation.
4. Determine which repositories, packages, logs, traces, caches, and model interactions received the data.
5. Remove exposed material from Git history and published artifacts; deleting only the latest commit is insufficient.
6. Follow organizational notification, contractual, legal, export-control, and breach-response requirements.
7. Document the root cause and add a regression test before restoring service.

## Reporting security vulnerabilities

Do not report vulnerabilities or suspected credential leaks in a public GitHub issue.

Use the repository's private GitHub Security Advisory feature. Maintainers should add a `SECURITY.md` file before the first public release with:

- supported versions;
- a private reporting channel;
- expected acknowledgement and remediation timelines;
- a coordinated-disclosure policy; and
- instructions for reporting vulnerabilities that affect the upstream 1Factory service rather than this project.

Issues involving 1Factory itself should be reported through [1Factory's support channels](https://1factoryhelp.zendesk.com/hc/en-us), not publicly disclosed through this repository.

## Limitations

- This server cannot grant permissions that the upstream 1Factory API does not expose.
- Organization-level API keys do not provide per-user upstream authorization.
- MCP client approval prompts are useful safeguards but are not a substitute for server-side authorization.
- OpenAPI schemas help validate structure but do not prove that an operation is safe or appropriate.
- API behavior, limits, schemas, environments, and terms may change; review the current [1Factory API documentation](https://www.1factory.com/api-doc/index.html) before each release.

## License and trademark notice

This project is licensed under the [MIT License](LICENSE). Ensure all dependencies and copied examples are compatible with it.

“1Factory” and related names and marks belong to their respective owners. Use the name only to identify interoperability with the service, and avoid logos or wording that suggests official sponsorship.
