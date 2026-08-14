# VEXOR Frontend Guide

## Runtime boundary

The React/Vite frontend is deployed independently as `vexor-web`. It communicates with the Nest API through:

- `VITE_API_URL` when explicitly configured; or
- `/api` through the production reverse proxy.

Components must not define API base URLs or call `fetch` directly. All JSON and download traffic goes through `src/data/api.ts`.

## API client contract

The central client:

- attaches the current bearer token only to authenticated requests;
- keeps login and MFA challenge calls public;
- emits `velora:session-expired` on authenticated 401 responses;
- maps 403, 429 and 5xx to safe user messages;
- removes secret-looking database, API-key and bearer content from errors;
- converts network failures to a stable `ApiError` with status `0`;
- supports a just-issued token for the post-login company presentation lookup.

New endpoints should add a typed helper or use `apiGet`, `apiPost`, `apiPatch`, `apiDelete` or `apiUpload`. Never place tokens in URLs or console logs.

## Authentication UI

The login form prevents duplicate submit while pending. Username remembering stores only the identifier; password remembering is not implemented. Access tokens use local storage only when the user selects remember-session, otherwise session storage.

The removed temporary-password screen must not be reintroduced. Permanent password changes belong in the authenticated profile flow and invalidate the current session after success.

## Error and loading states

- Every data screen renders loading, error and empty states separately.
- Mutation buttons remain disabled while a request is pending.
- 401 causes a single central logout path in `App.tsx`.
- The top-level `AppErrorBoundary` provides a recoverable refresh action and logs only an error type, never message/stack/user data.
- Feature errors should remain inside the feature rather than blanking the entire application.

## PWA updates

The service worker registers immediately, but a waiting release is never activated without the user. `PwaUpdatePrompt` displays “Yeni VEXOR sürümü hazır” and applies the update only after “Şimdi yenile”. This prevents an old tab from changing code in the middle of a form operation.

## Accessibility and responsive rules

- Inputs have visible labels and correct autocomplete values.
- Icon-only buttons require an `aria-label`.
- Dialogs use `aria-modal`, a labelled title and keyboard-reachable controls.
- Loading and update notices use polite live regions; blocking errors use alerts.
- Focus indicators must remain visible in light/dark themes.
- Layouts must be usable at 360 px, tablet and desktop widths without horizontal page scrolling.
- DZD values remain left-to-right; text direction does not change for tr/fr/en.

## Verification

```text
npm test
npm run lint
npm run build
```

After build, scan `dist` JavaScript/CSS/HTML for `localhost:` and `127.0.0.1:`. A production bundle containing either value must not be deployed. Repository-wide lint currently has baseline React 19 rule debt tracked separately; changed files must pass focused lint until that baseline is removed.
