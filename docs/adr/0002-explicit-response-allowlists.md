# ADR 0002: Explicit response allowlists

- Status: accepted
- Date: 2026-07-17

## Decision

Each upstream record type is parsed through a Zod object schema containing only approved model-visible fields. Unknown fields are stripped. Array sizes, string lengths, response bytes, page size, and result windows are bounded. A deployment may recursively remove additional field names with `ONEFACTORY_REDACT_FIELDS`.

## Consequences

New upstream fields do not become visible automatically. Adding useful fields requires a deliberate schema, documentation, and test change. The project favors predictable minimization over exact mirroring of the upstream API.
