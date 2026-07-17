# Implementation Roadmap

This roadmap favors a small, auditable read-only server before broader API coverage or hosted deployment.

## Proposed technology

- TypeScript on a maintained Node.js LTS release
- Official Model Context Protocol TypeScript SDK
- Schema validation at the MCP boundary
- Native HTTP client with strict timeouts and redirect controls
- Unit tests with mocked 1Factory responses
- Sandbox integration tests that require explicit local credentials

Dependencies should be kept deliberately small. Do not add a database, remote telemetry service, web framework, or hosted authentication layer until a concrete requirement justifies it.

## Phase 0 — Repository foundation

Status: in progress

- [x] Create security-focused README.
- [x] Initialize the local Git repository.
- [x] Add `.gitignore` and safe environment-variable examples.
- [x] Add contribution and vulnerability-reporting policies.
- [x] Select and add an open-source license.
- [x] Create the public GitHub repository.
- [x] Enable GitHub private vulnerability reporting, secret scanning, push protection, and dependency alerts.
- [x] Add issue and pull-request templates.

Exit criteria: the repository is public, licensed, contains no credentials, and clearly states that it is unofficial and pre-release.

## Phase 1 — Minimal read-only MCP server

- [x] Scaffold TypeScript source, test, and build configuration.
- [x] Add typed configuration loading for base URL, organization ID, and API key.
- [x] Fail closed when configuration is missing, malformed, or points to an unapproved host.
- [x] Implement an HTTP client that injects credentials internally and redacts them from errors.
- [x] Implement upstream error normalization, timeouts, response-size limits, and rate-limit reporting.
- [x] Validate part-master response bodies and strip unapproved fields with a runtime schema.
- [x] Expose a health/version resource that never tests or reveals credentials.
- [x] Implement `search_part_masters` as the first end-to-end MCP tool.
- [x] Add unit tests proving upstream error content and secrets are not reflected to callers.
- [x] Add MCP protocol-level tests for tool discovery, tool calls, and status-resource reads.

Exit criteria: a local MCP client can search synthetic or sandbox part-master data over STDIO without exposing credentials.

## Phase 2 — Read-only quality workflows

- [ ] Add `list_plans` and `get_plan`.
- [ ] Add `list_inspections` and `get_inspection`.
- [ ] Add `list_fais` and `get_fai`.
- [ ] Add `list_suppliers` and `get_supplier`.
- [ ] Add `list_qms_records` with an explicit record-type enum for NCRs, CAPAs, and complaints.
- [ ] Enforce per-tool page-size and total-result limits.
- [ ] Add configurable field redaction and bounded response shaping.
- [ ] Document example prompts using fictional data only.

Exit criteria: all supported read tools have schema validation, pagination tests, error tests, and documented data exposure.

## Phase 3 — Packaging and release hardening

- [ ] Package the server for straightforward local STDIO installation.
- [ ] Add reproducible CI for formatting, linting, type checking, tests, dependency audit, and secret scanning.
- [ ] Generate an SBOM and attach checksums to releases.
- [ ] Add a threat model and architecture decision records.
- [ ] Test Windows, macOS, and Linux where supported.
- [ ] Publish a pre-release and request security-focused community review.

Exit criteria: users can verify and run a pinned release locally with documented safe defaults.

## Phase 4 — Optional write tools

Write tools are explicitly out of scope until the read-only server is stable.

- [ ] Define a server-side write policy and per-tool allowlist.
- [ ] Add preview and explicit confirmation behavior.
- [ ] Add duplicate and idempotency safeguards where possible.
- [ ] Add audit events without sensitive payload logging.
- [ ] Implement creation tools individually, beginning with the lowest-risk operation.
- [ ] Require a focused security review for every write tool.
- [ ] Keep list-replacement operations disabled unless a safe compare-and-confirm workflow is designed.

Exit criteria: every write operation is independently enabled, tested, auditable, and clearly communicates its effect.

## Phase 5 — Optional remote or multi-tenant hosting

This phase is not a natural extension of the local server; it is a separate security architecture.

- [ ] Define user authentication and lifecycle management.
- [ ] Implement encrypted per-tenant credential storage and rotation.
- [ ] Bind authenticated users to server-selected tenant identities.
- [ ] Prove tenant isolation with automated negative tests.
- [ ] Add abuse controls, retention policies, backups, monitoring, and incident response.
- [ ] Complete legal, privacy, export-control, and independent security reviews.

Exit criteria: the hosted service can demonstrate tenant isolation and compliance appropriate to the data it processes.

## Explicit non-goals for the first release

- Public multi-tenant hosting
- Browser-based API-key collection
- Write or delete operations
- Arbitrary HTTP proxying
- Automatic unbounded export of all records
- Persistent caching of customer data
- Collection of production telemetry or payloads
- Claims of 1Factory endorsement or certification
