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
// GET /api/receipts - Listar esquelas del usuario
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const db = req.db;

  try {
    const result = await db.query(
      `SELECT r.id, r.receipt_number, r.client_name, r.client_phone, r.client_email,
              r.amount, r.concept, r.payment_method, r.reference, r.payment_date,
              r.status, r.whatsapp_sent, r.created_at, r.updated_at
       FROM receipts r
       WHERE r.user_id = $1
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.json({ receipts: result.rows });
  } catch (error) {
    console.error('Error al listar esquelas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// POST /api/receipts - Crear nueva esquela de pago
// ============================================
router.post('/', authenticateToken, [
  body('clientName').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre del cliente requerido'),
  validPhone('clientPhone'),
  body('clientEmail').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
  body('amount').isNumeric().withMessage('Monto debe ser numérico').isFloat({ min: 0 }).withMessage('Monto no puede ser negativo'),
  body('concept').trim().isLength({ min: 3, max: 200 }).withMessage('Concepto requerido (3-200 chars)'),
  body('paymentMethod').isIn(['efectivo', 'transferencia', 'deposito', 'yape', 'plin', 'tarjeta']).withMessage('Método de pago inválido'),
  body('reference').optional().trim().isLength({ max: 100 }).withMessage('Referencia demasiado larga'),
  body('paymentDate').optional().isISO8601().withMessage('Fecha de pago inválida'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { clientName, clientPhone, clientEmail, amount, concept, paymentMethod, reference, paymentDate } = req.body;

  try {
    // Generar número de comprobante: RC + fecha + secuencia
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await db.query('SELECT COUNT(*) FROM receipts WHERE user_id = $1', [req.user.id]);
    const seq = (parseInt(countResult.rows[0].count) + 1).toString().padStart(4, '0');
    const receiptNumber = `RC-${dateStr}-${seq}`;

    const result = await db.query(
      `INSERT INTO receipts (user_id, receipt_number, client_name, client_phone, client_email,
               amount, concept, payment_method, reference, payment_date, status, whatsapp_sent, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'emitido', false, NOW(), NOW())
       RETURNING id, receipt_number, client_name, client_phone, client_email, amount, concept,
                 payment_method, reference, payment_date, status, whatsapp_sent, created_at`,
      [req.user.id, receiptNumber, clientName, clientPhone, clientEmail || null, parseFloat(amount),
       concept, paymentMethod, reference || null, paymentDate || new Date().toISOString().slice(0, 10)]
    );

    res.status(201).json({
      message: 'Esquela de pago creada exitosamente',
      receipt: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear esquela:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// GET /api/receipts/:id - Detalle de una esquela
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.db;
  const { id } = req.params;

  try {
    const result = await db.query(
      `SELECT r.*, u.email as user_email
       FROM receipts r
       JOIN users u ON r.user_id = u.id
       WHERE r.id = $1 AND r.user_id = $2`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Esquela no encontrada' });
    }

    res.json({ receipt: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener esquela:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// PATCH /api/receipts/:id/whatsapp - Marcar como enviada por WhatsApp
// ============================================
router.patch('/:id/whatsapp', authenticateToken, async (req, res) => {
  const db = req.db;
  const { id } = req.params;

  try {
    const result = await db.query(
      `UPDATE receipts SET whatsapp_sent = true, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, whatsapp_sent`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Esquela no encontrada' });
    }

    res.json({ message: 'Esquela marcada como enviada por WhatsApp', receipt: result.rows[0] });
  } catch (error) {
    console.error('Error al marcar WhatsApp:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;