# GlobeTag / Small World

An invite-only community globe. No member accounts: a community code grants access, and a private recovery link controls each pin.

## Live services

- Website: https://vostoklabs.github.io/globetag/
- Appwrite project: `6af1e4cc00106a7d44aa`, Frankfurt
- API: https://globetag-6af1e4cc.fra.appwrite.run

The repository is public. Member profiles, photos, group codes, session keys and owner credentials are **not** stored in it.

## Local development

```sh
npm ci
npm run dev
```

Without `VITE_API_URL`, the interface clearly labels itself a demo and stores sample data in the browser. Set the public function URL in `.env.local` to use the live backend. Never put backend secrets in a `VITE_` variable.

```sh
npm test
npm run build
```

## Hosting

Push `main` to deploy through `.github/workflows/pages.yml`. GitHub repository variable `VITE_API_URL` points to the Appwrite Function domain. Pages uses the GitHub Actions build source.

All private resources have empty client permissions. The Appwrite Function verifies group sessions and edit tokens, and accesses TablesDB/Storage using Appwrite's execution-scoped dynamic key. No API key is embedded in the website.

### Backend resources

Database `small-world`, serverless TablesDB:

| Table | Columns | Permissions |
|---|---|---|
| `profiles` | `publicJson` string 6000 required; `editHash` string 64 required; `photoId` string 36 required | None; row security enabled |
| `rate_limits` | `count` integer required; `expires` integer required, indexed | None; row security enabled |

Bucket `portraits`: no permissions, file security enabled, JPG only, maximum 600,000 bytes. Images are decoded, cropped, resized and re-encoded on the server, stripping embedded metadata.

Function `small-world-api`:

- Node 22, entrypoint `src/main.mjs`, build `npm ci --omit=dev`.
- Function folder: `functions/globe`.
- Execution permission: `any` (the function itself authenticates requests).
- Dynamic key scopes: `rows.read`, `rows.write`, `files.read`, `files.write`.
- Environment variables: `GROUP_CODE` (12+ characters), `SESSION_SECRET` (32+), `OWNER_KEY` (32+), `ALLOWED_ORIGINS`, `APPWRITE_ENDPOINT`.
- Only exact allowed origins receive CORS access. All requests still require authorization; CORS is not authentication.

For subsequent backend deployments, run `node scripts/prepare-deployment.mjs`, then upload `.local/globe-api.tgz` through Appwrite's manual deployment or the connected MCP. It contains source and locked dependency manifests, not secrets. The script retains existing local credentials. Do not invoke `--transfer` in a public terminal log: it is for private tool orchestration only.

## Owner operations

Local access information is in ignored `.local/access.md` and `.local/access.json`. The shared invitation URL includes the group code in its fragment. The app removes the fragment from the address bar after reading it. A member's recovery link still requires current group access.

- Open the lock icon in the website footer and enter the owner key to enable pin removal and JSON export.
- Change `GROUP_CODE` in the Appwrite Function and redeploy to invalidate all existing group sessions. Distribute the new code privately.
- Rotate `OWNER_KEY` and redeploy to revoke existing owner sessions.
- A member can edit/delete their own pin using their saved browser credential or private recovery link. Losing both requires removing the old pin and making a new one.
- Profile exports omit edit hashes and photos. Back up photos separately from Appwrite Storage.
- Group sessions last 7 days; owner sessions last 1 hour. Anyone with the group code can join and create pins. There is no Discord-membership check or unique-person enforcement.
- Request limiting is a small-community global safeguard, not per-person abuse prevention. Free-plan quotas still apply.

## Verification

`npm test` verifies authorization, expiration/rotation, ownership, moderation, and input validation against an isolated store. `node scripts/verify-live.mjs` uses ignored local credentials to verify the deployed backend with synthetic data and removes its own test pin/photo afterward. Requires the function's dependencies installed locally.

Natural Earth data is bundled in `public/data`; details and source license links are there. Run `npm run data` to refresh it. City coverage is intentionally limited; users can choose an approximate city-level point for missing towns. Zoom is capped before street-level detail. Text labels progressively appear while zooming. Profiles refresh every minute and when returning to the tab.

No paid map API, paid hosting plan, or custom domain is required. Typeface files currently load from Google Fonts; system fonts are the fallback.
