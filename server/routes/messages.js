const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const { validPhone } = require('../utils/validators');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
}

function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Datos inválidos', details: errors.array() });
  }
  next();
}

// ============================================
// GET /api/messages - Listar mensajes (paginado ?limit=&offset=, max 200; compatible)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const db = req.db;

  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM internal_messages WHERE user_id = $1',
      [req.user.id]
    );
    const result = await db.query(
      `SELECT id, type, title, body, recipient_name, recipient_phone, sent_via_whatsapp, created_at
       FROM internal_messages
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ messages: result.rows, total: parseInt(countResult.rows[0].count, 10), limit, offset });
  } catch (error) {
    console.error('Error al listar mensajes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// GET /api/messages/:id - Detalle de un mensaje (para compartir sin traer toda la lista)
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'SELECT id, type, title, body, recipient_name, recipient_phone, sent_via_whatsapp, created_at FROM internal_messages WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }
    res.json({ message: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// ============================================
// POST /api/messages - Crear mensaje interno (agradecimiento, recordatorio, etc.)
// ============================================
router.post('/', authenticateToken, [
  body('type').isIn(['thank-you', 'reminder', 'general', 'receipt-notification']).withMessage('Tipo inválido'),
  body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Título requerido (3-100 chars)'),
  body('body').trim().isLength({ min: 5, max: 2000 }).withMessage('Cuerpo del mensaje requerido (5-2000 chars)'),
  body('recipientName').trim().notEmpty().withMessage('Nombre del destinatario requerido'),
  validPhone('recipientPhone', true),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { type, title, body, recipientName, recipientPhone } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO internal_messages (user_id, type, title, body, recipient_name, recipient_phone, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, type, title, body, recipient_name, recipient_phone, created_at`,
      [req.user.id, type, title, body, recipientName, recipientPhone || null]
    );

    res.status(201).json({
      message: 'Mensaje creado exitosamente',
      message: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear mensaje:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// PATCH /api/messages/:id/whatsapp - Marcar mensaje como enviado por WhatsApp
// ============================================
router.patch('/:id/whatsapp', authenticateToken, async (req, res) => {
  const db = req.db;
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE internal_messages SET sent_via_whatsapp = true
       WHERE id = $1 AND user_id = $2
       RETURNING id, sent_via_whatsapp`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    res.json({ message: 'Mensaje marcado como enviado por WhatsApp' });
  } catch (error) {
    console.error('Error al marcar WhatsApp:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;