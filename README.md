# App API

App API hosts shared backend endpoints for the Login applications. It is a
TypeScript/Bun Fastify service with Docker Compose support for local and server
deployments.

## Run locally

Install dependencies and start the API:

```sh
bun install
bun src/index.ts
```

The service listens on port `8080` by default.

Run with Docker Compose:

```sh
docker compose up --build
```

## Main Endpoints

- `GET /api/questions`, `GET /api/neverhaveiever`, and related game/content endpoints provide static app content.
- `GET /api/version/:version/:platform/:lang` reports app update requirements.
- `POST /api/notifications/subscribe` and `POST /api/notifications/unsubscribe` manage push subscriptions.
- `GET /api/notifications`, `POST /api/notifications`, and resend/scheduled notification routes support Queenbee/Nucleus notification administration.
- `GET /api/desktop/:target/:currentVersion` and `GET /api/desktop/:target/:arch/:currentVersion` provide Tauri desktop update manifests.
- `GET /api/desktop/download/:file` serves desktop update artifacts from the configured update directory.

## Desktop Updates

Desktop updates are read from `APP_API_DESKTOP_UPDATES_DIR`, defaulting to
`data/desktop`. The directory should contain a `latest.json` manifest and any
referenced artifact files.

Useful environment variables:

- `APP_API_PUBLIC_URL`: public API origin used when converting local artifact names into download URLs. Defaults to `https://app.login.no`.
- `APP_API_DESKTOP_UPDATES_DIR`: directory containing `latest.json` and desktop update artifacts.

The endpoint returns `204 No Content` when no update is available, when the
client is already current, or when the requested platform is not present in the
manifest.

## Testing

```sh
bunx tsc --noEmit
bun scripts/test-desktop-updates-e2e.mjs
bun scripts/test-notifications-e2e.mjs
```

`npm test` runs both E2E scripts. The notification E2E test starts its own
Postgres container, while the desktop updater E2E test starts a temporary local
API process and validates manifest filtering plus artifact downloads.

## Deployment

The GitHub Actions deploy workflow typechecks the project and, when the deploy
secrets are configured, runs `git pull --ff-only && docker compose up -d --build`
on the server. If the server checkout has local uncommitted changes, the pull is
expected to stop rather than overwriting them.

Project started 18.08.24.
