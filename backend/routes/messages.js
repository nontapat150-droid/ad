const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { sendToUser } = require('../config/firebase-admin');

const router = express.Router();

// GET /api/messages/users - Get list of users to send messages to
router.get('/users', auth, async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT id, username, full_name, role 
       FROM users 
       WHERE id != ? AND status = 'approved'
       ORDER BY role ASC, full_name ASC`,
      [req.user.id]
    );
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// GET /api/messages/unread-count - Get unread count
router.get('/unread-count', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = FALSE`,
      [req.user.id]
    );
    res.json({ count: rows[0].count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/messages/inbox - Get received messages
router.get('/inbox', auth, async (req, res) => {
  try {
    const [messages] = await pool.query(
      `SELECT m.*, u.full_name AS sender_name, u.role AS sender_role 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.receiver_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(messages);
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// GET /api/messages/sent - Get sent messages
router.get('/sent', auth, async (req, res) => {
  try {
    const [messages] = await pool.query(
      `SELECT m.*, u.full_name AS receiver_name, u.role AS receiver_role 
       FROM messages m
       JOIN users u ON m.receiver_id = u.id
       WHERE m.sender_id = ?
       ORDER BY m.created_at DESC`,
      [req.user.id]
    );
    res.json(messages);
  } catch (error) {
    console.error('Error fetching sent messages:', error);
    res.status(500).json({ error: 'Failed to fetch sent messages' });
  }
});

// POST /api/messages/send - Send a new message
router.post('/send', auth, async (req, res) => {
  try {
    const { receiver_id, message } = req.body;
    if (!receiver_id || !message) {
      return res.status(400).json({ error: 'Receiver and message are required' });
    }

    const [result] = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
      [req.user.id, receiver_id, message]
    );

    // Send push notification to receiver (fire & forget)
    const senderName = req.user.full_name || req.user.username || 'ผู้ใช้';
    sendToUser(
      receiver_id,
      `💬 ข้อความจาก ${senderName}`,
      message.length > 100 ? message.substring(0, 100) + '...' : message,
      {
        type: 'new_message',
        message_id: String(result.insertId),
        sender_id: String(req.user.id),
        sender_name: senderName,
      }
    ).catch(err => console.error('Push notification failed:', err));

    res.status(201).json({ success: true, messageId: result.insertId });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// PUT /api/messages/:id/read - Mark message as read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const messageId = req.params.id;
    
    // Only the receiver can mark it as read
    const [result] = await pool.query(
      `UPDATE messages SET is_read = TRUE WHERE id = ? AND receiver_id = ?`,
      [messageId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

module.exports = router;
