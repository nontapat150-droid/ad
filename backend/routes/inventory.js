const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

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

// ── POST /api/inventory/products ──
router.post('/products', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { name, has_sn } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const [result] = await pool.query(
      'INSERT INTO inventory_products (name, has_sn) VALUES (?, ?)',
      [name, has_sn !== false]
    );
    res.json({ message: 'Product created', id: result.insertId });
  } catch (err) {
    console.error('Add product error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// ── POST /api/inventory/models ──
router.post('/models', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { product_id, model_name } = req.body;
  if (!product_id || !model_name) return res.status(400).json({ error: 'Missing required fields' });

  try {
    const [result] = await pool.query(
      'INSERT INTO inventory_models (product_id, model_name) VALUES (?, ?)',
      [product_id, model_name]
    );
    res.json({ message: 'Model created', id: result.insertId });
  } catch (err) {
    console.error('Add model error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
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
  const { model_id, sn, quantity = 1, is_auto_generate, generate_count = 1 } = req.body;
  if (!model_id) return res.status(400).json({ error: 'model_id is required' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get product info
    const [[model]] = await conn.query(
      'SELECT m.*, p.has_sn, p.prefix FROM inventory_models m JOIN inventory_products p ON m.product_id = p.id WHERE m.id = ?',
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
        'INSERT INTO inventory_items (model_id, sn, quantity, status) VALUES (?, ?, ?, "in_stock")',
        [model_id, sn, 1.00]
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
            'INSERT INTO inventory_items (model_id, sn, quantity, status) VALUES (?, ?, ?, "in_stock")',
            [model_id, uniqueCode, quantity] // For No-SN, we allow specifying bulk quantity (e.g. 100 meters)
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
          'INSERT INTO inventory_items (model_id, sn, quantity, status) VALUES (?, ?, ?, "in_stock")',
          [model_id, sn, quantity]
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
      `SELECT ii.*, pm.model_name, p.name AS product_name 
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
router.post('/dispatch', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { items, target_user_id } = req.body;
  if (!items || !items.length || !target_user_id) {
    return res.status(400).json({ error: 'Missing required data (items or target_user_id)' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch user team
    const [[user]] = await conn.query('SELECT team_id FROM users WHERE id = ?', [target_user_id]);
    const team_id = user ? user.team_id : null;

    const adminId = req.user.id;
    let dispatchedCount = 0;

    for (const item of items) {
      // item = { id: ..., quantity_to_dispatch: ... }
      // For SN items, quantity is 1. For No-SN, it could be <= item.quantity in DB.
      // But for simplicity in Phase 2, we assume we dispatch the whole item row.
      // Wait, if it's wire, the admin might want to dispatch only a part of it? 
      // The requirement: "เมื่อกดยืนยันระบบจะขึ้นหน้าต่างลอยคล้ายบิลใบเสร็จ และมี ดรอปดาวให้เลือกว่าจะเบิกให้คนไหน"
      // If we just transfer the whole row:
      
      const [[dbItem]] = await conn.query('SELECT quantity FROM inventory_items WHERE id = ? AND status = "in_stock" FOR UPDATE', [item.id]);
      if (!dbItem) continue; // Skip if not found or not in_stock

      // We dispatch the whole row to the technician.
      // In tech-bag they can split it. Or if admin wants to split, they can do it, but for now we just transfer the whole item.
      await conn.query(
        `UPDATE inventory_items 
         SET status = 'dispatched', owner_id = ?, team_id = ?, dispatched_at = NOW() 
         WHERE id = ?`,
        [target_user_id, team_id, item.id]
      );

      await conn.query(
        'INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity) VALUES (?, ?, ?, "dispatch", ?)',
        [item.id, adminId, target_user_id, dbItem.quantity]
      );
      dispatchedCount++;
    }

    await conn.commit();
    res.json({ message: `Successfully dispatched ${dispatchedCount} items to technician.` });
  } catch (err) {
    await conn.rollback();
    console.error('Dispatch Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ==========================================
// PHASE 3: TECH BAG & TRANSFERS
// ==========================================

// ── GET /api/inventory/my-bag ──
router.get('/my-bag', auth, async (req, res) => {
  const targetUserId = req.query.user_id || req.user.id;

  // Non-admins can only see their own bag
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
  if (!isAdmin && parseInt(targetUserId) !== req.user.id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [items] = await pool.query(
      `SELECT ii.*, pm.model_name, p.name AS product_name, p.has_sn
       FROM inventory_items ii
       JOIN inventory_models pm ON pm.id = ii.model_id
       JOIN inventory_products p ON p.id = pm.product_id
       WHERE ii.owner_id = ? 
         AND ii.status = 'dispatched' 
         AND (ii.expires_at IS NULL OR ii.expires_at > NOW())
       ORDER BY ii.dispatched_at DESC`,
      [targetUserId]
    );

    res.json(items);
  } catch (err) {
    console.error('My Bag Error:', err);
    res.status(500).json({ error: 'Server error' });
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
      `SELECT il.id, il.action, il.quantity, il.created_at,
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

// ── POST /api/inventory/transfer ──
router.post('/transfer', auth, async (req, res) => {
  const { item_id, target_user_id, transfer_quantity } = req.body;
  const currentUserId = req.user.id;
  
  if (!item_id || !target_user_id || !transfer_quantity) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validate item belongs to current user and has enough quantity
    const [[item]] = await conn.query(
      `SELECT * FROM inventory_items 
       WHERE id = ? AND owner_id = ? AND status = 'dispatched' AND (expires_at IS NULL OR expires_at > NOW()) FOR UPDATE`,
      [item_id, currentUserId]
    );

    if (!item) {
      await conn.rollback();
      return res.status(404).json({ error: 'ไม่พบสินค้าในกระเป๋าของคุณ หรือสินค้าหมดอายุแล้ว' });
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

    if (tQty === iQty) {
      // Transfer whole item
      await conn.query(
        `UPDATE inventory_items SET owner_id = ?, team_id = ? WHERE id = ?`,
        [target_user_id, targetTeamId, item.id]
      );
    } else {
      // Split item
      // Update original item
      const newQty = iQty - tQty;
      await conn.query(`UPDATE inventory_items SET quantity = ? WHERE id = ?`, [newQty, item.id]);

      // Create new item for target user (clone SN by appending a split marker, or if bulk without SN just use the same code with a split suffix)
      // Actually, if it's bulk (wire), SN might just be the generic code. Let's append an ID or timestamp to ensure uniqueness.
      const newSn = `${item.sn}-SPLIT-${Date.now().toString().slice(-4)}`;
      
      await conn.query(
        `INSERT INTO inventory_items (model_id, sn, quantity, status, owner_id, team_id, dispatched_at, expires_at)
         VALUES (?, ?, ?, 'dispatched', ?, ?, NOW(), ?)`,
        [item.model_id, newSn, tQty, target_user_id, targetTeamId, item.expires_at]
      );
    }

    // Log the transfer
    await conn.query(
      'INSERT INTO inventory_logs (item_id, from_user_id, to_user_id, action, quantity) VALUES (?, ?, ?, "transfer", ?)',
      [item.id, currentUserId, target_user_id, tQty]
    );

    await conn.commit();
    res.json({ message: 'Transfer successful' });
  } catch (err) {
    await conn.rollback();
    console.error('Transfer Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── GET /api/inventory/history ──
router.get('/history', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT il.id, il.action, il.quantity, il.created_at,
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
              m.id AS model_id, m.model_name,
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
      `SELECT id, sn, quantity, created_at 
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

module.exports = router;

