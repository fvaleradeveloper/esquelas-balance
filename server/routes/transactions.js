const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();

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
// GET /api/transactions - Listar ingresos y egresos
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const db = req.db;

  try {
    const result = await db.query(
      `SELECT id, type, description, amount, category, date, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC`,
      [req.user.id]
    );

    // Calcular balance
    const income = result.rows
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    const expense = result.rows
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    res.json({
      transactions: result.rows,
      balance: {
        income,
        expense,
        net: income - expense
      }
    });
  } catch (error) {
    console.error('Error al listar transacciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// POST /api/transactions - Crear ingreso o egreso
// ============================================
router.post('/', authenticateToken, [
  body('type').isIn(['income', 'expense']).withMessage('Tipo debe ser income o expense'),
  body('description').trim().isLength({ min: 3, max: 200 }).withMessage('Descripción requerida (3-200 chars)'),
  body('amount').isNumeric().withMessage('Monto debe ser numérico').isFloat({ min: 0 }).withMessage('Monto no puede ser negativo'),
  body('category').trim().isLength({ min: 2, max: 50 }).withMessage('Categoría requerida (2-50 chars)'),
  body('date').optional().isISO8601().withMessage('Fecha inválida'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { type, description, amount, category, date } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO transactions (user_id, type, description, amount, category, date, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, type, description, amount, category, date, created_at`,
      [req.user.id, type, description, parseFloat(amount), category, date || new Date().toISOString().slice(0, 10)]
    );

    res.status(201).json({
      message: type === 'income' ? 'Ingreso registrado' : 'Egreso registrado',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Error al crear transacción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// DELETE /api/transactions/:id - Eliminar transacción
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  const db = req.db;
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    res.json({ message: 'Transacción eliminada' });
  } catch (error) {
    console.error('Error al eliminar transacción:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;