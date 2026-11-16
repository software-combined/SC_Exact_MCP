# Legacy command-line server

This is the retained BoostU developer implementation.
It uses standard input and output, called stdio, instead of the hosted HTTP service.
It can expose 147 tools, including writes and generic requests.
It is outside the staff hosted mandate.

Use Node.js 22 or newer in this checkout.
Do not install the original public npm package when testing this SCG source.

```sh
npm ci
npm run build
```

The local entry point is `node dist/index.js` or `npm run start:legacy`.
It can list tools without Exact credentials.
Keep any real local credentials outside the repository and shared storage.

| Variable | Legacy meaning |
| --- | --- |
| `EXACT_CLIENT_ID` | ID of a separately authorized local Exact app. |
| `EXACT_CLIENT_SECRET` | That app's secret. |
| `EXACT_REFRESH_TOKEN` | Initial personal refresh token for that app. |
| `EXACT_TOKEN_STORE` | Private local path for rotated refresh tokens. |
| `EXACT_REGION` | Exact region; the legacy default is `be`. |
| `EXACT_DIVISION` | Default division; individual legacy tools can still accept another division. |
| `EXACT_READ_ONLY` | Set `true` to remove explicit write tools. |
| `EXACT_TOOLS` | Optional comma-separated legacy tool groups. |

Set `EXACT_TOKEN_STORE` to a private file path that remains available after restart.
Refresh replaces the old refresh token; without the saved new token, a restart can require sign-in again.
If the saved token is lost or rejected, complete a fresh authorized Exact sign-in.

Read-only mode still exposes 74 tools and a generic GET request path.
The division setting is a default, not the hosted authorization boundary.
These options cannot replace the hosted contract or personal broker.

The old authorization and live diagnostic scripts remain for upstream compatibility.
They can print credentials or financial data.
Do not run them in routine checks or use their output in public evidence.
Obtain separate authority before using them with a live account.

Automated tests start the real ESM stdio entry point with fictional or absent credentials.
They check both catalogue modes without calling a ledger.
The [endpoint reference](exact-endpoints.md) describes the legacy catalogue only.
