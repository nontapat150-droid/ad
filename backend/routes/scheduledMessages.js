const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { loadSchedules } = require('../scheduler');

// Get users for selection (Safe query)
router.get('/users', async (req, res) => {
  try {
    const [users] = await db.execute('SELECT id, full_name, role FROM users WHERE status = "active" ORDER BY full_name ASC');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users for scheduled messages:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get all scheduled messages
router.get('/', async (req, res) => {
  try {
    const [messages] = await db.execute('SELECT * FROM scheduled_messages ORDER BY created_at DESC');
    res.json(messages);
  } catch (err) {
    console.error('Error fetching scheduled messages:', err);
    res.status(500).json({ error: 'Failed to fetch scheduled messages' });
  }
});

// Create a new scheduled message
router.post('/', async (req, res) => {
  const { message, target_role, target_users, cron_expression, is_active } = req.body;
  const created_by = req.user ? req.user.id : 1; // Fallback if no auth middleware

  if (!message || !cron_expression) {
    return res.status(400).json({ error: 'Message and cron_expression are required' });
  }

  try {
    const targetUsersStr = target_users ? JSON.stringify(target_users) : null;
    
    const [result] = await db.execute(
      `INSERT INTO scheduled_messages 
       (message, target_role, target_users, cron_expression, is_active, created_by) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message, target_role || 'all', targetUsersStr, cron_expression, is_active ?? true, created_by]
    );

    // Reload scheduler
    await loadSchedules();

    res.status(201).json({ message: 'Scheduled message created successfully', id: result.insertId });
  } catch (err) {
    console.error('Error creating scheduled message:', err);
    res.status(500).json({ error: 'Failed to create scheduled message' });
  }
});

// Update a scheduled message
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { message, target_role, target_users, cron_expression, is_active } = req.body;

  if (!message || !cron_expression) {
    return res.status(400).json({ error: 'Message and cron_expression are required' });
  }

  try {
    const targetUsersStr = target_users ? JSON.stringify(target_users) : null;

    await db.execute(
      `UPDATE scheduled_messages 
       SET message = ?, target_role = ?, target_users = ?, cron_expression = ?, is_active = ? 
       WHERE id = ?`,
      [message, target_role || 'all', targetUsersStr, cron_expression, is_active, id]
    );

    // Reload scheduler
    await loadSchedules();

    res.json({ message: 'Scheduled message updated successfully' });
  } catch (err) {
    console.error('Error updating scheduled message:', err);
    res.status(500).json({ error: 'Failed to update scheduled message' });
  }
});

// Delete a scheduled message
router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await db.execute('DELETE FROM scheduled_messages WHERE id = ?', [id]);

    // Reload scheduler
    await loadSchedules();

    res.json({ message: 'Scheduled message deleted successfully' });
  } catch (err) {
    console.error('Error deleting scheduled message:', err);
    res.status(500).json({ error: 'Failed to delete scheduled message' });
  }
});

module.exports = router;
