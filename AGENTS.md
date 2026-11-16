# SCG Exact MCP instructions

This repository owns SCG's hosted Exact Online read service and the retained
BoostU command-line implementation. Normal pull requests target `development`.

Read [RULES.md](RULES.md) before changing behavior and
[ARCHITECTURE.md](ARCHITECTURE.md) before moving responsibilities.
The hosted entry point is `src/hosted/main.ts`. The local legacy entry point is
`src/index.ts`; its generic, potentially writable catalogue must stay separate.

Use Node.js 22 or newer. Run `npm ci`, then `npm run verify`.
Tests use fake credentials and local services. Never point tests at live Exact,
probe a business write, print financial rows, or fetch source secrets.

Keep source and executable configuration below 250 physical lines where useful,
with a hard limit of 400. Tests have 300/500 soft/hard limits. Markdown has
200/400 limits; this file has 200/300. Lockfiles and the identified pure data
fixture are exempt. `npm run check:loc` owns the exact policy.

Source changes do not grant deployment or live qualification authority. Preserve
MIT provenance. No client can supply an Exact URL, token, identity, field list,
filter language, or HTTP method. Documentation must distinguish local proof,
deployed proof, client qualification, and owner acceptance.
