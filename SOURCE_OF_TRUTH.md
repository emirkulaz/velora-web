# VEXOR Web source of truth

The production Web is this repository, `emirkulaz/velora-web`, branch `main`.
The authoritative local checkout is `C:/Users/kanar/Desktop/Velora/velora-web`.
Railway project: `brave-radiance` (`c241bd7f-cac0-4872-8de3-b4b20883d705`).
Environment: `production`. Service: `vexor-web` (`e536f98b-54b4-4fbb-bdc6-6fed85bd52ae`).
Public Web: `https://erpvexor.com`.
Production `VITE_API_URL`: `https://velora-production-01a9.up.railway.app`.

Build `main` from the repository root with `npm run build`. The existing Railway
start command is `npm run preview -- --host 0.0.0.0 --port $PORT`.
`GET /version.json` identifies the built artifact. The HTML meta tag
`vexor-build-sha` identifies the actual document, including an old offline copy.
Compare both with the Railway deployment commit and GitHub HEAD. `version.json`
is not precached and is excluded from the service worker navigation fallback.

The current daily dashboard is `BusinessPositionPanel`; daily entry and explicit
confirmation are `DailyEntryPanel`. API access uses `src/data/api.ts`.
Local `/api` and the Vite localhost proxy are development configuration, not an
obsolete production API endpoint.

`.deploy-staging/*/{api,web}` are historical upload snapshots, not independent
projects. Do not edit or deploy them. API changes belong to the separate
`velora-api-v2` repository. The old AI feature branch is not production; do not
replace the current interface with its older component versions.
