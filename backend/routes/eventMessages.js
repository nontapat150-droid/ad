const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { sendEventNotification } = require('../utils/eventNotifier');

// Get all event messages
router.get('/', auth, async (req, res) => {
  try {
    const [messages] = await db.execute('SELECT * FROM event_messages ORDER BY id ASC');
    res.json(messages);
  } catch (err) {
    console.error('Error fetching event messages:', err);
    res.status(500).json({ error: 'Failed to fetch event messages' });
  }
});

// Create a custom event message
router.post('/', auth, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { event_key, event_label, message_template, target_role, is_active } = req.body;

  if (!event_key || !event_label || !message_template) {
    return res.status(400).json({ error: 'event_key, event_label, and message_template are required' });
  }

  try {
    const [result] = await db.execute(
      `INSERT INTO event_messages (event_key, event_label, message_template, target_role, is_active) 
       VALUES (?, ?, ?, ?, ?)`,
      [event_key, event_label, message_template, target_role || 'all', is_active ?? true]
    );

    res.status(201).json({ message: 'Event message created successfully', id: result.insertId });
  } catch (err) {
    console.error('Error creating event message:', err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Event key already exists' });
    }
    res.status(500).json({ error: 'Failed to create event message' });
  }
});

// Update an event message
router.put('/:id', auth, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;
  const { event_label, message_template, target_role, is_active } = req.body;

  if (!message_template) {
    return res.status(400).json({ error: 'message_template is required' });
  }

  try {
    // Only update fields that make sense. We usually shouldn't change event_key if it's standard.
    await db.execute(
      `UPDATE event_messages 
       SET event_label = ?, message_template = ?, target_role = ?, is_active = ? 
       WHERE id = ?`,
      [event_label, message_template, target_role || 'all', is_active, id]
    );

    res.json({ message: 'Event message updated successfully' });
  } catch (err) {
    console.error('Error updating event message:', err);
    res.status(500).json({ error: 'Failed to update event message' });
  }
});

// Delete a custom event message
router.delete('/:id', auth, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { id } = req.params;

  try {
    // We might want to prevent deleting standard events, but for flexibility we allow it or check key.
    const [events] = await db.execute('SELECT event_key FROM event_messages WHERE id = ?', [id]);
    if (events.length > 0) {
      const standardKeys = ['job_dispatch', 'check_in', 'oil_record', 'inventory_dispatch'];
      if (standardKeys.includes(events[0].event_key)) {
        return res.status(400).json({ error: 'Cannot delete standard system events, you can only disable them.' });
      }
    }

    await db.execute('DELETE FROM event_messages WHERE id = ?', [id]);
    res.json({ message: 'Event message deleted successfully' });
  } catch (err) {
    console.error('Error deleting event message:', err);
    res.status(500).json({ error: 'Failed to delete event message' });
  }
});

// Test an event message
router.post('/:key/test', auth, requireRole(['admin', 'super_admin']), async (req, res) => {
  const { key } = req.params;
  
  // Dummy variables based on the key to show in the test message
  const mockVariables = {
    job_id: 'JOB-9999',
    tech_name: req.user.full_name || 'ชื่อผู้ทดสอบ',
    description: 'ข้อความทดสอบจากระบบ',
    location: 'สถานที่ทดสอบ',
    appointment_time: '10:00 น.',
    amount: '500',
    items: 'สายไฟ 10 เมตร, เทปพันสายไฟ 1 ม้วน'
  };

  try {
    // Send to the current admin user who clicked "Test"
    // For standard events that target "target_user", we pass req.user.id as the targetUserId.
    // For events that target "all" or "admin", it will ignore targetUserId and send to all admins.
    // To ensure the tester gets it even if it's "target_user":
    await sendEventNotification(key, mockVariables, req.user.id, req.user.id);
    res.json({ message: 'Test message sent successfully' });
  } catch (err) {
    console.error('Error testing event message:', err);
    res.status(500).json({ error: 'Failed to send test message' });
  }
});

module.exports = router;
