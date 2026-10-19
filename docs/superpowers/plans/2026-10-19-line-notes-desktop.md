# BO Notes Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a portable Windows .exe that collects selected LINE Notes into recoverable drafts, supports human review and Excel export, and imports approved text into BO ad as review records without stock effects.

**Architecture:** WPF desktop uses a bounded LINE-window collector and local Thai/English OCR. Core parsing, draft revisions, review/export gates, evidence manifests, and API contracts are testable without LINE. Existing Express backend gains an idempotent notes-desktop adapter; existing inventory processing remains separate.

**Tech Stack:** C#/.NET 10 WPF win-x64 self-contained; Tesseract 5.2 wrapper with bundled tha/eng traineddata; JSON atomic draft/journal persistence; Open XML XLSX writer; existing Express/MariaDB backend. Toolchains live under task work, not global installation. Pin actual download/package versions and hashes in build documentation.

**Spec:** `docs/superpowers/specs/2026-10-19-line-notes-desktop-design.md` (user approved text + screenshot evidence on 2026-10-19).

## Global Constraints

- Windows 10/11 x64 portable ZIP with .exe and OCR resources; no Python/Node runtime required by end user.
- Read only the LINE window/group the user selects; no private API, credentials, database extraction, or LINE send/edit/delete actions.
- Local drafts save automatically; network import requires explicit confirmation and current selection/revision exported to Excel first.
- Preserve source labels, duplicate columns, long identifiers, original/OCR/corrected text, dates and evidence separately.
- Every image-derived SN and technician assignment requires human review. Never guess O/0 or bind author display names as account IDs.
- Import creates review/conflict only, regardless of auto-enabled mode; no inventory or completed/wage changes.
- No attached-media downloads, cloud OCR, background locked-desktop service, or claims of full-group coverage.
- Existing user changes in original BO checkout must remain untouched. Work in existing clean linked worktree; final artifacts in task outputs.

## Review Focus

1. OCR sees text in attached photos: collector must label image regions as evidence/uncertain fragments and not silently turn them into another ready job.
2. Large font/DPI/window changes: recalculate window-relative capture, detect changed group/bounds and stop rather than click stale coordinates.
3. Close/crash during draft write: previous complete snapshot survives and evidence references only completed images.
4. Server commits but response is lost: retry with same client item/revision yields same record, changed payload for same key is rejected.
5. Selection or text changes after Excel export: import gate invalidates even when row count is unchanged.

## File Structure

- `desktop/BoNotesInspector/BoNotesInspector.csproj`, `App.xaml[.cs]`, `MainWindow.xaml[.cs]`: desktop shell and Thai workflow.
- `desktop/BoNotesInspector.Core/Models.cs`, `NoteParser.cs`, `DraftStore.cs`, `ReviewPolicy.cs`, `WorkbookWriter.cs`, `NotesApiClient.cs`: cross-platform core and deterministic contracts.
- `desktop/BoNotesInspector/Capture/LineWindow.cs`, `OcrReader.cs`, `Collector.cs`, `PostAssembler.cs`: selected-window lifecycle, OCR bounds, safe expansion/scroll, overlap evidence and fragments.
- `desktop/BoNotesInspector.Tests/`: core behavior, image segmentation fixtures, export readback and API fake-server tests; no broad mock implementation-mirror tests.
- `desktop/build.ps1`, `desktop/README.md`, `desktop/THIRD-PARTY-NOTICES.md`: reproducible package with local SDK/tool downloads and checksums.
- `backend/line/desktop.js`, `backend/line/desktop-migration.sql`, `backend/line/router.js`, `backend/line/migrate.js`: authenticated idempotent adapter and metadata records.
- `backend/tests/lineDesktop.test.js`: MariaDB/HTTP adapter regression tests with existing isolated fixture.

### Task 1: Prove OCR/capture and post boundaries before full product

**Interfaces:** `OcrReader.Read(Bitmap)->OcrFrame(lines with bounds, words/confidence)`; `PostAssembler.Push(CaptureFrame)->DraftCandidates`; `Collector.RunAsync(SelectedWindow, CaptureOptions, onFrame, CancellationToken)->CollectionResult`. `CaptureFrame` includes immutable image ID/hash, timestamp, viewport/group observed, OCR lines and scroll ordinal. Unknown boundaries remain fragments.

- [ ] Prepare local .NET SDK and pinned OCR dependencies after recording provenance; scaffold core/capture/test projects within `desktop/`.
- [ ] Write failing assembler fixtures: two adjacent notes stay separate; overlap retains every unique line; clipped beginning/end and See-more remain incomplete; identical source never silently deletes uncertain second post.
- [ ] Run `dotnet test desktop/BoNotesInspector.Tests` and confirm intended failures, then implement minimal OCR/capture/assembly and rerun.
- [ ] Add minimal collector UI needed to select observed LINE Notes window and read/expand/scroll with cancellation. It is read-only and bounds every run by pages/time. Unexpected modal, obscured window, group/bounds change or no progress stops with explicit reason.
- [ ] Verify 5 consecutive real Notes from user-selected group with screenshots/raw OCR and human count check. If blocked or boundaries unreliable, stop full build and report the measured outcome rather than substitute manual capture without approval.
- [ ] Commit capture feasibility implementation and evidence report (no private Notes contents in Git).

### Task 2: Durable drafts, parsing and review gates

**Interfaces:** `NoteParser.Parse(string)->ParsedNote` with ordered fields, duplicate occurrences and old/new SN roles; `DraftStore.SaveAsync(DraftBatch)` / `LoadAsync(path)`; `ReviewPolicy.CanImport(batch, selection, exportReceipt)->ValidationResult`. `DraftBatch` has GUID batch ID, item GUIDs/revisions, original OCR/corrected text, evidence refs, author/date display metadata, technician ID, human verification flags, selected IDs and import receipts. Digest covers all network payload fields and selection.

- [ ] Failing tests: four provided Thai formats and Buddhist two-digit dates; duplicate labels; unknown fields; long string IDs; invalid date; old MA SN excluded; no O/0 correction.
- [ ] Failing persistence/gate tests: interrupted atomic replace preserves prior snapshot; orphan temporary image not referenced; unverified SN/date/technician blocked; export digest mismatch blocks same-count selection edit; import never starts on ambiguous/incomplete fragments.
- [ ] Implement and pass those tests. Keep original text immutable; edits create revisions and invalidate export/review flags for affected fields. Freeze upload payload snapshot after final confirmation.
- [ ] Build list/details/image review UI with filters, batch technician assignment requiring confirmation, unknown-date bucket and saved session reopening. Human may explicitly resolve boundaries using visible evidence; never mark captured SN verified automatically.
- [ ] Commit durable draft and review flow.

### Task 3: Excel and evidence ZIP before import

**Interfaces:** `WorkbookWriter.Export(batch, selectedIds, path)->ExportReceipt` returns payload digest and file SHA256 after successful close. `ExportEvidenceZip(...)` contains relative evidence paths, manifest and workbook; exported revision must match import snapshot.

- [ ] Write failing readback tests using independent Open XML parsing: 9 specified sheets, source label ordering/repetition, text IDs, blank cells, Thai source dates, formula-like values as strings, long raw split losslessly, unknown type and not-imported states.
- [ ] Implement writer/ZIP with no absolute source paths or unrelated images; avoid Excel cell length and invalid XML control-character failures. Failed/cancelled export creates no valid receipt.
- [ ] Run tests and inspect generated workbook with spreadsheet tool/render if available. Export corrected and unverified rows with clear statuses; verify no login/network dependency.
- [ ] Commit and produce clearly marked synthetic example XLSX.

### Task 4: BO ad idempotent review-only adapter

**Interfaces:** `POST /api/line-import/desktop/items` receives `{batchId,itemId,revision,technicianId,text,source:{group,author,postedText,capturedAt,evidenceHashes,originalOcr},payloadHash}`. `GET /api/line-import/desktop/items/:batchId/:itemId/:revision` returns previous receipt. Existing auth/admin middleware applies; table unique `(batch_id,item_id,revision)` stores actor, canonical server payload hash, line record IDs and bounded metadata JSON. One request represents one parsed job, no arbitrary multi-job ambiguity. Validate all limits and server parsing before commit.

- [ ] Failing HTTP/real MariaDB tests: unauthenticated/tech role/invalid approved user blocked; first insert review even auto mode true; exact retry same receipt; changed payload same key409; changed revision same job conflict; metadata retained; no inventory/log/completed effects; oversized or inconsistent data rejected before insert.
- [ ] Implement additive migration and transaction using existing `service.createRecords` via a narrow transaction-aware API rather than nested transactions; source `notes_desktop` must fit existing schema and be review only. Add router module before `/:id` patterns and expose metadata in record detail/audit.
- [ ] Run new tests and affected backend suite against existing isolated MariaDB on3318. Migration stays explicit and additive; preserve existing webhook/manual import behavior.
- [ ] Implement `NotesApiClient` with HTTPS default `https://bonusais.com`, login token memory only, load approved technicians, server preview before upload, per-item receipts and safe retry. Fake local HTTP server allowed only explicit test config.
- [ ] Commit and prepare deploy/migration changes for review; do not test with production technician stock.

### Task 5: Package, end-to-end verification and delivery

**Interfaces:** `desktop/build.ps1 -Configuration Release` yields `outputs/BO-Notes-Inspector-Windows.zip`, version/hash manifest, source ZIP, Thai README, verification report and example XLSX.

- [ ] Finish Thai UI: read / review / summary-export / import-history, current filter/selection totals, dates distinguished, clear uncertain states, start/stop recovery and final payload confirmation. No hidden auto import toggle.
- [ ] Run complete desktop tests and existing affected frontend/backend checks; publish self-contained win-x64 and unpack to a clean folder. Launch actual packaged exe and test capture/reopen/export and isolated BO adapter flow. Test minimum package dependencies rather than relying on developer SDK process.
- [ ] Obtain fresh whole-change review per requesting-code-review; address correctness findings and rerun affected tests.
- [ ] Deploy only reviewed backend adapter using existing authorized GitHub FTP path with explicit migration and backup; check no unintended user files. If production connection blocked, ship tested .exe and prepared adapter while stating exact limitation, not fake successful import.
- [ ] Verify file manifest/no credentials/private sample data, update source/build/provenance docs and Thai guide with measured OCR results and remaining limitations. Deliver executable ZIP, source, XLSX and test report via absolute output links.

## Self-review and execution

Spec coverage mapped above: capture/stop/bounds to Task1; original/edits/dates/identity/auto-save to Task2; export gate/format/evidence to Task3; review-only idempotency/auth to Task4; portable delivery/real test/limitations to Task5. Review Focus cases1–2 belong to Task1,3/5 to Task2/3,4 to Task4. User explicitly said “ยืนยัน เริ่มตามแบบนี้”; execute natively in this session, not a new user-owned chat. Stop only for failed feasibility or information/authorization actually missing.
