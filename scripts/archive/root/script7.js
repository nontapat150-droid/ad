const fs = require('fs');

const path = 'backend/routes/inventory.js';
let content = fs.readFileSync(path, 'utf8');

const regexGet = /\/\/ 🔹 GET \/api\/inventory\/categories 🔹[\s\S]*?\}\);/;
const replacementGet = `// 🔹 GET /api/inventory/categories 🔹
  router.get('/categories', auth, async (req, res) => {
    try {
      const [rows] = await pool.query(\`
        SELECT category_name AS name, image_url 
        FROM inventory_category_metadata
        UNION
        SELECT DISTINCT category AS name, NULL AS image_url
        FROM inventory_products 
        WHERE category IS NOT NULL AND category != ""
          AND category NOT IN (SELECT category_name FROM inventory_category_metadata)
        ORDER BY name ASC
      \`);
      res.json(rows);
    } catch (err) {
      console.error('Get categories error:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // 🔹 POST /api/inventory/categories 🔹
  router.post('/categories', auth, requireRole(ADMIN_ROLES), async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required' });
    try {
      await pool.query(
        \`INSERT INTO inventory_category_metadata (category_name) VALUES (?)\`,
        [name.trim()]
      );
      res.json({ message: 'Category created' });
    } catch (err) {
      console.error('Create category error:', err);
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'หมวดหมู่นี้มีอยู่แล้ว' });
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });

  // 🔹 PUT /api/inventory/categories/:name 🔹
  router.put('/categories/:name', auth, requireRole(ADMIN_ROLES), async (req, res) => {
    const oldName = req.params.name;
    const { new_name } = req.body;
    if (!new_name || !new_name.trim()) return res.status(400).json({ error: 'New name is required' });
    
    try {
      await pool.query('START TRANSACTION');
      // Update metadata
      await pool.query(
        \`UPDATE inventory_category_metadata SET category_name = ? WHERE category_name = ?\`,
        [new_name.trim(), oldName]
      );
      // Update products
      await pool.query(
        \`UPDATE inventory_products SET category = ? WHERE category = ?\`,
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

  // 🔹 DELETE /api/inventory/categories/:name 🔹
  router.delete('/categories/:name', auth, requireRole(ADMIN_ROLES), async (req, res) => {
    const categoryName = req.params.name;
    try {
      await pool.query('START TRANSACTION');
      // Delete metadata
      await pool.query(
        \`DELETE FROM inventory_category_metadata WHERE category_name = ?\`,
        [categoryName]
      );
      // Remove from products
      await pool.query(
        \`UPDATE inventory_products SET category = NULL WHERE category = ?\`,
        [categoryName]
      );
      await pool.query('COMMIT');
      res.json({ message: 'Category deleted' });
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('Delete category error:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });`;

content = content.replace(regexGet, replacementGet);

fs.writeFileSync(path, content, 'utf8');
