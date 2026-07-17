# Contributing

Thank you for helping build a safe, open-source MCP integration for 1Factory.

## Before contributing

- Read the security requirements in [README.md](README.md).
- Never use production credentials or production customer data in development, examples, tests, issues, or pull requests.
- Use the 1Factory sandbox for integration testing.
- Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).
- Keep pull requests focused and explain any security or data-handling implications.

## Development principles

Contributions should preserve these defaults:

- read-only operation;
- local STDIO transport;
- sandbox API endpoint;
- strict input validation;
- bounded pagination and response sizes;
- no credential or payload logging;
- no arbitrary upstream URLs; and
- explicit opt-in for any future write tool.

## Proposed workflow

1. Open an issue describing the use case or defect, unless the change is a small documentation correction.
2. Create a focused branch from the default branch.
3. Add tests for behavior and error paths.
4. Run formatting, linting, type checking, tests, and security checks.
5. Open a pull request describing what changed, why, validation performed, and security considerations.

Exact development commands will be added when the TypeScript project is scaffolded.

## Commit and pull-request hygiene

- Do not commit generated build output, local MCP configuration, `.env` files, or credentials.
- Do not include confidential screenshots or API responses.
- Use synthetic fixtures with obviously fictional organizations, people, parts, and measurements.
- Avoid unrelated dependency updates in feature or bug-fix pull requests.
- Call out changes to authentication, authorization, logging, network access, pagination, caching, and write behavior.

## License

By submitting a contribution, you agree that it will be provided under the repository's [MIT License](LICENSE).
