const express = require('express');
const pool    = require('../config/db');
const bcrypt  = require('bcryptjs');
const { auth, requireRole } = require('../middleware/auth');
const { notifyUserApproved } = require('../utils/accountNotifications');
const {
  TEAM_TYPES,
  ensureTeamsSchema,
  oilFlagForType,
  rolesForType,
  isValidTeamType,
} = require('../utils/teamsSchema');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

function userHasAnyRole(userRow, allowedRoles) {
  if (!userRow || !allowedRoles?.length) return false;
  const roles = new Set([userRow.role, ...(userRow.extra_roles || [])].filter(Boolean));
  return allowedRoles.some((r) => roles.has(r));
}

async function loadUserWithRoles(conn, userId) {
  const [[u]] = await conn.query(
    `SELECT u.id, u.full_name, u.role, u.team_id,
            GROUP_CONCAT(ur.role) AS roles_csv
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id, u.full_name, u.role, u.team_id`,
    [userId]
  );
  if (!u) return null;
  return {
    ...u,
    extra_roles: u.roles_csv ? u.roles_csv.split(',') : [],
  };
}

async function syncTeamMembers(conn, teamId, leaderUserId, memberIds = []) {
  const ids = new Set((memberIds || []).map((id) => Number(id)).filter(Boolean));
  if (leaderUserId) ids.add(Number(leaderUserId));

  // Clear leadership on other teams if this leader moves here
  if (leaderUserId) {
    await conn.query(
      'UPDATE teams SET leader_user_id = NULL WHERE leader_user_id = ? AND id <> ?',
      [leaderUserId, teamId]
    );
  }

  // Assign members to this team
  const idList = [...ids];
  if (idList.length) {
    await conn.query(
      `UPDATE users SET team_id = ? WHERE id IN (${idList.map(() => '?').join(',')})`,
      [teamId, ...idList]
    );
  }

  // Remove users who were on this team but not in the new member set
  if (idList.length) {
    await conn.query(
      `UPDATE users SET team_id = NULL
       WHERE team_id = ? AND id NOT IN (${idList.map(() => '?').join(',')})`,
      [teamId, ...idList]
    );
  } else {
    await conn.query('UPDATE users SET team_id = NULL WHERE team_id = ?', [teamId]);
  }
}

// ── GET /api/users — List all users (admin only) ───────────
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.status,
              u.team_id, t.team_name, u.profile_image, u.created_at, u.allow_late_time,
              u.last_active,
              (CASE WHEN u.last_active >= NOW() - INTERVAL 15 MINUTE THEN 1 ELSE 0 END) AS is_online,
              GROUP_CONCAT(ur.role ORDER BY ur.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN teams t      ON t.id = u.team_id
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       GROUP BY u.id, u.username, u.full_name, u.role, u.status, u.team_id, t.team_name, u.profile_image, u.created_at, u.allow_late_time, u.last_active
       ORDER BY u.created_at DESC`
    );
    res.json(rows.map((r) => ({ ...r, roles: r.roles_csv ? r.roles_csv.split(',') : [r.role] })));
  } catch (err) {
    console.error('GET /api/users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/teams — List all teams ──────────────────
router.get('/teams', auth, async (req, res) => {
  try {
    await ensureTeamsSchema(pool);
    const [rows] = await pool.query(
      `SELECT t.id, t.team_name, t.team_type, t.counts_for_oil, t.leader_user_id,
              t.vehicle_plate, t.is_active, t.notes,
              lu.full_name AS leader_name, lu.role AS leader_role,
              COUNT(u.id) AS member_count,
              GROUP_CONCAT(DISTINCT u.role) AS team_roles,
              GROUP_CONCAT(DISTINCT u.id ORDER BY u.full_name) AS member_ids_csv,
              GROUP_CONCAT(DISTINCT u.full_name ORDER BY u.full_name SEPARATOR '||') AS member_names_csv
       FROM teams t
       LEFT JOIN users u ON u.team_id = t.id
       LEFT JOIN users lu ON lu.id = t.leader_user_id
       GROUP BY t.id, t.team_name, t.team_type, t.counts_for_oil, t.leader_user_id,
                t.vehicle_plate, t.is_active, t.notes, lu.full_name, lu.role
       ORDER BY
         FIELD(t.team_type, 'office_install', 'office_ma', 'contractor_install', 'contractor_ma'),
         t.team_name`
    );
    res.json(
      rows.map((r) => {
        const memberIds = r.member_ids_csv
          ? String(r.member_ids_csv).split(',').map((id) => Number(id))
          : [];
        const memberNames = r.member_names_csv ? String(r.member_names_csv).split('||') : [];
        return {
          ...r,
          counts_for_oil: Number(r.counts_for_oil) === 1 ? 1 : 0,
          member_count: Number(r.member_count) || 0,
          member_ids: memberIds,
          members: memberIds.map((id, i) => ({ id, full_name: memberNames[i] || '' })),
          type_label: TEAM_TYPES[r.team_type]?.label || r.team_type,
          member_ids_csv: undefined,
          member_names_csv: undefined,
        };
      })
    );
  } catch (err) {
    console.error('GET /api/users/teams error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/users/team-types — Metadata for UI ─────────────
router.get('/team-types', auth, (req, res) => {
  res.json(
    Object.entries(TEAM_TYPES).map(([key, meta]) => ({
      value: key,
      label: meta.label,
      counts_for_oil: meta.counts_for_oil,
      roles: meta.roles,
    }))
  );
});

// ── POST /api/users/teams — Create a new team ──────────────────
router.post('/teams', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const {
    team_name,
    team_type = 'office_install',
    leader_user_id = null,
    member_ids = [],
    vehicle_plate = null,
    notes = null,
  } = req.body;

  if (!team_name || !String(team_name).trim()) {
    return res.status(400).json({ error: 'team_name is required' });
  }
  if (!isValidTeamType(team_type)) {
    return res.status(400).json({ error: 'invalid team_type' });
  }

  const conn = await pool.getConnection();
  try {
    await ensureTeamsSchema(conn);
    await conn.beginTransaction();

    const leaderId = leader_user_id ? Number(leader_user_id) : null;
    if (leaderId) {
      const leader = await loadUserWithRoles(conn, leaderId);
      if (!leader) {
        await conn.rollback();
        return res.status(400).json({ error: 'ไม่พบหัวหน้าทีมที่เลือก' });
      }
      if (!userHasAnyRole(leader, rolesForType(team_type))) {
        await conn.rollback();
        return res.status(400).json({
          error: `หัวหน้าทีมต้องเป็นบทบาท: ${rolesForType(team_type).join(', ')}`,
        });
      }
    }

    const countsForOil = oilFlagForType(team_type);
    const [result] = await conn.query(
      `INSERT INTO teams (team_name, team_type, leader_user_id, counts_for_oil, vehicle_plate, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(team_name).trim(),
        team_type,
        leaderId,
        countsForOil,
        vehicle_plate || null,
        notes || null,
      ]
    );
    const teamId = result.insertId;
    await syncTeamMembers(conn, teamId, leaderId, member_ids);

    await conn.commit();
    res.status(201).json({
      message: 'Team created',
      id: teamId,
      counts_for_oil: countsForOil,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Create team error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Team name already exists' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/users/teams/:id — Delete team ─────────────────
router.delete('/teams/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const teamId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await ensureTeamsSchema(conn);
    const [[cnt]] = await conn.query(
      'SELECT COUNT(*) AS c FROM users WHERE team_id = ?',
      [teamId]
    );
    if (cnt.c > 0) {
      return res.status(400).json({
        error: `ไม่สามารถลบทีมได้ เนื่องจากยังมีสมาชิก ${cnt.c} คน — กรุณาย้ายสมาชิกออกก่อน`,
      });
    }
    await conn.query('DELETE FROM teams WHERE id = ?', [teamId]);
    res.json({ message: 'Team deleted successfully' });
  } catch (err) {
    console.error('Delete team error:', err);
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({
        error: 'ไม่สามารถลบทีมได้ เนื่องจากยังถูกอ้างอิงในระบบ กรุณาย้ายงาน/สมาชิกก่อน',
      });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/users/teams/:id — Update team ────────────────────
router.put('/teams/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const teamId = Number(req.params.id);
  const {
    team_name,
    team_type,
    leader_user_id,
    member_ids,
    vehicle_plate,
    notes,
    is_active,
  } = req.body;

  if (team_name !== undefined && !String(team_name).trim()) {
    return res.status(400).json({ error: 'team_name is required' });
  }
  if (team_type !== undefined && !isValidTeamType(team_type)) {
    return res.status(400).json({ error: 'invalid team_type' });
  }

  const conn = await pool.getConnection();
  try {
    await ensureTeamsSchema(conn);
    await conn.beginTransaction();

    const [[existing]] = await conn.query('SELECT * FROM teams WHERE id = ? LIMIT 1', [teamId]);
    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบทีม' });
    }

    const nextType = team_type || existing.team_type || 'office_install';
    const nextName = team_name !== undefined ? String(team_name).trim() : existing.team_name;
    const nextLeader =
      leader_user_id !== undefined
        ? leader_user_id
          ? Number(leader_user_id)
          : null
        : existing.leader_user_id;
    const nextPlate =
      vehicle_plate !== undefined ? vehicle_plate || null : existing.vehicle_plate;
    const nextNotes = notes !== undefined ? notes || null : existing.notes;
    const nextActive =
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active ?? 1;
    const countsForOil = oilFlagForType(nextType);

    if (nextLeader) {
      const leader = await loadUserWithRoles(conn, nextLeader);
      if (!leader) {
        await conn.rollback();
        return res.status(400).json({ error: 'ไม่พบหัวหน้าทีมที่เลือก' });
      }
      if (!userHasAnyRole(leader, rolesForType(nextType))) {
        await conn.rollback();
        return res.status(400).json({
          error: `หัวหน้าทีมต้องเป็นบทบาท: ${rolesForType(nextType).join(', ')}`,
        });
      }
    }

    await conn.query(
      `UPDATE teams
       SET team_name = ?, team_type = ?, leader_user_id = ?, counts_for_oil = ?,
           vehicle_plate = ?, notes = ?, is_active = ?
       WHERE id = ?`,
      [nextName, nextType, nextLeader, countsForOil, nextPlate, nextNotes, nextActive, teamId]
    );

    if (member_ids !== undefined || leader_user_id !== undefined) {
      let nextMembers = member_ids;
      if (nextMembers === undefined) {
        const [cur] = await conn.query('SELECT id FROM users WHERE team_id = ?', [teamId]);
        nextMembers = cur.map((u) => u.id);
      }
      await syncTeamMembers(conn, teamId, nextLeader, nextMembers);
    }

    await conn.commit();
    res.json({ message: 'Team updated successfully', counts_for_oil: countsForOil });
  } catch (err) {
    await conn.rollback();
    console.error('Update team error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Team name already exists' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── POST /api/users — Create user ──────────────────────────
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  let { username, password, full_name, role = 'technician', status = 'approved', team_id, extra_roles = [], allow_late_time } = req.body;
  if (!allow_late_time) allow_late_time = '08:30:00';

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'username, password, full_name required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const hash = await bcrypt.hash(password, 10);
    const [result] = await conn.query(
      `INSERT INTO users (username, password_hash, full_name, role, status, team_id, allow_late_time)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, full_name, role, status, team_id || null, allow_late_time]
    );
    const userId = result.insertId;

    // Seed user_roles with primary + extra roles
    const allRoles = [...new Set([role, ...extra_roles])];
    for (const r of allRoles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'User created', id: userId });
  } catch (err) {
    await conn.rollback();
    console.error('Create user error:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── PUT /api/users/:id/roles — Update user's multi-roles ───
router.put('/:id/roles', auth, requireRole(['super_admin']), async (req, res) => {
  const { roles = [] } = req.body;
  const userId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const r of roles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }
    // Keep primary role in sync
    if (roles.length > 0) {
      await conn.query(`UPDATE users SET role = ? WHERE id = ?`, [roles[0], userId]);
    }
    await conn.commit();
    res.json({ message: 'Roles updated' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/users/:id — Update user details ──────────────
router.put('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  let { username, password, full_name, role, status, team_id, extra_roles = [], allow_late_time } = req.body;
  if (!allow_late_time) allow_late_time = '08:30:00';
  const userId = req.params.id;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[oldUser]] = await conn.query(
      'SELECT status, full_name FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    let query = 'UPDATE users SET username=?, full_name=?, role=?, status=?, team_id=?, allow_late_time=?';
    let params = [username, full_name, role, status, team_id || null, allow_late_time];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += ', password_hash=?';
      params.push(hash);
    }
    
    query += ' WHERE id=?';
    params.push(userId);

    await conn.query(query, params);

    // Update user_roles
    await conn.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    const allRoles = [...new Set([role, ...extra_roles])];
    for (const r of allRoles) {
      await conn.query(
        `INSERT IGNORE INTO user_roles (user_id, role) VALUES (?, ?)`, [userId, r]
      );
    }

    await conn.commit();

    if (status === 'approved' && oldUser?.status === 'pending') {
      notifyUserApproved({
        userId,
        userName: full_name || oldUser?.full_name || '',
        actorId: req.user?.id,
      }).catch((e) => console.error('notifyUserApproved:', e.message));
    }

    res.json({ message: 'User updated successfully' });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Username already exists' });
    }
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/users/:id — Delete user ───────────────────
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const userId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Delete child rows first
    await conn.query('DELETE FROM user_roles WHERE user_id = ?', [userId]);
    
    // Attempt to delete the user
    await conn.query('DELETE FROM users WHERE id = ?', [userId]);
    
    await conn.commit();
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete user error:', err);
    // Handle foreign key constraint error
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
      return res.status(400).json({ error: 'ไม่สามารถลบได้ เนื่องจากผู้ใช้นี้มีประวัติผูกกับข้อมูลอื่นแล้ว (เช่น ข้อมูลงาน หรือรายการน้ำมัน) แนะนำให้ไปที่แก้ไขแล้วเปลี่ยนสถานะเป็น "ระงับการใช้งาน" แทนครับ' });
    }
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── GET /api/users/settings/late_time — Get late times ─────
router.get('/settings/late_time', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'late_time%'`
    );
    const settings = rows.reduce((acc, row) => {
      acc[row.setting_key] = row.setting_value;
      return acc;
    }, {});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/users/settings/late_time — Update late times ───
router.put('/settings/late_time', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const settings = req.body; // e.g., { late_time: '08:30:00', late_time_technician: '09:00:00' }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const [key, value] of Object.entries(settings)) {
      if (key.startsWith('late_time')) {
        await conn.query(
          `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = ?`,
          [key, value, value]
        );
      }
    }
    await conn.commit();
    res.json({ message: 'Late times updated successfully' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
