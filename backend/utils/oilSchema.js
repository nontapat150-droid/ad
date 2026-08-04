/**
 * Oil records: persist team_id at fill-up time so history stays on the original
 * team when a technician is later reassigned.
 */

let schemaReady = false;
let backfillDone = false;

/**
 * Ensure oil_records.team_id exists (historical team at time of record).
 * Does not rewrite team_id when users later change teams.
 */
async function ensureOilRecordsSchema(db) {
  if (schemaReady) return;
  try {
    await db.query(
      `ALTER TABLE oil_records
       ADD COLUMN team_id INT NULL
       COMMENT 'Team at time of fill-up (immutable on tech transfer)'
       AFTER tech_id`
    );
  } catch (e) {
    /* column may already exist */
  }
  try {
    await db.query('ALTER TABLE oil_records ADD INDEX idx_or_team (team_id)');
  } catch (e) {
    /* index may exist */
  }
  schemaReady = true;
}

/**
 * One-time / opportunistic backfill of NULL team_id.
 * Priority:
 *  1) license_plate matches team_name (UI autofills team name as plate)
 *  2) license_plate matches "ทีม {id}"
 *  3) fallback to tech's current users.team_id
 */
async function backfillOilRecordTeams(db) {
  if (backfillDone) return;
  try {
    await ensureOilRecordsSchema(db);

    // 1) Match plate used as team name at fill-up (exact / trim / truncated to VARCHAR(20))
    const [r1] = await db.query(
      `UPDATE oil_records r
       INNER JOIN teams t ON (
         TRIM(t.team_name) = TRIM(r.license_plate)
         OR LEFT(TRIM(t.team_name), 20) = TRIM(r.license_plate)
       )
       SET r.team_id = t.id
       WHERE r.team_id IS NULL`
    );

    // 2) Autofill fallback "ทีม {id}"
    const [r2] = await db.query(
      `UPDATE oil_records r
       INNER JOIN teams t ON r.license_plate = CONCAT('ทีม ', t.id)
       SET r.team_id = t.id
       WHERE r.team_id IS NULL`
    );

    // 3) Last resort: current membership (best available for real plates)
    const [r3] = await db.query(
      `UPDATE oil_records r
       INNER JOIN users u ON u.id = r.tech_id
       SET r.team_id = u.team_id
       WHERE r.team_id IS NULL AND u.team_id IS NOT NULL`
    );

    backfillDone = true;
    const n1 = r1?.affectedRows || 0;
    const n2 = r2?.affectedRows || 0;
    const n3 = r3?.affectedRows || 0;
    if (n1 + n2 + n3 > 0) {
      console.log(
        `[oilSchema] backfilled oil_records.team_id: by_plate=${n1}, by_team_id_label=${n2}, by_current_user=${n3}`
      );
    }
  } catch (e) {
    console.error('[oilSchema] backfillOilRecordTeams error:', e.message);
  }
}

/** Call on oil API routes: ensure column + backfill once. */
async function ensureOilTeamOwnership(db) {
  await ensureOilRecordsSchema(db);
  await backfillOilRecordTeams(db);
}

module.exports = {
  ensureOilRecordsSchema,
  backfillOilRecordTeams,
  ensureOilTeamOwnership,
};
