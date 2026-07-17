# Data Exposure Reference

All response bodies are validated at runtime. Unknown fields are removed before records reach the MCP client. `ONEFACTORY_REDACT_FIELDS` can remove additional named fields recursively after validation.

## Tool exposure

| Tools                                | Included categories                                                                               | Intentionally excluded                                                                                          |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `search_part_masters`                | Identifier, revision, description, active status, buy/assembly flags, update time                 | Cost, comments, ITAR flag, alternate identifiers, component lists                                               |
| `list_plans`, `get_plan`             | Part/revision, status/version, customer/supplier names, project/operation, bounded specifications | Creator identity, comments, costs, attachments                                                                  |
| `list_inspections`, `get_inspection` | Identifiers, status, part/revision, quantities, in-spec percentage, bounded specifications        | Measurements, notes, people, machines, NCR detail, attachments and attachment URLs                              |
| `list_fais`, `get_fai`               | Identifiers, FAI type/status, part/revision, quantities, bounded specifications                   | Measurements, notes, people, NCR detail, attachments                                                            |
| `list_suppliers`, `get_supplier`     | Name/code, classification flags, qualification status/dates, bounded code lists                   | Postal address, contact users and email addresses, certifications and qualification documents                   |
| `list_qms_records`                   | Type/status, part/revision, quantities, problem summary/root cause, selected dates                | Owner and creator identities, contact details, cost, serial/RMA/shipment values, meeting notes and dispositions |

The allowed fields can still be confidential. Operators should add organization-specific redactions and avoid exposing records that the MCP client or model is not approved to process.

## Pagination

List tools return one page only. `page_size` is limited to 100 and `page` to 0 through 9 at the MCP boundary. The HTTP client independently enforces a maximum page size of 100 and a maximum result window of 1,000 records.
