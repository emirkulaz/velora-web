# VEXOR Internationalization Guide

VEXOR supports Turkish (`tr`), French (`fr`), and English (`en`). The selected
language is available before login, is stored in the browser, and is persisted
to the authenticated user's `preferredLanguage` preference.

## Rules

- User-facing copy must use `useI18n().t(...)`; do not add fixed UI strings to
  components or views.
- Every key must exist in all three languages. `npm run i18n:check` enforces
  identical, non-empty key sets.
- Large feature catalogs belong in `src/i18n/catalogs/`. Keep the same key in
  each language and merge the catalog into `I18nProvider`.
- API enum values are identifiers, not labels. Render them through translation
  keys instead of displaying the raw value.
- Use `formatNumber`, `formatDate`, and `formatCurrency` from `useI18n` so the
  selected locale is applied without changing the accounting currency.
- TRIKOMEX monetary values remain in DZD for every language.
- Dates use the `Africa/Algiers` business timezone unless an endpoint explicitly
  defines another business rule.
- Language selection must never depend on the user's role or permissions.

## Adding copy

1. Add a namespaced key to the Turkish, French, and English catalogs.
2. Replace the fixed string with `t('namespace.key')`.
3. Use interpolation for variable content, for example
   `t('customers.deleteConfirm', { name })`.
4. Add or update a component test that renders at least one non-Turkish locale.
5. Run:

   ```bash
   npm run i18n:check
   npm test
   npm run build
   ```

## Locale mapping

| UI language | Formatting locale | Direction |
| --- | --- | --- |
| Turkish | `tr-TR` | LTR |
| French | `fr-DZ` | LTR |
| English | `en-GB` | LTR |

Browser storage is a startup fallback only. After authentication, the user
preference returned by `/users/me` becomes authoritative and remains unchanged
when the user's role changes.
