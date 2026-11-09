# GlobeTag / Small World

An invite-only community globe. No member accounts: an invitation grants viewing and one marker per browser. Only owner-issued edit codes permit changes.

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
| `access_records` | `payload` string 6000 required | None; row security enabled |
| `rate_limits` | `count` integer required; `expires` integer required, indexed | None; row security enabled |

Bucket `portraits`: no permissions, file security enabled, JPG only, maximum 600,000 bytes. Images are decoded, cropped, resized and re-encoded on the server, stripping embedded metadata.

Function `small-world-api`:

- Node 22, entrypoint `src/main.mjs`, build `npm ci --omit=dev`.
- Function folder: `functions/globe`.
- Execution permission: `any` (the function itself authenticates requests).
- Dynamic key scopes: `rows.read`, `rows.write`, `files.read`, `files.write`.
- Environment variables: `SESSION_SECRET` (32+), `OWNER_KEY` (32+), `ALLOWED_ORIGINS`, `APPWRITE_ENDPOINT`.
- Only exact allowed origins receive CORS access. All requests still require authorization; CORS is not authentication.

For subsequent backend deployments, run `node scripts/prepare-deployment.mjs`, then upload `.local/globe-api.tgz` through Appwrite's manual deployment or the connected MCP. It contains source and locked dependency manifests, not secrets. The script retains existing local credentials. Do not invoke `--transfer` in a public terminal log: it is for private tool orchestration only.

## Owner operations

Local access information and the standalone owner dashboard are in ignored `.local/access.md`, `.local/access.json`, and `.local/owner-dashboard.html`. Open the HTML file locally, import the JSON credentials or enter your owner key, then unlock. Internet access is required. The dashboard is not published in this repository.

- Generate expiring invitations, copy their links, and revoke them individually. Anyone holding a valid invitation can see every profile/photo on this globe and create one marker per remembered browser identity.
- The browser generates a random visitor token and stores it locally. This does not identify a person: clearing storage, incognito, another browser/device, or a modified client bypasses the limit. No fingerprinting or Discord sign-in is used.
- Group viewing codes allow viewing only. Rotating the viewing code ends existing viewing sessions; active invitations can still rejoin. Revoke invitations separately to remove their access.
- Select a marker to issue a private edit link, valid for 24 hours. It edits only that marker and does not reveal the whole globe. Reissuing or revoking its code invalidates the previous one. Creation grants no edit permission. Old recovery links no longer work; the owner can issue new edit links for existing markers.
- The owner can remove markers and export profile JSON. Removal does not restore that browser's creation allowance. Exports omit photos and private credential hashes.
- The dashboard currently manages one globe, not multiple independent groups. Generated codes are shown once; save them privately. They do not update the original local credentials file.
- Owner sessions last one hour; member sessions last seven days, subject to invitation expiry/revocation and group rotation. Rotate `OWNER_KEY` in Appwrite and redeploy to revoke owner sessions.
- Public project IDs and API URLs identify the service; they grant no data access by themselves. Authorization is enforced server-side. Anyone can attempt requests, so request limits and free-plan quotas still matter.
- The local dashboard uses origin `null`; only authenticated owner actions accept this origin. CORS itself is not authentication.

## Verification

`npm test` verifies authorization, expiration/rotation, ownership, moderation, and input validation against an isolated store. `node scripts/verify-live.mjs` uses ignored local credentials to verify the deployed backend with synthetic data and removes its own test pin/photo afterward. Requires the function's dependencies installed locally.

Natural Earth data is bundled in `public/data`; details and source license links are there. Run `npm run data` to refresh it. City coverage is intentionally limited; users can choose an approximate city-level point for missing towns. Zoom is capped before street-level detail. Text labels progressively appear while zooming. Profiles refresh every minute and when returning to the tab.

No paid map API, paid hosting plan, or custom domain is required. Typeface files currently load from Google Fonts; system fonts are the fallback.
