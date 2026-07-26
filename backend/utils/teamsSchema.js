/**
 * Teams schema helpers: office vs contractor types, oil flag, leader.
 */

const TEAM_TYPES = {
  office_install: { counts_for_oil: 1, roles: ['technician'], label: 'ช่างติดตั้ง (สำนักงาน)' },
  office_ma: { counts_for_oil: 1, roles: ['ma_technician'], label: 'ช่าง MA (สำนักงาน)' },
  contractor_install: { counts_for_oil: 0, roles: ['contractor_office'], label: 'รับเหมาติดตั้ง' },
  contractor_ma: { counts_for_oil: 0, roles: ['contractor_ma'], label: 'รับเหมา MA' },
};

let schemaReady = false;

async function ensureTeamsSchema(db) {
  if (schemaReady) return;
  const cols = [
    {
      name: 'team_type',
      def: `ENUM('office_install','office_ma','contractor_install','contractor_ma') NOT NULL DEFAULT 'office_install'`,
    },
    { name: 'leader_user_id', def: 'INT NULL' },
    { name: 'counts_for_oil', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
    { name: 'vehicle_plate', def: 'VARCHAR(32) NULL' },
    { name: 'is_active', def: 'TINYINT(1) NOT NULL DEFAULT 1' },
    { name: 'notes', def: 'VARCHAR(255) NULL' },
  ];
  for (const { name, def } of cols) {
    try {
      await db.query(`ALTER TABLE teams ADD COLUMN ${name} ${def}`);
    } catch (e) {
      /* column may already exist */
    }
  }
  try {
    await db.query('ALTER TABLE teams ADD INDEX idx_teams_leader (leader_user_id)');
  } catch (e) {
    /* index may exist */
  }
  // Sync oil flag from type (safe for existing rows)
  try {
    await db.query(`
      UPDATE teams SET counts_for_oil = CASE
        WHEN team_type IN ('contractor_install','contractor_ma') THEN 0
        ELSE 1
      END
    `);
  } catch (e) {
    /* ignore */
  }
  schemaReady = true;
}

function oilFlagForType(teamType) {
  const meta = TEAM_TYPES[teamType];
  return meta ? meta.counts_for_oil : 1;
}

function rolesForType(teamType) {
  return TEAM_TYPES[teamType]?.roles || [];
}

function isValidTeamType(teamType) {
  return Boolean(TEAM_TYPES[teamType]);
}

/** Returns true if this team should increment team_oil_cases */
async function teamCountsForOil(db, teamId) {
  if (!teamId) return false;
  try {
    await ensureTeamsSchema(db);
    const [[row]] = await db.query(
      'SELECT counts_for_oil FROM teams WHERE id = ? LIMIT 1',
      [teamId]
    );
    if (!row) return false;
    return Number(row.counts_for_oil) === 1;
  } catch (e) {
    // Fail open only if schema not migrated yet — treat as count
    return true;
  }
}

async function bumpTeamOilCase(db, teamId, yearMonth) {
  if (!(await teamCountsForOil(db, teamId))) return false;
  try {
    await db.query(
      `INSERT INTO team_oil_cases (team_id, \`year_month\`, case_count)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
      [teamId, yearMonth]
    );
  } catch (e) {
    if (e.message && e.message.includes("Field 'id' doesn't have a default value")) {
      const [[{ maxId }]] = await db.query('SELECT MAX(id) as maxId FROM team_oil_cases');
      await db.query(
        `INSERT INTO team_oil_cases (id, team_id, \`year_month\`, case_count) VALUES (?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
        [(maxId || 0) + 1, teamId, yearMonth]
      );
    } else {
      throw e;
    }
  }
  return true;
}

async function decrementTeamOilCase(db, teamId, yearMonth) {
  if (!(await teamCountsForOil(db, teamId))) return false;
  await db.query(
    `UPDATE team_oil_cases SET case_count = GREATEST(0, case_count - 1)
     WHERE team_id = ? AND \`year_month\` = ?`,
    [teamId, yearMonth]
  );
  return true;
}

/** Normalize Thai names for leader/team matching (ช่างเจมส์ ≈ เจมส์) */
function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/^ช่าง\s*/g, '')
    .replace(/^ทีม\s*/g, '')
    .replace(/[\s\-_.]+/g, '')
    .replace(/[()（）[\]【】]/g, '');
}

/**
 * Load teams+leaders once, then match Excel names → team.
 * Prefer exact leader name, then ends-with, then team_name / vehicle_plate.
 */
async function loadTeamLeaderIndex(db) {
  await ensureTeamsSchema(db);
  const [rows] = await db.query(
    `SELECT t.id AS team_id, t.team_name, t.team_type, t.leader_user_id,
            t.counts_for_oil, t.vehicle_plate, lu.full_name AS leader_name
     FROM teams t
     LEFT JOIN users lu ON lu.id = t.leader_user_id`
  );
  return rows || [];
}

function matchTeamFromLeaderIndex(teams, rawName) {
  const core = normalizePersonName(rawName);
  if (!core || !teams?.length) return null;

  const exact = teams.filter(
    (t) => t.leader_user_id && t.leader_name && normalizePersonName(t.leader_name) === core
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  if (core.length >= 2) {
    const ends = teams.filter((t) => {
      if (!t.leader_user_id || !t.leader_name) return false;
      const n = normalizePersonName(t.leader_name);
      return n === core || n.endsWith(core) || core.endsWith(n);
    });
    if (ends.length === 1) return ends[0];
    if (ends.length > 1) return null;
  }

  const byTeam = teams.find(
    (t) =>
      normalizePersonName(t.team_name) === core ||
      (t.vehicle_plate && normalizePersonName(t.vehicle_plate) === core)
  );
  return byTeam || null;
}

/**
 * If job has engineer/leader name, re-bind team_id + assignee from current leaders.
 * Used on insert and re-import update so previously uploaded jobs pick up new team leaders.
 */
function applyLeaderTeamToJob(job, teamIndex) {
  if (!job || !teamIndex?.length) return job;
  const rawName =
    job.engineer_name ||
    job._engineer_name ||
    job.leader_name ||
    (typeof job.team_name_hint === 'string' ? job.team_name_hint : null);
  if (!rawName || !String(rawName).trim()) return job;

  const hit = matchTeamFromLeaderIndex(teamIndex, rawName);
  if (!hit) return job;

  return {
    ...job,
    team_id: hit.team_id,
    field_engineer_id: hit.leader_user_id || job.field_engineer_id || null,
    assigned_user_id: hit.leader_user_id || job.assigned_user_id || null,
    _leader_resolved: hit.leader_name || null,
    _team_resolved: hit.team_name || null,
  };
}

module.exports = {
  TEAM_TYPES,
  ensureTeamsSchema,
  oilFlagForType,
  rolesForType,
  isValidTeamType,
  teamCountsForOil,
  bumpTeamOilCase,
  decrementTeamOilCase,
  normalizePersonName,
  loadTeamLeaderIndex,
  matchTeamFromLeaderIndex,
  applyLeaderTeamToJob,
};
