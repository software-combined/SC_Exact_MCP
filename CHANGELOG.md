# Changelog

## Unreleased: SCG hosted read service

The SCG fork adds a separate hosted service with four fixed read operations.
Personal Exact OAuth connections remain separate from the legacy stdio catalogue.

The implementation adds shared credential rotation, encrypted state, bounded paging,
client grants, sequential source reads, and EU production templates with two-zone availability.
Local protocol tests use the real OAuth and MCP libraries with fictional Exact responses.
Deployment and staff qualification remain pending.

The package is private.
Inherited npm and MCP Registry publishing paths are removed.
The public documentation now follows the SCG hosted mandate.

## Upstream origin

The retained legacy server originated in BoostU Exact Online MCP 1.0.0.
Its catalogue, local authentication, and generic tools are separate from the hosted service.

Historical release details remain in the
[upstream repository](https://github.com/boostuagency/boostu-exactonline-mcp).
The [MIT licence](LICENSE) and [notice](NOTICE) retain original attribution.
