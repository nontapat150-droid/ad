const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const {
  notifyInventoryDispatched,
  notifyInventoryTransferred,
} = require('../utils/inventoryNotifications');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

/** Backfill team_id on dispatched items from current owner (one-shot opportunistic). */
async function syncDispatchedItemTeams(db) {
  try {
    await db.query(
      `UPDATE inventory_items ii
       JOIN users u ON u.id = ii.owner_id
       SET ii.team_id = u.team_id
       WHERE ii.status = 'dispatched'
         AND u.team_id IS NOT NULL
         AND (ii.team_id IS NULL OR ii.team_id <> u.team_id)`
    );
  } catch (e) {
    /* ignore if schema missing team_id */
  }
}

/** SQL fragment: item is in personal bag OR shared team bag.
 * Pass teamId as a real id, or -1 when the user has no team (matches nothing).
 */
function bagAccessSql(alias = 'ii') {
  return `(
    ${alias}.owner_id = ?
    OR ${alias}.team_id = ?
    OR ${alias}.owner_id IN (SELECT id FROM users WHERE team_id = ?)
  )`;
}

function bagTeamParam(teamId) {
  const n = Number(teamId);
  return Number.isFinite(n) && n > 0 ? n : -1;
}

async function getUserTeamId(db, userId) {
  const [[u]] = await db.query('SELECT team_id FROM users WHERE id = ? LIMIT 1', [userId]);
  return u?.team_id || null;
}

/**
 * Merge duplicate no-SN dispatched rows for the same owner + model into one line
 * (e.g. 2000m + 1000m → one row with 3000).
 */
async function consolidateNoSnBagRows(db, { ownerId = null, teamId = null } = {}) {
  const teamParam = bagTeamParam(teamId);
  const params = [];
  let ownerFilter = '';
  if (ownerId != null) {
    ownerFilter = 'AND ii.owner_id = ?';
    params.push(ownerId);
  } else if (teamId != null && Number(teamId) > 0) {
    ownerFilter = `AND (
      ii.owner_id IN (SELECT id FROM users WHERE team_id = ?)
      OR ii.team_id = ?
    )`;
    params.push(teamParam, teamParam);
  } else {
    return;
  }

  const [groups] = await db.query(
    `SELECT ii.owner_id, ii.model_id,
            MIN(ii.id) AS keep_id,
            SUM(ii.quantity) AS total_qty,
            COUNT(*) AS cnt
     FROM inventory_items ii
     JOIN inventory_models pm ON pm.id = ii.model_id
     JOIN inventory_products p ON p.id = pm.product_id
     WHERE ii.status = 'dispatched'
       AND p.has_sn = 0
       AND (ii.expires_at IS NULL OR ii.expires_at > NOW())
       ${ownerFilter}
     GROUP BY ii.owner_id, ii.model_id
     HAVING COUNT(*) > 1`,
    params
  );

  for (const g of groups) {
    await db.query(
      'UPDATE inventory_items SET quantity = ? WHERE id = ?',
      [g.total_qty, g.keep_id]
    );
    await db.query(
      `UPDATE inventory_items
       SET status = 'used', quantity = 0, owner_id = NULL, team_id = NULL
       WHERE owner_id = ? AND model_id = ? AND status = 'dispatched' AND id <> ?
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [g.owner_id, g.model_id, g.keep_id]
    );
  }
}

function formatBagQty(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 100) / 100);
}

/**
 * For shared team bags: collapse no-SN rows of the same model into one display line
 * with total quantity + holders breakdown (who holds how much).
 * SN items stay as separate rows.
 */
function aggregateTeamNoSnBag(items, { poolByTeam }) {
  const normalized = items.map((row) => ({
    ...row,
    product_id: row.product_id != null ? Number(row.product_id) : null,
    has_sn: Number(row.has_sn) ? 1 : 0,
    quantity: Number(row.quantity) || 0,
    product_name: row.product_name || 'สินค้า',
    model_name: row.model_name || '-',
    sn: row.sn || '',
    unit: row.unit || 'ชิ้น',
  }));

  if (!poolByTeam) {
    return normalized.map((row) => ({
      ...row,
      is_team_pooled: false,
      holders: row.owner_id
        ? [{
            item_id: row.id,
            owner_id: row.owner_id,
            owner_name: row.owner_name || 'ไม่ระบุ',
            quantity: row.quantity,
            unit: row.unit,
          }]
        : [],
    }));
  }

  const snItems = [];
  const byModel = new Map();

  for (const row of normalized) {
    if (row.has_sn) {
      snItems.push({
        ...row,
        is_team_pooled: false,
        holders: [{
          item_id: row.id,
          owner_id: row.owner_id,
          owner_name: row.owner_name || 'ไม่ระบุ',
          quantity: row.quantity,
          unit: row.unit,
        }],
      });
      continue;
    }

    const key = String(row.model_id);
    if (!byModel.has(key)) {
      byModel.set(key, {
        ...row,
        quantity: 0,
        is_team_pooled: true,
        holders: [],
        sn: '',
      });
    }
    const group = byModel.get(key);
    group.quantity += row.quantity;
    group.holders.push({
      item_id: row.id,
      owner_id: row.owner_id,
      owner_name: row.owner_name || 'ไม่ระบุ',
      quantity: row.quantity,
      unit: row.unit,
    });
    if (
      row.dispatched_at &&
      (!group.dispatched_at || new Date(row.dispatched_at) < new Date(group.dispatched_at))
    ) {
      group.dispatched_at = row.dispatched_at;
    }
  }

  const pooled = [...byModel.values()].map((group) => {
    // Merge same owner into one holder line
    const byOwner = new Map();
    for (const h of group.holders) {
      const ok = String(h.owner_id ?? 'none');
      if (!byOwner.has(ok)) {
        byOwner.set(ok, { ...h });
      } else {
        byOwner.get(ok).quantity += h.quantity;
        // keep lowest item_id as canonical for that owner
        if (h.item_id < byOwner.get(ok).item_id) {
          byOwner.get(ok).item_id = h.item_id;
        }
      }
    }
    group.holders = [...byOwner.values()].sort((a, b) => b.quantity - a.quantity);
    const primary = group.holders[0];
    if (primary) {
      group.id = primary.item_id;
      group.owner_id = primary.owner_id;
    }
    group.sn = group.model_name || 'รวมทีม';
    if (group.holders.length <= 1) {
      group.owner_name = primary?.owner_name || group.owner_name;
      group.is_team_pooled = group.holders.length > 0;
    } else {
      group.owner_name = group.holders
        .map((h) => `${h.owner_name} ${formatBagQty(h.quantity)}${group.unit ? ` ${group.unit}` : ''}`)
        .join(' · ');
    }
    return group;
  });

  return [...pooled, ...snItems];
}

/**
 * Deduct no-SN quantity from a bag item, spilling over to other same-model
 * rows in the shared team bag when needed (A 3000 + B 1000 → use 3500 OK).
 * Returns { product_name, model_name, unit, deductions: [{item_id, qty}] }
 */
async function deductNoSnAcrossTeamBag(conn, {
  itemId,
  quantity,
  bagOwnerId,
  teamId,
  actorId,
  note,
}) {
  const qtyNeeded = parseFloat(quantity);
  if (!itemId || !(qtyNeeded > 0)) {
    throw new Error('จำนวนไม่ถูกต้อง');
  }

  const teamParam = bagTeamParam(teamId);
  const [[seed]] = await conn.query(
    `SELECT ii.*, p.name AS product_name, p.has_sn, p.unit, m.model_name
     FROM inventory_items ii
     JOIN inventory_models m ON ii.model_id = m.id
     JOIN inventory_products p ON m.product_id = p.id
     WHERE ii.id = ? AND ii.status = 'dispatched'
       AND (ii.expires_at IS NULL OR ii.expires_at > NOW())
       AND ${bagAccessSql('ii')}
     FOR UPDATE`,
    [itemId, bagOwnerId, teamParam, teamParam]
  );
  if (!seed) {
    throw new Error('ไม่พบสินค้าในกระเป๋าทีม — อาจยังไม่ได้เบิกจากคลัง หรือถูกใช้ไปแล้ว');
  }

  const rows = [seed];
  if (!Number(seed.has_sn)) {
    const [more] = await conn.query(
      `SELECT ii.*, p.name AS product_name, p.has_sn, p.unit, m.model_name
       FROM inventory_items ii
       JOIN inventory_models m ON ii.model_id = m.id
       JOIN inventory_products p ON m.product_id = p.id
       WHERE ii.status = 'dispatched'
         AND ii.model_id = ?
         AND ii.id <> ?
         AND p.has_sn = 0
         AND (ii.expires_at IS NULL OR ii.expires_at > NOW())
         AND ${bagAccessSql('ii')}
       ORDER BY ii.id ASC
       FOR UPDATE`,
      [seed.model_id, itemId, bagOwnerId, teamParam, teamParam]
    );
    rows.push(...more);
  }

  const totalAvail = rows.reduce((s, r) => s + (parseFloat(r.quantity) || 0), 0);
  if (totalAvail < qtyNeeded) {
    throw new Error(
      `สินค้า "${seed.product_name}" ไม่พอในกระเป๋า (ต้องการ ${qtyNeeded} คงเหลือ ${totalAvail})`
    );
  }

  let remaining = qtyNeeded;
  const deductions = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const have = parseFloat(row.quantity) || 0;
    if (have <= 0) continue;
    const take = Math.min(have, remaining);
    if (take >= have) {
      await conn.query(
        `UPDATE inventory_items SET status = 'used', quantity = 0 WHERE id = ?`,
        [row.id]
      );
    } else {
      await conn.query(
        `UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?`,
        [take, row.id]
      );
    }
    await conn.query(
      `INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note)
       VALUES (?, ?, 'used', ?, ?)`,
      [row.id, actorId || bagOwnerId, take, note || null]
    );
    deductions.push({ item_id: row.id, qty: take, sn: row.sn });
    remaining -= take;
  }

  return {
    product_name: seed.product_name,
    model_name: seed.model_name || '-',
    unit: seed.unit || 'ชิ้น',
    sn: seed.sn,
    deductions,
    quantity: qtyNeeded,
  };
}

// ==========================================
// PHASE 1: ADMIN - PRODUCTS & MODELS
// ==========================================

// ── GET /api/inventory/products ──
router.get('/products', auth, async (req, res) => {
  try {
    const [products] = await pool.query('SELECT * FROM inventory_products ORDER BY name ASC');
    const [models] = await pool.query('SELECT * FROM inventory_models ORDER BY model_name ASC');
    
    // Attach models to products
    const productsWithModels = products.map(p => ({
      ...p,
      models: models.filter(m => m.product_id === p.id)
    }));

    res.json(productsWithModels);
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── GET /api/inventory/categories ──
router.get('/categories', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT category_name AS name, image_url 
      FROM inventory_category_metadata
      UNION
      SELECT DISTINCT category AS name, NULL AS image_url
      FROM inventory_products 
      WHERE category IS NOT NULL AND category != ""
        AND category NOT IN (SELECT category_name FROM inventory_category_metadata)
      ORDER BY name ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.post('/categories', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
  try {
    await pool.query(
      `INSERT INTO inventory_category_metadata (category_name) VALUES (?)`,
      [name.trim()]
    );
    res.json({ message: 'Category created' });
  } catch (err) {
    console.error('Create category error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.put('/categories/:name', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const oldName = req.params.name;
  const { new_name } = req.body;
  if (!new_name || !new_name.trim()) return res.status(400).json({ error: 'New name is required' });
  
  try {
    await pool.query('START TRANSACTION');
    // Update metadata
    await pool.query(
      `UPDATE inventory_category_metadata SET category_name = ? WHERE category_name = ?`,
      [new_name.trim(), oldName]
    );
    // Update products
    await pool.query(
      `UPDATE inventory_products SET category = ? WHERE category = ?`,
      [new_name.trim(), oldName]
    );
    await pool.query('COMMIT');
    res.json({ message: 'Category renamed successfully' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Rename category error:', err);
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'ชื่อหมวดหมู่ใหม่ซ้ำกับที่มีอยู่แล้ว' });
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

router.delete('/categories/:name', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const categoryName = req.params.name;
  try {
    await pool.query('START TRANSACTION');
    // Delete metadata
    await pool.query(
      `DELETE FROM inventory_category_metadata WHERE category_name = ?`,
      [categoryName]
    );
    // Remove from products
    await pool.query(
      `UPDATE inventory_products SET category = NULL WHERE category = ?`,
      [categoryName]
    );
    await pool.query('COMMIT');
    res.json({ message: 'Category deleted' });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Delete category error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── PUT /api/inventory/categories/:name/image ──
router.put('/categories/:name/image', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const categoryName = req.params.name;
  const { image_url } = req.body;
  try {
    await pool.query(
      `INSERT INTO inventory_category_metadata (category_name, image_url) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE image_url = VALUES(image_url)`,
      [categoryName, image_url]
    );
    res.json({ message: 'Category image updated' });
  } catch (err) {
    console.error('Update category image error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── POST /api/inventory/products ──
router.post('/products', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { name, has_sn, unit, pieces_per_crate, crate_unit, category, image_url } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Product name is required' });
  }

  try {
    const ppc = (pieces_per_crate && parseInt(pieces_per_crate) > 0) ? parseInt(pieces_per_crate) : null;
    const cu = crate_unit || 'ลัง';
    const [result] = await pool.query(
      'INSERT INTO inventory_products (name, has_sn, unit, pieces_per_crate, crate_unit, category, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, has_sn ? 1 : 0, unit || 'ชิ้น', ppc, cu, category || null, image_url || null]
    );
    res.json({ message: 'Product created', id: result.insertId });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── PUT /api/inventory/products/:id — Update unit / pieces_per_crate / category / image_url ──
router.put('/products/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { unit, pieces_per_crate, crate_unit, category, image_url } = req.body;
  const productId = req.params.id;

  if (!unit && pieces_per_crate === undefined && crate_unit === undefined && category === undefined && image_url === undefined) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const updates = [];
    const values = [];

    if (unit) {
      updates.push('unit = ?');
      values.push(unit);
    }
    if (pieces_per_crate !== undefined) {
      updates.push('pieces_per_crate = ?');
      values.push(pieces_per_crate ? parseInt(pieces_per_crate) : null);
    }
    if (crate_unit !== undefined) {
      updates.push('crate_unit = ?');
      values.push(crate_unit || 'ลัง');
    }
    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category || null);
    }
    if (image_url !== undefined) {
      updates.push('image_url = ?');
      values.push(image_url || null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(productId);
    await pool.query(`UPDATE inventory_products SET ${updates.join(', ')} WHERE id = ?`, values);
    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});// ── PUT /api/inventory/products/:id/rename ──
// Rename a product and merge if the new name exists
router.put('/products/:id/rename', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const sourceProductId = req.params.id;
  const { new_name } = req.body;
  if (!new_name || new_name.trim() === '') {
    return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้าใหม่' });
  }

  const newNameStr = new_name.trim();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Check if source product exists
    const [[sourceProduct]] = await conn.query('SELECT * FROM inventory_products WHERE id = ? FOR UPDATE', [sourceProductId]);
    if (!sourceProduct) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้าต้นทาง' });
    }

    if (sourceProduct.name.toLowerCase() === newNameStr.toLowerCase()) {
      // Just fix casing if it's the exact same name but different case
      await conn.query('UPDATE inventory_products SET name = ? WHERE id = ?', [newNameStr, sourceProductId]);
      await conn.commit();
      return res.json({ message: 'เปลี่ยนชื่อสินค้าเรียบร้อยแล้ว' });
    }

    // 2. Check if new name already exists
    const [[targetProduct]] = await conn.query('SELECT * FROM inventory_products WHERE name = ?', [newNameStr]);

    if (!targetProduct) {
      // CASE 1: No duplicate name, just rename
      await conn.query('UPDATE inventory_products SET name = ? WHERE id = ?', [newNameStr, sourceProductId]);
      await conn.commit();
      return res.json({ message: 'เปลี่ยนชื่อสินค้าเรียบร้อยแล้ว' });
    }

    // CASE 2: Duplicate name exists, must merge
    if (sourceProduct.has_sn !== targetProduct.has_sn) {
      await conn.rollback();
      return res.status(400).json({ error: 'ไม่สามารถรวมสินค้าได้เนื่องจากประเภท (การเก็บ Serial Number) ไม่ตรงกัน' });
    }

    // Process models of the source product
    const [sourceModels] = await conn.query('SELECT * FROM inventory_models WHERE product_id = ?', [sourceProductId]);
    const [targetModels] = await conn.query('SELECT * FROM inventory_models WHERE product_id = ?', [targetProduct.id]);

    for (const sModel of sourceModels) {
      // Find if a model with same name exists in target product
      const matchingTModel = targetModels.find(tm => tm.model_name.toLowerCase() === sModel.model_name.toLowerCase());

      if (matchingTModel) {
        // Merge items: update inventory_items to point to matchingTModel.id instead of sModel.id
        await conn.query('UPDATE inventory_items SET model_id = ? WHERE model_id = ?', [matchingTModel.id, sModel.id]);
        // Delete source model
        await conn.query('DELETE FROM inventory_models WHERE id = ?', [sModel.id]);
      } else {
        // Move model to target product
        await conn.query('UPDATE inventory_models SET product_id = ? WHERE id = ?', [targetProduct.id, sModel.id]);
      }
    }

    // Finally delete source product
    await conn.query('DELETE FROM inventory_products WHERE id = ?', [sourceProductId]);

    await conn.commit();
    res.json({ message: 'รวมข้อมูลสินค้าเข้ากับชื่อที่มีอยู่แล้วเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Rename Product Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/inventory/models ──
router.post('/models', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { product_id, model_name, image_url } = req.body;
  if (!product_id || !model_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const [result] = await pool.query(
      'INSERT INTO inventory_models (product_id, model_name, image_url) VALUES (?, ?, ?)',
      [product_id, model_name, image_url || null]
    );
    res.json({ message: 'Model created', id: result.insertId });
  } catch (err) {
    console.error('Add model error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── PUT /api/inventory/models/:id ──
router.put('/models/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const modelId = req.params.id;
  const { model_name, image_url, product_id } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (product_id !== undefined) {
      // Get current model and its product
      const [[currentModel]] = await conn.query('SELECT m.*, p.has_sn FROM inventory_models m JOIN inventory_products p ON m.product_id = p.id WHERE m.id = ?', [modelId]);
      if (!currentModel) {
        await conn.rollback();
        return res.status(404).json({ error: 'Model not found' });
      }

      // Check if moving to a different product
      if (currentModel.product_id != product_id) {
        // Get target product
        const [[targetProduct]] = await conn.query('SELECT * FROM inventory_products WHERE id = ?', [product_id]);
        if (!targetProduct) {
          await conn.rollback();
          return res.status(404).json({ error: 'Target product not found' });
        }

        if (currentModel.has_sn !== targetProduct.has_sn) {
          await conn.rollback();
          return res.status(400).json({ error: 'ไม่สามารถย้ายโมเดลไปยังสินค้าที่มีประเภท (การเก็บ Serial Number) แตกต่างกันได้' });
        }
      }
    }

    const updates = [];
    const params = [];
    if (model_name !== undefined) {
      updates.push('model_name = ?');
      params.push(model_name);
    }
    if (image_url !== undefined) {
      updates.push('image_url = ?');
      params.push(image_url);
    }
    if (product_id !== undefined) {
      updates.push('product_id = ?');
      params.push(product_id);
    }
    
    if (updates.length === 0) {
      await conn.rollback();
      return res.json({ message: 'No changes' });
    }

    params.push(modelId);
    await conn.query(`UPDATE inventory_models SET ${updates.join(', ')} WHERE id = ?`, params);
    
    await conn.commit();
    res.json({ message: 'Model updated' });
  } catch (err) {
    await conn.rollback();
    console.error('Update model error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/inventory/products/:id ──
router.delete('/products/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const productId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Forcefully delete all logs associated with items of this product
    await conn.query(`
      DELETE il FROM inventory_logs il
      JOIN inventory_items ii ON il.item_id = ii.id
      JOIN inventory_models im ON ii.model_id = im.id
      WHERE im.product_id = ?
    `, [productId]);

    // Forcefully delete all items of this product
    await conn.query(`
      DELETE ii FROM inventory_items ii
      JOIN inventory_models im ON ii.model_id = im.id
      WHERE im.product_id = ?
    `, [productId]);

    // Delete models and product
    await conn.query('DELETE FROM inventory_models WHERE product_id = ?', [productId]);
    await conn.query('DELETE FROM inventory_products WHERE id = ?', [productId]);

    await conn.commit();
    res.json({ message: 'ลบสินค้าและโมเดลเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete Product Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/inventory/receive ──
router.post('/receive', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { model_id, sn, phone_number, quantity = 1, is_auto_generate, generate_count = 1 } = req.body;
  if (!model_id) return res.status(400).json({ error: 'model_id is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get product info
    const [[model]] = await conn.query(
      'SELECT m.*, p.has_sn FROM inventory_models m JOIN inventory_products p ON m.product_id = p.id WHERE m.id = ?',
      [model_id]
    );

    if (!model) {
      await conn.rollback();
      return res.status(404).json({ error: 'Model not found' });
    }

    const adminId = req.user.id;
    let itemsAdded = 0;

    if (model.has_sn) {
      // SN Mode: SN must be provided
      if (!sn) {
        await conn.rollback();
        return res.status(400).json({ error: 'SN is required for this product' });
      }
      
      const [result] = await conn.query(
        'INSERT INTO inventory_items (model_id, sn, phone_number, quantity, status) VALUES (?, ?, ?, ?, "in_stock")',
        [model_id, sn, phone_number || null, 1.00]
      );
      
      await conn.query(
        'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity) VALUES (?, ?, "receive", ?)',
        [result.insertId, adminId, 1.00]
      );
      itemsAdded = 1;

    } else {
      // No-SN Mode
      if (is_auto_generate) {
        const prefix = model.prefix || 'ITEM';
        for (let i = 0; i < generate_count; i++) {
          // Generate unique code using timestamp and random number
          const uniqueCode = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const [result] = await conn.query(
            'INSERT INTO inventory_items (model_id, sn, phone_number, quantity, status) VALUES (?, ?, ?, ?, "in_stock")',
            [model_id, uniqueCode, phone_number || null, quantity] // For No-SN, we allow specifying bulk quantity (e.g. 100 meters)
          );
          await conn.query(
            'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity) VALUES (?, ?, "receive", ?)',
            [result.insertId, adminId, quantity]
          );
          itemsAdded++;
        }
      } else {
        // Manual code provided for No-SN bulk item
        if (!sn) {
          await conn.rollback();
          return res.status(400).json({ error: 'Code/SN is required' });
        }
        const [result] = await conn.query(
          'INSERT INTO inventory_items (model_id, sn, phone_number, quantity, status) VALUES (?, ?, ?, ?, "in_stock")',
          [model_id, sn, phone_number || null, quantity]
        );
        await conn.query(
          'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity) VALUES (?, ?, "receive", ?)',
          [result.insertId, adminId, quantity]
        );
        itemsAdded = 1;
      }
    }

    await conn.commit();
    res.json({ message: `Successfully received ${itemsAdded} item(s) into stock.` });
  } catch (err) {
    await conn.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'This SN / Code already exists in the system.' });
    }
    console.error('Receive inventory error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ==========================================
// PHASE 2: DISPATCH TO TECHNICIANS
// ==========================================

// ── GET /api/inventory/search-sn/:sn ──
router.get('/search-sn/:sn', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.has_sn, p.unit, p.pieces_per_crate, p.crate_unit
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.sn = ? AND ii.status = 'in_stock'`,
      [req.params.sn]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสินค้านี้ หรือสินค้าไม่ได้อยู่ในสถานะ In Stock' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/inventory/dispatch ──
// No-SN items: if the tech already has the same model in bag, add quantity into that row.
router.post('/dispatch', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { items, target_user_id } = req.body;
  if (!items || !items.length || !target_user_id) {
    return res.status(400).json({ error: 'Missing required data (items or target_user_id)' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[user]] = await conn.query('SELECT team_id FROM users WHERE id = ?', [target_user_id]);
    const team_id = user ? user.team_id : null;

    const adminId = req.user.id;
    let dispatchedCount = 0;
    const mergeNotes = [];
    const dispatchLabels = [];

    for (const item of items) {
      const [[dbItem]] = await conn.query(
        `SELECT ii.id, ii.model_id, ii.sn, ii.quantity, p.has_sn, p.name AS product_name, pm.model_name
         FROM inventory_items ii
         JOIN inventory_models pm ON pm.id = ii.model_id
         JOIN inventory_products p ON p.id = pm.product_id
         WHERE ii.id = ? AND ii.status = 'in_stock'
         FOR UPDATE`,
        [item.id]
      );
      if (!dbItem) continue;

      const stockQty = parseFloat(dbItem.quantity) || 0;
      let dispatchQty = parseFloat(item.quantity_to_dispatch);
      if (isNaN(dispatchQty) || dispatchQty <= 0 || dispatchQty > stockQty) {
        dispatchQty = stockQty;
      }
      if (dispatchQty <= 0) continue;

      const isNoSn = !Number(dbItem.has_sn);

      if (isNoSn) {
        // Find existing bag row(s) for this tech + same model (no-SN merges by model)
        const [bagRows] = await conn.query(
          `SELECT id, quantity FROM inventory_items
           WHERE owner_id = ? AND model_id = ? AND status = 'dispatched'
             AND (expires_at IS NULL OR expires_at > NOW())
           ORDER BY id ASC
           FOR UPDATE`,
          [target_user_id, dbItem.model_id]
        );

        if (bagRows.length > 0) {
          // Deduct / consume warehouse stock, then merge into bag
          if (dispatchQty < stockQty) {
            await conn.query(
              'UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?',
              [dispatchQty, item.id]
            );
          } else {
            await conn.query(
              `UPDATE inventory_items
               SET status = 'used', quantity = 0, owner_id = NULL, team_id = NULL, dispatched_at = NULL
               WHERE id = ?`,
              [item.id]
            );
          }

          const keepId = bagRows[0].id;
          let extraFromDupes = 0;
          for (let i = 1; i < bagRows.length; i++) {
            extraFromDupes += parseFloat(bagRows[i].quantity) || 0;
            await conn.query(
              `UPDATE inventory_items
               SET status = 'used', quantity = 0, owner_id = NULL, team_id = NULL
               WHERE id = ?`,
              [bagRows[i].id]
            );
          }
          const addQty = dispatchQty + extraFromDupes;
          await conn.query(
            `UPDATE inventory_items
             SET quantity = quantity + ?, team_id = COALESCE(?, team_id), dispatched_at = NOW()
             WHERE id = ?`,
            [addQty, team_id, keepId]
          );
          await conn.query(
            `INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity, note)
             VALUES (?, ?, ?, 'dispatch', ?, ?)`,
            [
              keepId,
              adminId,
              target_user_id,
              dispatchQty,
              `รวมเข้าของเดิมในกระเป๋า (+${dispatchQty}${extraFromDupes ? `, รวมแถวซ้ำ +${extraFromDupes}` : ''})`,
            ]
          );
          const [[after]] = await conn.query(
            'SELECT quantity FROM inventory_items WHERE id = ?',
            [keepId]
          );
          mergeNotes.push(
            `${dbItem.product_name || 'สินค้า'} ${dbItem.model_name || ''} รวมแล้วคงเหลือ ${Number(after?.quantity) || '?'}`.trim()
          );
        } else if (dispatchQty < stockQty) {
          // First time — partial: leave remainder in stock, create bag row
          await conn.query(
            'UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?',
            [dispatchQty, item.id]
          );
          const splitSn = `${dbItem.sn || 'NOSN'}-D-${Date.now().toString().slice(-6)}`;
          const [insertRes] = await conn.query(
            `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at)
             VALUES (?, ?, ?, 'dispatched', ?, ?, NOW())`,
            [dbItem.model_id, splitSn, dispatchQty, target_user_id, team_id]
          );
          await conn.query(
            `INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity)
             VALUES (?, ?, ?, 'dispatch', ?)`,
            [insertRes.insertId, adminId, target_user_id, dispatchQty]
          );
        } else {
          // First time — whole stock row becomes the bag row (keeps unique SN)
          await conn.query(
            `UPDATE inventory_items
             SET status = 'dispatched', owner_id = ?, team_id = ?, dispatched_at = NOW()
             WHERE id = ?`,
            [target_user_id, team_id, item.id]
          );
          await conn.query(
            `INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity)
             VALUES (?, ?, ?, 'dispatch', ?)`,
            [item.id, adminId, target_user_id, dispatchQty]
          );
        }
      } else {
        // SN items — keep separate rows (unique SN)
        if (dispatchQty < stockQty) {
          await conn.query(
            'UPDATE inventory_items SET quantity = quantity - ? WHERE id = ?',
            [dispatchQty, item.id]
          );
          const [insertRes] = await conn.query(
            `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at)
             VALUES (?, ?, ?, 'dispatched', ?, ?, NOW())`,
            [dbItem.model_id, dbItem.sn, dispatchQty, target_user_id, team_id]
          );
          await conn.query(
            `INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity)
             VALUES (?, ?, ?, 'dispatch', ?)`,
            [insertRes.insertId, adminId, target_user_id, dispatchQty]
          );
        } else {
          await conn.query(
            `UPDATE inventory_items
             SET status = 'dispatched', owner_id = ?, team_id = ?, dispatched_at = NOW()
             WHERE id = ?`,
            [target_user_id, team_id, item.id]
          );
          await conn.query(
            `INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity)
             VALUES (?, ?, ?, 'dispatch', ?)`,
            [item.id, adminId, target_user_id, dispatchQty]
          );
        }
      }

      dispatchedCount++;
      const label = `${dbItem.product_name || 'สินค้า'}${dbItem.model_name ? ` ${dbItem.model_name}` : ''}`.trim();
      if (label) dispatchLabels.push(label);
    }

    await conn.commit();

    if (dispatchedCount > 0) {
      const [[targetUser]] = await pool.query(
        'SELECT full_name FROM users WHERE id = ? LIMIT 1',
        [target_user_id]
      );
      notifyInventoryDispatched({
        targetUserId: target_user_id,
        targetUserName: targetUser?.full_name || 'ช่าง',
        teamId: team_id,
        itemCount: dispatchedCount,
        itemLabels: dispatchLabels,
        actorId: adminId,
        batchId: `${target_user_id}:${Date.now()}`,
      }).catch((e) => console.error('notifyInventoryDispatched:', e.message));
    }

    res.json({
      message: `เบิกสำเร็จ ${dispatchedCount} รายการ` +
        (mergeNotes.length ? ` · รวมของเดิม: ${mergeNotes.join(', ')}` : ''),
      dispatchedCount,
      merged: mergeNotes,
    });
  } catch (err) {
    await conn.rollback();
    console.error('Dispatch Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  } finally {
    conn.release();
  }
});

// ==========================================
// PHASE 3: TECH BAG & TRANSFERS
// ==========================================

// ── GET /api/inventory/my-bag ──
// Team members share one bag: returns all dispatched items for the team.
// Query: ?user_id= / ?team_id=
router.get('/my-bag', auth, async (req, res) => {
  const viewerId = req.user.id;
  const requestedId = parseInt(req.query.user_id || viewerId, 10) || viewerId;
  const requestedTeamId = req.query.team_id != null && req.query.team_id !== ''
    ? parseInt(req.query.team_id, 10)
    : null;

  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

  try {
    await syncDispatchedItemTeams(pool);

    const viewerTeamId = await getUserTeamId(pool, viewerId);
    let scopeUserId = viewerId;
    let scopeTeamId = viewerTeamId;

    if (requestedTeamId && Number.isFinite(requestedTeamId)) {
      if (!isAdmin && Number(viewerTeamId) !== Number(requestedTeamId)) {
        return res.status(403).json({
          error: 'ดูกระเป๋าได้เฉพาะทีมของตัวเองเท่านั้น',
          tip: 'หากต้องการดูกระเป๋าทีมอื่น ให้แจ้งแอดมิน',
        });
      }
      scopeTeamId = requestedTeamId;
      // Keep viewer as scope user so personal items without team_id still show for techs
      scopeUserId = isAdmin ? viewerId : viewerId;
    } else if (requestedId !== viewerId) {
      const targetTeamId = await getUserTeamId(pool, requestedId);
      if (!isAdmin) {
        if (!viewerTeamId || !targetTeamId || Number(viewerTeamId) !== Number(targetTeamId)) {
          return res.status(403).json({
            error: 'ดูกระเป๋าได้เฉพาะของตัวเองหรือทีมเดียวกันเท่านั้น',
            tip: 'หากต้องการดูกระเป๋าคนอื่นนอกทีม ให้แจ้งแอดมิน',
          });
        }
      }
      scopeUserId = requestedId;
      scopeTeamId = targetTeamId || viewerTeamId;
    }

    const teamParam = bagTeamParam(scopeTeamId);
    // Fold duplicate no-SN lines (same owner + model) so bag shows one remaining total
    try {
      if (scopeTeamId) {
        await consolidateNoSnBagRows(pool, { teamId: scopeTeamId });
      } else {
        await consolidateNoSnBagRows(pool, { ownerId: scopeUserId });
      }
    } catch (e) {
      console.warn('consolidateNoSnBagRows:', e.message);
    }

    const [items] = await pool.query(
      `SELECT ii.id, ii.model_id, ii.sn, ii.quantity, ii.status, ii.owner_id, ii.team_id,
              ii.dispatched_at, ii.expires_at,
              pm.model_name,
              p.id AS product_id,
              p.name AS product_name,
              p.has_sn,
              p.unit,
              u.full_name AS owner_name
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       LEFT JOIN users u ON u.id = ii.owner_id
       WHERE ii.status = 'dispatched'
         AND (ii.expires_at IS NULL OR ii.expires_at > NOW())
         AND ${bagAccessSql('ii')}
       ORDER BY ii.dispatched_at DESC`,
      [scopeUserId, teamParam, teamParam]
    );

    // Normalize + pool no-SN by model when team shares one bag
    const poolByTeam = Boolean(scopeTeamId && Number(scopeTeamId) > 0);
    const normalized = aggregateTeamNoSnBag(items, { poolByTeam });

    res.json(normalized);
  } catch (err) {
    console.error('My Bag Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── GET /api/inventory/contractor-summary ──
// สรุปอุปกรณ์ที่ช่างรับเหมาใช้ตอนจบงาน (รายคน / ทั้งหมด + กรองวันที่)
// รวมทั้งงานติดตั้ง (job_used_inventory) และงาน MA (ma_job_used_inventory)
router.get('/contractor-summary', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    // Ensure MA usage table exists (created on first MA complete otherwise)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ma_job_used_inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ma_job_id INT NOT NULL,
          inventory_item_id INT NOT NULL,
          device_role VARCHAR(50) DEFAULT 'NoSN',
          sn VARCHAR(255) DEFAULT NULL,
          product_name VARCHAR(255) DEFAULT NULL,
          model_name VARCHAR(255) DEFAULT NULL,
          quantity DECIMAL(10,2) DEFAULT 1.00,
          used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          used_by INT DEFAULT NULL,
          KEY idx_mjui_job (ma_job_id),
          KEY idx_mjui_item (inventory_item_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    } catch (_) { /* ignore */ }

    const { user_id: filterUserId, start_date, end_date, month } = req.query;

    const contractorWhere = `
      u.status = 'approved'
      AND (
        u.role IN ('contractor_office', 'contractor_ma')
        OR u.id IN (
          SELECT user_id FROM user_roles
          WHERE role IN ('contractor_office', 'contractor_ma')
        )
      )
    `;

    const [contractors] = await pool.query(
      `SELECT u.id, u.username, u.full_name, u.role, u.team_id,
              GROUP_CONCAT(DISTINCT ur.role SEPARATOR ',') AS roles_csv
       FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE ${contractorWhere}
       GROUP BY u.id
       ORDER BY u.full_name ASC`
    );

    const contractorIds = contractors.map((c) => c.id);
    if (contractorIds.length === 0) {
      return res.json({
        contractors: [],
        summary: { total_items: 0, total_jobs: 0, contractor_count: 0, total_qty: 0 },
        by_person: [],
        usages: [],
      });
    }

    const roleLabel = (role) =>
      role === 'contractor_ma' ? 'รับเหมา MA'
        : role === 'contractor_office' ? 'รับเหมาติดตั้ง'
          : role || 'รับเหมา';

    const contractorsOut = contractors.map((c) => {
      const roles = c.roles_csv ? c.roles_csv.split(',') : [c.role];
      const main = roles.find((r) => ['contractor_office', 'contractor_ma'].includes(r)) || c.role;
      return {
        id: c.id,
        username: c.username,
        full_name: c.full_name,
        role: main,
        role_display: roleLabel(main),
      };
    });
    const contractorRoleMap = Object.fromEntries(contractorsOut.map((c) => [c.id, c]));

    // Shared filters applied to both office + MA usage tables
    const buildDateConds = (alias) => {
      const conds = [];
      const vals = [];
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        conds.push(`DATE_FORMAT(${alias}.used_at, '%Y-%m') = ?`);
        vals.push(month);
      } else {
        if (start_date) {
          conds.push(`DATE(${alias}.used_at) >= ?`);
          vals.push(start_date);
        }
        if (end_date) {
          conds.push(`DATE(${alias}.used_at) <= ?`);
          vals.push(end_date);
        }
      }
      return { conds, vals };
    };

    const userFilterIds =
      filterUserId && filterUserId !== 'ALL' ? [Number(filterUserId)] : contractorIds;

    const officeDate = buildDateConds('jui');
    const maDate = buildDateConds('mjui');

    const officeWhere = [`jui.used_by IN (?)`, ...officeDate.conds].join(' AND ');
    const maWhere = [`mjui.used_by IN (?)`, ...maDate.conds].join(' AND ');

    const officeParams = [userFilterIds, ...officeDate.vals];
    const maParams = [userFilterIds, ...maDate.vals];

    const [usages] = await pool.query(
      `(
         SELECT
           CONCAT('office-', jui.id) AS id,
           jui.job_id AS job_id,
           'office' AS job_type,
           jui.device_role, jui.sn, jui.product_name, jui.model_name,
           jui.quantity, jui.used_at, jui.used_by,
           u.full_name AS contractor_name, u.role AS contractor_role,
           j.access_no AS access_no, j.customer AS customer, j.address AS address,
           j.completed_at AS completed_at
         FROM job_used_inventory jui
         JOIN users u ON u.id = jui.used_by
         LEFT JOIN jobs j ON j.id = jui.job_id
         WHERE ${officeWhere}
       )
       UNION ALL
       (
         SELECT
           CONCAT('ma-', mjui.id) AS id,
           mjui.ma_job_id AS job_id,
           'ma' AS job_type,
           mjui.device_role, mjui.sn, mjui.product_name, mjui.model_name,
           mjui.quantity, mjui.used_at, mjui.used_by,
           u.full_name AS contractor_name, u.role AS contractor_role,
           COALESCE(mj.non_number, mj.access_no) AS access_no,
           mj.customer AS customer, mj.address AS address,
           mj.completed_at AS completed_at
         FROM ma_job_used_inventory mjui
         JOIN users u ON u.id = mjui.used_by
         LEFT JOIN ma_jobs mj ON mj.id = mjui.ma_job_id
         WHERE ${maWhere}
       )
       ORDER BY used_at DESC
       LIMIT 2000`,
      [...officeParams, ...maParams]
    );

    const [byPerson] = await pool.query(
      `SELECT used_by AS user_id,
              full_name,
              role,
              COUNT(*) AS item_count,
              COUNT(DISTINCT job_key) AS job_count,
              SUM(quantity) AS total_qty
       FROM (
         SELECT jui.used_by, u.full_name, u.role, jui.quantity,
                CONCAT('office-', jui.job_id) AS job_key
         FROM job_used_inventory jui
         JOIN users u ON u.id = jui.used_by
         WHERE ${officeWhere}
         UNION ALL
         SELECT mjui.used_by, u.full_name, u.role, mjui.quantity,
                CONCAT('ma-', mjui.ma_job_id) AS job_key
         FROM ma_job_used_inventory mjui
         JOIN users u ON u.id = mjui.used_by
         WHERE ${maWhere}
       ) AS combined
       GROUP BY used_by, full_name, role
       ORDER BY item_count DESC`,
      [...officeParams, ...maParams]
    );

    // Remaining bag stock (dispatched) for context
    const bagParams = [filterUserId && filterUserId !== 'ALL' ? [Number(filterUserId)] : contractorIds];
    const [bagRows] = await pool.query(
      `SELECT owner_id, COUNT(*) AS remaining
       FROM inventory_items
       WHERE owner_id IN (?) AND status = 'dispatched'
       GROUP BY owner_id`,
      bagParams
    );
    const bagMap = Object.fromEntries(bagRows.map((r) => [r.owner_id, Number(r.remaining)]));

    const byPersonOut = byPerson.map((p) => {
      const known = contractorRoleMap[p.user_id];
      const role = known?.role || p.role;
      return {
        ...p,
        role,
        role_display: known?.role_display || roleLabel(role),
        remaining_bag: bagMap[p.user_id] || 0,
        item_count: Number(p.item_count),
        job_count: Number(p.job_count),
        total_qty: Number(p.total_qty) || 0,
      };
    });

    // Include contractors with 0 usage in period when viewing ALL
    const seen = new Set(byPersonOut.map((p) => p.user_id));
    if (!filterUserId || filterUserId === 'ALL') {
      for (const c of contractorsOut) {
        if (!seen.has(c.id)) {
          byPersonOut.push({
            user_id: c.id,
            full_name: c.full_name,
            role: c.role,
            role_display: c.role_display,
            item_count: 0,
            job_count: 0,
            total_qty: 0,
            remaining_bag: bagMap[c.id] || 0,
          });
        }
      }
    }

    res.json({
      contractors: contractorsOut,
      summary: {
        total_items: usages.length,
        total_jobs: new Set(usages.map((u) => `${u.job_type}-${u.job_id}`).filter((k) => !k.endsWith('-null') && !k.endsWith('-undefined'))).size,
        contractor_count: byPersonOut.filter((p) => p.item_count > 0).length,
        total_qty: usages.reduce((s, u) => s + (Number(u.quantity) || 0), 0),
      },
      by_person: byPersonOut,
      usages: usages.map((u) => {
        const known = contractorRoleMap[u.used_by];
        // Badge follows the job that used the equipment (not primary user role)
        const roleFromJob = u.job_type === 'ma' ? 'contractor_ma' : 'contractor_office';
        return {
          ...u,
          quantity: Number(u.quantity) || 0,
          contractor_role: roleFromJob,
          role_display: roleLabel(roleFromJob),
          person_role: known?.role || u.contractor_role,
          person_role_display: known?.role_display || roleLabel(known?.role || u.contractor_role),
          job_type_display: u.job_type === 'ma' ? 'งาน MA' : 'งานติดตั้ง',
        };
      }),
    });
  } catch (err) {
    console.error('Contractor Summary Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

  // 💼 GET /api/inventory/active-jobs 💼
  // Get jobs assigned to the user (team or field_engineer_id)
  router.get('/active-jobs', auth, async (req, res) => {
    try {
      const targetUserId = req.query.user_id || req.user.id;
      const userRoles = req.user.roles || [req.user.role];
      const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));
      if (!isAdmin && parseInt(targetUserId) !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      // Get the target user's team
      const [[userRow]] = await pool.query('SELECT team_id FROM users WHERE id = ?', [targetUserId]);
      const teamId = userRow ? userRow.team_id : null;

      let query = `
        SELECT j.id, j.access_no, j.status, j.customer, j.address, j.created_at
        FROM jobs j
        WHERE j.status != 'completed'
      `;
      let params = [];

      // Filter by the targetUserId
      query += ` AND (j.field_engineer_id = ? OR j.team_id = ?)`;
      params.push(targetUserId, teamId || -1);

      query += ` ORDER BY j.created_at DESC`;
      const [jobs] = await pool.query(query, params);
      res.json(jobs);
    } catch (err) {
      console.error('Failed to get active-jobs:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // 🛠️ POST /api/inventory/use-equipment 🛠️
  // Use equipment from tech bag and mark a NON job as completed
  router.post('/use-equipment', auth, async (req, res) => {
    const { job_id, items, user_id } = req.body;
    const actorId = req.user.id;
    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

    // Admin or teammate may act on shared team bag via user_id
    let bagOwnerId = actorId;
    let actorTeamId = await getUserTeamId(pool, actorId);
    if (user_id != null && user_id !== '') {
      const requestedOwner = parseInt(user_id, 10);
      if (!requestedOwner) {
        return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
      }
      if (!isAdmin && requestedOwner !== actorId) {
        const targetTeamId = await getUserTeamId(pool, requestedOwner);
        if (!actorTeamId || !targetTeamId || Number(actorTeamId) !== Number(targetTeamId)) {
          return res.status(403).json({ error: 'Access denied' });
        }
      }
      bagOwnerId = requestedOwner;
      actorTeamId = (await getUserTeamId(pool, bagOwnerId)) || actorTeamId;
    }
    
    if (!job_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ข้อมูลไม่ครบถ้วน' });
    }
  
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await syncDispatchedItemTeams(conn);
  
      // 1. Verify job exists
      const [[job]] = await conn.query(
        'SELECT id, access_no, status, customer, install_device FROM jobs WHERE id = ?', 
        [job_id]
      );
      if (!job) {
        await conn.rollback();
        return res.status(404).json({ error: 'ไม่พบงานที่เลือก' });
      }
      
      let usedItemsSummary = [];

      // 2. Process each item (no-SN can pull from shared team pool of same model)
      for (const reqItem of items) {
        const { item_id, quantity } = reqItem;
        if (!item_id || !quantity || quantity <= 0) continue;

        let used;
        try {
          used = await deductNoSnAcrossTeamBag(conn, {
            itemId: item_id,
            quantity,
            bagOwnerId,
            teamId: actorTeamId,
            actorId: bagOwnerId,
            note: `ใช้งานกับงาน ${job.access_no}${job.customer ? ` (ลูกค้า: ${job.customer})` : ''}`,
          });
        } catch (deductErr) {
          await conn.rollback();
          return res.status(400).json({
            error: deductErr.message || 'หักสินค้าไม่สำเร็จ',
            tip: 'แจ้งแอดมินให้เติมสินค้าเข้ากระเป๋าทีม หรือลดจำนวนที่ใช้',
          });
        }

        // Record usage against primary / first deduction for job history
        const primaryDeduction = used.deductions[0];
        await conn.query(
          `INSERT INTO job_used_inventory (job_id, inventory_item_id, device_role, sn, product_name, model_name, quantity, used_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job_id,
            primaryDeduction?.item_id || item_id,
            'TechBag',
            used.sn || '-',
            used.product_name,
            used.model_name || '-',
            quantity,
            bagOwnerId,
          ]
        );

        const equipmentName = `${used.product_name} ${used.model_name} จำนวน ${quantity} ${used.unit || 'ชิ้น'}`;
        usedItemsSummary.push(equipmentName);
      }
  
      // 3. Update job status to completed if it's not already, and append equipment to install_device
      const newEquipmentText = usedItemsSummary.join(', ');
      const updatedInstallDevice = job.install_device 
        ? `${job.install_device}, ${newEquipmentText}` 
        : newEquipmentText;

      if (job.status !== 'completed') {
        await conn.query(
          `UPDATE jobs SET 
            status = "completed", 
            install_device = ?,
            finish_time = IFNULL(finish_time, NOW()),
            completed_at = IFNULL(completed_at, NOW()),
            completed_by = IFNULL(completed_by, ?)
           WHERE id = ?`,
          [updatedInstallDevice, actorId, job_id]
        );
      } else {
        await conn.query(
          'UPDATE jobs SET install_device = ? WHERE id = ?',
          [updatedInstallDevice, job_id]
        );
      }
  
      await conn.commit();
      res.json({ message: 'ใช้งานอุปกรณ์และบันทึกงานเสร็จสิ้น' });
    } catch (err) {
      await conn.rollback();
      console.error('Use Equipment Error:', err);
      res.status(500).json({ error: 'เกิดข้อผิดพลาดในการใช้งานอุปกรณ์' });
    } finally {
      conn.release();
    }
  });

// ── GET /api/inventory/my-history ──
router.get('/my-history', auth, async (req, res) => {
  const targetUserId = req.query.user_id || req.user.id;
  
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
  if (!isAdmin && parseInt(targetUserId) !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT il.id, il.action, il.quantity, il.created_at, il.note,
              ii.sn, pm.model_name, p.name AS product_name,
              u_from.full_name AS from_user_name,
              u_to.full_name AS to_user_name
       FROM inventory_logs il
       JOIN inventory_items ii ON ii.id = il.item_id
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       LEFT JOIN users u_from ON u_from.id = il.from_user_id
       LEFT JOIN users u_to ON u_to.id = il.to_user_id
       WHERE il.from_user_id = ? OR il.to_user_id = ?
       ORDER BY il.created_at DESC
       LIMIT 100`,
      [targetUserId, targetUserId]
    );
    res.json(rows);
  } catch (err) {
    console.error('My History Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/inventory/dispatch-history ──
// ประวัติการเบิก (action=dispatch) ของรุ่น/สินค้า ในขอบเขตกระเป๋าผู้ใช้หรือทีม
// Query: user_id, model_id (แนะนำ), item_id (สำหรับ SN)
router.get('/dispatch-history', auth, async (req, res) => {
  const viewerId = req.user.id;
  const requestedId = parseInt(req.query.user_id || viewerId, 10) || viewerId;
  const modelId = req.query.model_id != null && req.query.model_id !== ''
    ? parseInt(req.query.model_id, 10)
    : null;
  const itemId = req.query.item_id != null && req.query.item_id !== ''
    ? parseInt(req.query.item_id, 10)
    : null;

  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

  try {
    const viewerTeamId = await getUserTeamId(pool, viewerId);
    let scopeUserId = viewerId;
    let scopeTeamId = viewerTeamId;

    if (requestedId !== viewerId) {
      const targetTeamId = await getUserTeamId(pool, requestedId);
      if (!isAdmin) {
        if (!viewerTeamId || !targetTeamId || Number(viewerTeamId) !== Number(targetTeamId)) {
          return res.status(403).json({
            error: 'ดูประวัติเบิกได้เฉพาะของตัวเองหรือทีมเดียวกันเท่านั้น',
          });
        }
      }
      scopeUserId = requestedId;
      scopeTeamId = targetTeamId || viewerTeamId;
    }

    const teamParam = bagTeamParam(scopeTeamId);
    const params = [scopeUserId, teamParam];
    let extra = '';

    if (modelId && Number.isFinite(modelId)) {
      extra += ' AND ii.model_id = ?';
      params.push(modelId);
    }
    if (itemId && Number.isFinite(itemId)) {
      // SN: include logs on this item id; also same SN if split
      extra += ' AND (il.item_id = ? OR ii.id = ?)';
      params.push(itemId, itemId);
    }

    if (!modelId && !itemId) {
      return res.status(400).json({ error: 'กรุณาเลือกสินค้า (model_id หรือ item_id)' });
    }

    const [rows] = await pool.query(
      `SELECT il.id, il.action, il.quantity, il.created_at, il.note, il.item_id,
              ii.sn, ii.model_id, pm.model_name, p.name AS product_name, p.unit, p.has_sn,
              u_from.full_name AS from_user_name,
              u_to.full_name AS to_user_name,
              u_to.id AS to_user_id
       FROM inventory_logs il
       JOIN inventory_items ii ON ii.id = il.item_id
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       LEFT JOIN users u_from ON u_from.id = il.from_user_id
       LEFT JOIN users u_to ON u_to.id = il.to_user_id
       WHERE il.action = 'dispatch'
         AND (
           il.to_user_id = ?
           OR (u_to.team_id IS NOT NULL AND u_to.team_id = ?)
         )
         ${extra}
       ORDER BY il.created_at DESC
       LIMIT 300`,
      params
    );

    res.json(rows.map((r) => ({
      ...r,
      quantity: Number(r.quantity) || 0,
      has_sn: Number(r.has_sn) ? 1 : 0,
    })));
  } catch (err) {
    console.error('Dispatch History Error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── POST /api/inventory/transfer ──
router.post('/transfer', auth, async (req, res) => {
  const { item_id, target_user_id, transfer_quantity, user_id, from_user_id } = req.body;
  const actorId = req.user.id;
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));

  // Admin or teammate may transfer from shared team bag
  let bagOwnerId = actorId;
  let actorTeamId = await getUserTeamId(pool, actorId);
  const explicitOwner = user_id ?? from_user_id;
  if (explicitOwner != null && explicitOwner !== '') {
    const requestedOwner = parseInt(explicitOwner, 10);
    if (!requestedOwner) {
      return res.status(400).json({ error: 'user_id ไม่ถูกต้อง' });
    }
    if (!isAdmin && requestedOwner !== actorId) {
      const targetTeamId = await getUserTeamId(pool, requestedOwner);
      if (!actorTeamId || !targetTeamId || Number(actorTeamId) !== Number(targetTeamId)) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    bagOwnerId = requestedOwner;
    actorTeamId = (await getUserTeamId(pool, bagOwnerId)) || actorTeamId;
  }
  
  if (!item_id || !target_user_id || !transfer_quantity) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await syncDispatchedItemTeams(conn);

    // 1. Validate item is in personal or shared team bag
    const [[item]] = await conn.query(
      `SELECT * FROM inventory_items 
       WHERE id = ?
         AND status = 'dispatched'
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (
           owner_id = ?
           OR team_id = ?
           OR owner_id IN (SELECT id FROM users WHERE team_id = ?)
         )
       FOR UPDATE`,
      [item_id, bagOwnerId, bagTeamParam(actorTeamId), bagTeamParam(actorTeamId)]
    );

    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้าในกระเป๋า หรือสินค้าหมดอายุแล้ว' });
    }

    const tQty = parseFloat(transfer_quantity);
    const iQty = parseFloat(item.quantity);

    if (tQty <= 0 || tQty > iQty) {
      await conn.rollback();
      return res.status(400).json({ error: 'จำนวนที่ต้องการโอนไม่ถูกต้อง' });
    }

    // 2. Target user's team
    const [[targetUser]] = await conn.query('SELECT team_id FROM users WHERE id = ?', [target_user_id]);
    const targetTeamId = targetUser ? targetUser.team_id : null;

    const [[prod]] = await conn.query(
      `SELECT p.has_sn FROM inventory_models pm
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE pm.id = ?`,
      [item.model_id]
    );
    const isNoSn = prod && !Number(prod.has_sn);

    // No-SN: merge into target's existing bag line for same model
    let logItemId = item.id;
    if (isNoSn && Number(target_user_id) !== Number(item.owner_id)) {
      const [targetBags] = await conn.query(
        `SELECT id, quantity FROM inventory_items
         WHERE owner_id = ? AND model_id = ? AND status = 'dispatched'
           AND id <> ?
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY id ASC
         FOR UPDATE`,
        [target_user_id, item.model_id, item.id]
      );

      if (targetBags.length > 0) {
        const keepId = targetBags[0].id;
        let dupExtra = 0;
        for (let i = 1; i < targetBags.length; i++) {
          dupExtra += parseFloat(targetBags[i].quantity) || 0;
          await conn.query(
            `UPDATE inventory_items
             SET status = 'used', quantity = 0, owner_id = NULL, team_id = NULL
             WHERE id = ?`,
            [targetBags[i].id]
          );
        }
        await conn.query(
          `UPDATE inventory_items
           SET quantity = quantity + ?, team_id = COALESCE(?, team_id), dispatched_at = NOW()
           WHERE id = ?`,
          [tQty + dupExtra, targetTeamId, keepId]
        );
        if (tQty === iQty) {
          await conn.query(
            `UPDATE inventory_items
             SET status = 'used', quantity = 0, owner_id = NULL, team_id = NULL
             WHERE id = ?`,
            [item.id]
          );
        } else {
          await conn.query(
            `UPDATE inventory_items SET quantity = ? WHERE id = ?`,
            [iQty - tQty, item.id]
          );
        }
        logItemId = keepId;
      } else if (tQty === iQty) {
        await conn.query(
          `UPDATE inventory_items SET owner_id = ?, team_id = ? WHERE id = ?`,
          [target_user_id, targetTeamId, item.id]
        );
      } else {
        const newQty = iQty - tQty;
        await conn.query(`UPDATE inventory_items SET quantity = ? WHERE id = ?`, [newQty, item.id]);
        const newSn = `${item.sn}-SPLIT-${Date.now().toString().slice(-4)}`;
        const [ins] = await conn.query(
          `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at, expires_at)
           VALUES (?, ?, ?, 'dispatched', ?, ?, NOW(), ?)`,
          [item.model_id, newSn, tQty, target_user_id, targetTeamId, item.expires_at]
        );
        logItemId = ins.insertId;
      }
    } else if (tQty === iQty) {
      await conn.query(
        `UPDATE inventory_items SET owner_id = ?, team_id = ? WHERE id = ?`,
        [target_user_id, targetTeamId, item.id]
      );
    } else {
      const newQty = iQty - tQty;
      await conn.query(`UPDATE inventory_items SET quantity = ? WHERE id = ?`, [newQty, item.id]);
      const newSn = `${item.sn}-SPLIT-${Date.now().toString().slice(-4)}`;
      await conn.query(
        `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at, expires_at)
         VALUES (?, ?, ?, 'dispatched', ?, ?, NOW(), ?)`,
        [item.model_id, newSn, tQty, target_user_id, targetTeamId, item.expires_at]
      );
    }

    // Log the transfer (from = bag owner)
    await conn.query(
      'INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity) VALUES (?, ?, ?, "transfer", ?)',
      [logItemId, bagOwnerId, target_user_id, tQty]
    );

    await conn.commit();

    if (Number(target_user_id) !== Number(actorId)) {
      const [[fromUser]] = await pool.query(
        'SELECT full_name FROM users WHERE id = ? LIMIT 1',
        [bagOwnerId]
      );
      const [[prodRow]] = await pool.query(
        `SELECT p.name AS product_name, pm.model_name
         FROM inventory_models pm
         JOIN inventory_products p ON p.id = pm.product_id
         WHERE pm.id = ? LIMIT 1`,
        [item.model_id]
      );
      const productLabel =
        `${prodRow?.product_name || 'อุปกรณ์'}${prodRow?.model_name ? ` ${prodRow.model_name}` : ''}`.trim();

      notifyInventoryTransferred({
        targetUserId: target_user_id,
        fromUserName: fromUser?.full_name || req.user.full_name || 'เพื่อนร่วมทีม',
        productLabel,
        quantity: tQty,
        itemId: logItemId,
        actorId,
      }).catch((e) => console.error('notifyInventoryTransferred:', e.message));
    }

    res.json({ message: 'Transfer successful' });
  } catch (err) {
    await conn.rollback();
    console.error('Transfer Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/inventory/return ──
router.post('/return', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { item_id, return_quantity, user_id } = req.body;
  const currentUserId = req.user.id;
  
  if (!item_id || !return_quantity) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validate item exists and is dispatched (optionally scoped to bag owner)
    let itemQuery = `SELECT * FROM inventory_items 
       WHERE id = ? AND status = 'dispatched' AND (expires_at IS NULL OR expires_at > NOW())`;
    const itemParams = [item_id];
    if (user_id != null && user_id !== '') {
      itemQuery += ' AND owner_id = ?';
      itemParams.push(parseInt(user_id, 10));
    }
    itemQuery += ' FOR UPDATE';

    const [[item]] = await conn.query(itemQuery, itemParams);

    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้า หรือสินค้าไม่ได้อยู่ในสถานะที่สามารถคืนได้' });
    }

    const rQty = parseFloat(return_quantity);
    const iQty = parseFloat(item.quantity);

    if (rQty <= 0 || rQty > iQty) {
      await conn.rollback();
      return res.status(400).json({ error: 'จำนวนที่ต้องการคืนไม่ถูกต้อง' });
    }

    if (rQty === iQty) {
      // Return whole item to stock
      await conn.query(
        `UPDATE inventory_items 
         SET status = 'in_stock', owner_id = NULL, team_id = NULL, dispatched_at = NULL 
         WHERE id = ?`,
        [item.id]
      );
    } else {
      // Split item
      const newQty = iQty - rQty;
      await conn.query(`UPDATE inventory_items SET quantity = ? WHERE id = ?`, [newQty, item.id]);

      // Create new item in stock
      const newSn = `${item.sn}-RETURN-${Date.now().toString().slice(-4)}`;
      
      await conn.query(
        `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at, expires_at)
         VALUES (?, ?, ?, 'in_stock', NULL, NULL, NULL, ?)`,
        [item.model_id, newSn, rQty, item.expires_at]
      );
    }

    // Log the return using "receive" action so it doesn't violate ENUM, with a note
    await conn.query(
      'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, "receive", ?, "คืนจากกระเป๋าช่าง")',
      [item.id, currentUserId, rQty]
    );

    await conn.commit();
    res.json({ message: 'คืนสินค้าสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('Return Error:', err);
    res.status(500).json({ error: 'Server error: ' + (err.message || err.toString()) });
  } finally {
    conn.release();
  }
});

// ── POST /api/inventory/return-bulk ──
router.post('/return-bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { items } = req.body;
  const currentUserId = req.user.id;
  
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'ไม่พบรายการสินค้าที่ต้องการคืน' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const returnItem of items) {
      const { item_id, return_quantity } = returnItem;
      if (!item_id || !return_quantity) {
        throw new Error('ข้อมูลสินค้าบางรายการไม่ครบถ้วน');
      }

      // 1. Validate item exists and is dispatched
      const [[item]] = await conn.query(
        `SELECT * FROM inventory_items 
         WHERE id = ? AND status = 'dispatched' AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE`,
        [item_id]
      );

      if (!item) {
        throw new Error(`ไม่พบสินค้า (ID: ${item_id}) หรือสินค้าไม่ได้อยู่ในสถานะที่สามารถคืนได้`);
      }

      const rQty = parseFloat(return_quantity);
      const iQty = parseFloat(item.quantity);

      if (rQty <= 0 || rQty > iQty) {
        throw new Error(`จำนวนที่ต้องการคืนไม่ถูกต้อง สำหรับสินค้า (ID: ${item_id})`);
      }

      if (rQty === iQty) {
        // Return whole item to stock
        await conn.query(
          `UPDATE inventory_items 
           SET status = 'in_stock', owner_id = NULL, team_id = NULL, dispatched_at = NULL 
           WHERE id = ?`,
          [item.id]
        );
      } else {
        // Split item
        const newQty = iQty - rQty;
        await conn.query(`UPDATE inventory_items SET quantity = ? WHERE id = ?`, [newQty, item.id]);

        // Create new item in stock
        const newSn = `${item.sn}-RETURN-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;
        
        await conn.query(
          `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at, expires_at)
           VALUES (?, ?, ?, 'in_stock', NULL, NULL, NULL, ?)`,
          [item.model_id, newSn, rQty, item.expires_at]
        );
      }

      // Log the return using "receive" action so it doesn't violate ENUM, with a note
      await conn.query(
        'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, "receive", ?, "คืนจากกระเป๋าช่าง")',
        [item.id, currentUserId, rQty]
      );
    }

    await conn.commit();
    res.json({ message: `คืนสินค้าสำเร็จ ${items.length} รายการ` });
  } catch (err) {
    await conn.rollback();
    console.error('Return Bulk Error:', err);
    res.status(500).json({ error: err.message || 'Server error during bulk return' });
  } finally {
    conn.release();
  }
});

// ── GET /api/inventory/search-dispatched-sn/:sn ──
router.get('/search-dispatched-sn/:sn', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.has_sn, p.unit, p.pieces_per_crate, p.crate_unit,
              u.full_name AS owner_name, u.team_id, t.team_name
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       LEFT JOIN users u ON u.id = ii.owner_id
       LEFT JOIN teams t ON t.id = u.team_id
       WHERE ii.sn = ? AND ii.status = 'dispatched'`,
      [req.params.sn]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบสินค้ารหัสนี้ในกระเป๋าช่างคนใด' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Search dispatched SN error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/inventory/history ──
router.get('/history', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT il.id, il.action, il.quantity, il.created_at, il.note,
              ii.sn, ii.status AS item_status,
              pm.model_name, p.name AS product_name,
              u_from.full_name AS from_user_name,
              u_to.full_name AS to_user_name
       FROM inventory_logs il
       JOIN inventory_items ii ON ii.id = il.item_id
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       LEFT JOIN users u_from ON u_from.id = il.from_user_id
       LEFT JOIN users u_to ON u_to.id = il.to_user_id
       ORDER BY il.created_at DESC
       LIMIT 500`
    );
    res.json(rows);
  } catch (err) {
    console.error('History Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/inventory/items/tech/:id ──
// Admin edit tech bag item quantity
router.put('/items/tech/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const itemId = req.params.id;
  const { quantity } = req.body;
  if (!quantity || isNaN(quantity) || quantity <= 0) {
    return res.status(400).json({ error: 'จำนวนต้องมากกว่า 0' });
  }
  
  try {
    await pool.query('UPDATE inventory_items SET quantity = ? WHERE id = ? AND status = "dispatched"', [quantity, itemId]);
    res.json({ message: 'อัปเดตจำนวนสินค้าสำเร็จ' });
  } catch (err) {
    console.error('Update Tech Bag Item Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/inventory/items/tech/:id ──
// Admin delete tech bag item (mark as used or lost)
router.delete('/items/tech/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const itemId = req.params.id;
  const adminId = req.user.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query('SELECT * FROM inventory_items WHERE id = ? AND status = "dispatched"', [itemId]);
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้านี้ในกระเป๋าช่าง' });
    }

    await conn.query('UPDATE inventory_items SET status = "used" WHERE id = ?', [itemId]);
    // Optional: Log it in generic logs or consumable logs? We use inventory_logs
    await conn.query(
      'INSERT INTO inventory_logs (item_id, from_user_id, action, quantity, note) VALUES (?, ?, "used", ?, "ถูกลบ/ปรับยอดโดยผู้ดูแลระบบ")',
      [itemId, adminId, item.quantity]
    );

    await conn.commit();
    res.json({ message: 'นำสินค้าออกจากกระเป๋าช่างเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete Tech Bag Item Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── DELETE /api/inventory/logs/:id ──
// Admin delete history log
router.delete('/logs/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const logId = req.params.id;
  try {
    const [result] = await pool.query('DELETE FROM inventory_logs WHERE id = ?', [logId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'ไม่พบประวัติรายการนี้' });
    }
    res.json({ message: 'ลบประวัติรายการสำเร็จ' });
  } catch (err) {
    console.error('Delete History Log Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/inventory/stock ──
// Get current stock overview (items in_stock) grouped by product and model
router.get('/stock', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id AS product_id, p.name AS product_name, p.has_sn,
              p.unit, p.pieces_per_crate, p.crate_unit, p.category, p.image_url,
              m.id AS model_id, m.model_name, m.image_url AS model_image_url,
              COUNT(ii.id) AS item_count,
              SUM(ii.quantity) AS total_quantity
       FROM inventory_items ii
       JOIN inventory_models m ON m.id = ii.model_id
       JOIN inventory_products p ON p.id = m.product_id
       WHERE ii.status = 'in_stock'
       GROUP BY p.id, m.id
       ORDER BY p.name, m.model_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('Stock Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/inventory/stock/:model_id ──
// Get individual SN items for a specific model currently in stock
router.get('/stock/:model_id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, sn, phone_number, quantity, created_at 
       FROM inventory_items 
       WHERE model_id = ? AND status = 'in_stock'
       ORDER BY created_at DESC`
      , [req.params.model_id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Stock Detail Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/inventory/items/:id ──
// Delete a specific SN item from stock
router.delete('/items/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const itemId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Ensure it's in stock
    const [[item]] = await conn.query('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
    }
    if (item.status !== 'in_stock') {
      await conn.rollback();
      return res.status(400).json({ error: 'ไม่สามารถลบได้เนื่องจากสินค้าไม่ได้อยู่ในคลัง (อาจถูกเบิกไปแล้ว)' });
    }

    // Delete logs and item
    await conn.query('DELETE FROM inventory_logs WHERE item_id = ?', [itemId]);
    await conn.query('DELETE FROM inventory_items WHERE id = ?', [itemId]);

    await conn.commit();
    res.json({ message: 'ลบสินค้ารายการนี้ออกจากระบบเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete Item Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// Edit quantity of a non-SN item
router.put('/items/:id/quantity', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const itemId = req.params.id;
  const { quantity } = req.body;
  const newQty = parseFloat(quantity);
  
  if (isNaN(newQty) || newQty < 0) {
    return res.status(400).json({ error: 'จำนวนไม่ถูกต้อง' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[item]] = await conn.query('SELECT * FROM inventory_items WHERE id = ?', [itemId]);
    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้านี้ในระบบ' });
    }
    if (item.status !== 'in_stock') {
      await conn.rollback();
      return res.status(400).json({ error: 'ไม่สามารถแก้ไขได้เนื่องจากสินค้าไม่ได้อยู่ในคลัง (อาจถูกเบิกไปแล้ว)' });
    }

    if (newQty === 0) {
      // Delete logs and item if quantity becomes 0
      await conn.query('DELETE FROM inventory_logs WHERE item_id = ?', [itemId]);
      await conn.query('DELETE FROM inventory_items WHERE id = ?', [itemId]);
    } else {
      // Update quantity
      await conn.query('UPDATE inventory_items SET quantity = ? WHERE id = ?', [newQty, itemId]);
      // Update the receive log quantity if it's the only one, or insert an adjustment log
      // Simplest is to just update the 'received' log quantity for this item
      await conn.query('UPDATE inventory_logs SET quantity = ? WHERE item_id = ? AND action = "received"', [newQty, itemId]);
    }

    await conn.commit();
    res.json({ message: 'แก้ไขจำนวนสำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('Update Quantity Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── POST /api/inventory/check-sn-duplicates ──
// Check which SNs from a provided list already exist in the system
router.post('/check-sn-duplicates', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { sns } = req.body;
  if (!sns || !Array.isArray(sns) || sns.length === 0) {
    return res.json({ duplicates: [] });
  }

  try {
    const placeholders = sns.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT ii.sn, pm.model_name, p.name AS product_name
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.sn IN (${placeholders})`,
      sns
    );
    res.json({ duplicates: rows });
  } catch (err) {
    console.error('Check SN duplicates error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/inventory/clear ──
// Super admin clear all inventory items and logs
router.delete('/clear', auth, requireRole(['super_admin', 'admin']), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE inventory_logs');
    await conn.query('TRUNCATE TABLE inventory_items');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    res.json({ message: 'ล้างข้อมูลสต๊อกทั้งหมดเรียบร้อยแล้ว' });
  } catch (err) {
    await conn.rollback();
    console.error('Clear DB Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;

