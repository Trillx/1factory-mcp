# Security Policy

## Supported versions

This project is in pre-release development. Until the first stable release, security fixes will be applied only to the latest commit on the default branch.

## Reporting a vulnerability

Do not report vulnerabilities, exposed credentials, regulated data, or suspected data leaks in a public issue, discussion, or pull request.

Use this repository's **Security** tab to open a private GitHub Security Advisory. Include:

- the affected version or commit;
- the deployment model and MCP transport;
- clear reproduction steps;
- the expected and observed behavior;
- the potential impact;
- whether credentials or sensitive records may have been exposed; and
- suggested mitigations, if known.

Maintainers should acknowledge a complete report within five business days. Remediation and disclosure timing will depend on severity, exploitability, and whether upstream coordination is required.

## Scope

Examples of in-scope reports include:

- exposure of `x-1factory-key` or `x-1factory-org` values;
- cross-tenant data access;
- authentication or authorization bypass;
- server-side request forgery;
- unsafe write execution or confirmation bypass;
- secret leakage through logs, traces, errors, or MCP results;
- unbounded pagination or resource exhaustion; and
- dependency or build-pipeline compromise affecting distributed artifacts.

Vulnerabilities in the 1Factory service itself are outside this project's scope and should be reported privately through [1Factory Support](https://1factoryhelp.zendesk.com/hc/en-us).

## Handling exposed credentials

If a real 1Factory API key appears in this repository or its artifacts:

1. Revoke and rotate the key immediately.
2. Disable affected deployments.
3. Remove the secret from Git history and published artifacts.
4. Review logs and service activity for misuse.
5. Follow the affected organization's incident-response requirements.

Deleting the latest commit does not remove a credential from Git history.

## Disclosure

Please allow maintainers a reasonable opportunity to investigate and release a fix before public disclosure. We will credit reporters who want recognition unless legal, privacy, or safety constraints prevent it.
