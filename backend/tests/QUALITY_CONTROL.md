# Quality control: service status and date filters

Updated 2026-09-11. No database schema migration is needed.

The existing `qc_status` column stores the service state (Active, Suspend, Terminate or the imported source text). The legacy `status` flag remains `active` for Active/Suspend and `cancelled` for Terminate so other registry modules remain compatible. QC uses the API's normalized `service_status` rather than this two-value flag.

Manual QC edits require `service_status` and an actual `status_changed_at` between installation and today in Bangkok. Terminate also writes the same date to `cancelled_at`. Imported observation/check dates are not substituted for effective dates. Undated historical imports remain visibly unconfirmed, and imports older than an existing effective date do not overwrite the newer service state. Imported customer changes are recorded in `quality_audit_logs`.

`GET /api/installed-customers/qc` accepts `date_from`, `date_to` (YYYY-MM-DD, inclusive) and `date_type=install|status_changed`. Both dates must be supplied. Omitted dates retain the existing month/cohort API behavior. A custom range selects exactly those customers; it does not silently restrict results to a previously loaded installation month. Status-date filtering uses the most recent stored effective date, not observation, import or expected termination dates. Results represent the latest known service status, not a reconstructed historical snapshot of all transitions.

Historical dates previously inferred by the old importer cannot be reliably identified from existing values alone. Do not invent replacements; correct them from actual source records when available.

Run the regression suite from the project root:

```
node --test backend/tests/qualityStatus.test.js backend/tests/qualityRoutes.test.js frontend/src/utils/qcImport.test.mjs
```

Route tests use an in-memory database substitute. They verify API validation, range parameters, status normalization, updates and audit calls without connecting to a real database. `qualityFixture.js` is test-only and must never be imported by the application runtime.
