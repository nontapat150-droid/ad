# BO LINE import implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task by task.

**Goal:** Native BO ad menu for LINE closeout intake, transactional SN usage/audit, original-field Excel and Sheets reports.
**Architecture:** Express signed raw webhook persists inbox; SQL worker parses and reconciles inventory under job/item locks. Admin UI shares the existing Layout and auth; report fields retain source order/duplicates.
**Tech Stack:** Existing React/Vite, Express, mysql2, ExcelJS, node:test. No new runtime libraries.
**Spec:** docs/superpowers/specs/2026-10-19-line-import-design.md (approved by user “เริ่มเลย”).

## Global constraints
- Preserve pending sales edits; isolated branch codex/bo-line-import based on 3d86838.
- Four job types, Thai dates and source fields preserved. Existing job completion conditions remain.
- Raw signed LINE input, allowed groups and explicit sender binding. Unknown input never deducts.
- Job inventory/log/import effects commit together; retries and manual completion must not deduct twice.
- Historical text requires preview, chosen technician and explicit confirmation.
- Notes cannot be retrieved by Messaging API: paste/TXT only. Secrets only server env.

## Review focus
- Imported usage followed by normal completion or admin recompletion must stay consistent.
- Concurrent webhook deliveries and manual confirmations must produce one usage/log.
- Duplicate/malformed/multiple SN or conflicting job references must enter review without partial usage.
- Long/raw/repeated fields and formula-like strings must survive Excel without executing formulas.
- Missing settings/DB migrations and external Sheets failure must report honestly, preserve intake, and retry safely.

### Task 1: Source parser and report contract
Files: backend/line/parser.js, backend/tests/lineParser.test.js; frontend/src/utils/lineWorkbook.js and test.
Interfaces: parseText(text) -> records [{type,tag,raw,fields:[{label,value,occurrence,line}],date,caseNo,orderNo,srt,sns,warnings}]; workbook(records) -> ExcelJS Workbook.
- [ ] Write tests for 4 tags, Thai dates, multiline/unknown/repeated fields, MA old/new SN, quoted TXT, ambiguous SN.
- [ ] Run node --test backend/tests/lineParser.test.js; observe missing behavior.
- [ ] Implement pure parser and shared source report schema, preserving all raw input.
- [ ] Run parser suite; expected all pass; commit task.

### Task 2: MySQL inbox, bindings, imports and inventory reconciliation
Files: backend/line/migration.sql, repository.js, service.js, inventory.js; backend/tests/lineSql.test.js plus isolated fixture.
Interfaces: createLineService({pool,config}) with receive(events), preview(text), importText({text,userId,actorId}), process(id,{actorId,confirm,reportOnly,expectedVersion}), drain(); shared inventory helper existingUsage(conn,{kind,jobId,itemId,role}), lockJob(conn,kind,id), invalidateEffects(conn,kind,id).
- [ ] Initialize separate loopback test database; never import production pool in tests.
- [ ] Write real SQL tests: all-or-none, sender/group/owner scope, same-job usage dedup, concurrent confirms, event retry, conflicts, archive edits, unsend, worker restart.
- [ ] Run RED; implement additive migration/repository/transaction service using ordered locks and unique keys, default review-only.
- [ ] Run real SQL tests GREEN and commit.

### Task 3: Signed webhook, admin API and worker
Files: backend/line/router.js, worker.js, backend/server.js; backend/tests/lineRoutes.test.js.
Interfaces: createLineRouter({pool,config,auth,requireRole}); webhook raw parser mounted before global JSON at /api/line/webhook and /line/webhook; admin routes /line-import.
- [ ] Write HTTP tests for exact raw HMAC, tamper/large body, event duplicates, all-events persistence, non-admin and invalid input.
- [ ] Run RED; implement routes/bounded durable worker; explicit migration runner, config example and health without secrets.
- [ ] Run HTTP + SQL suites GREEN; commit.

### Task 4: Existing completion integration
Files: backend/routes/dispatch.js, inventory.js, frontend/src/components/CompleteJobModal.jsx and CompleteMaJobModal.jsx; shared backend/line/inventory.js tests.
- [ ] Write RED tests of imported usage then completion, reverse order and recomplete; require locks in both routes.
- [ ] Add bounded shared helper reuse to avoid duplicate deduction; lock job in all usage paths. Invalidate import effects on explicit returns so stale retry never reapplies. Expose existing use to normal completion forms.
- [ ] Verify existing backend suites and new regression tests GREEN; commit.

### Task 5: Native import page and source Excel
Files: frontend/src/pages/LineImportPage.jsx, components/line/*, utils/lineWorkbook.js; App.jsx, Sidebar.jsx, backend report endpoints.
Interfaces: API list/detail/filter/preview/import/process/bindings/groups/settings/history/report; workbook(records) returns 4 category sheets + summary/audit/raw.
- [ ] Write RED report tests for duplicate labels, long text split, string IDs, correct inclusive dates/filter results.
- [ ] Implement page with list/search/date/type/status filters; preview/paste/TXT; detail raw/parsed/SN checks and explicit versioned confirmation; mapping settings and audit. Use existing Layout typography/colors and accessible controls/mobile overflow.
- [ ] Build/lint changed files, test report read-back, browser verify local fixture; commit.

### Task 6: Sheets outbox, deployment and delivery
Files: backend/line/sheets.js, sheets-report.gs, .env.line.example, README.md; tests/lineSheets.test.js and setup runner.
- [ ] Write RED tests for signed report sync, outbox retry/version ordering and no stock mutation on external failure.
- [ ] Implement idempotent Sheets relay by approved destination ID and HMAC; report outbox per record/version; document deployment and BOT connection readiness.
- [ ] Full new/old backend suite, frontend tests/build, targeted lint and fresh whole-branch review; correct material findings with RED/GREEN.
- [ ] Package migration/source/patch/install guide in task outputs; integrate tested changes into original checkout preserving dirty files if conflict-free. No production DB mutation or stock test without prepared explicit deployment context.

## Execution rulings
User approved the full design and instructed “เริ่มเลย”; this authorizes inline execution without another plan approval question. Native create_worktree cannot access the external BO checkout (“Not a git repository”), so use manual Git worktree at task work/bo-line. NODE_PATH points to existing installed dependencies; do not replace tracked backend/node_modules. Baseline failure due missing firebase-admin in tracked modules is environment-only, resolve by NODE_PATH and rerun before coding.
