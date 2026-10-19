const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const router = express.Router();
const { validPhone } = require('../utils/validators');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token de acceso requerido' });
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

function requireTenant(req, res, next) {
  if (!['tenant', 'saas_admin', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Acceso denegado: rol insuficiente' });
  }
  next();
}

// GET /api/owners - Listar propietarios (paginado ?limit=&offset=, max 200; compatible)
router.get('/', authenticateToken, requireTenant, async (req, res) => {
  const db = req.db;
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM owners WHERE user_id = $1',
      [req.user.id]
    );
    const result = await db.query(
      `SELECT id, name, email, phone, property_code, property_type, status, created_at, updated_at
       FROM owners WHERE user_id = $1 ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ owners: result.rows, total: parseInt(countResult.rows[0].count, 10), limit, offset });
  } catch (error) {
    console.error('Error al listar propietarios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/owners - Crear propietario
router.post('/', authenticateToken, requireTenant, [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Nombre requerido (2-150 chars)'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
  validPhone('phone', true),
  body('property_code').trim().isLength({ min: 1, max: 50 }).withMessage('Código de propiedad requerido'),
  body('property_type').optional().trim().isLength({ max: 50 }),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { name, email, phone, property_code, property_type } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO owners (user_id, name, email, phone, property_code, property_type, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
       RETURNING id, name, email, phone, property_code, property_type, status, created_at, updated_at`,
      [req.user.id, name, email || null, phone || null, property_code, property_type || 'CHALET']
    );
    res.status(201).json({ message: 'Propietario creado exitosamente', owner: result.rows[0] });
  } catch (error) {
    console.error('Error al crear propietario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/owners/:id - Detalle de propietario
router.get('/:id', authenticateToken, requireTenant, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      `SELECT id, name, email, phone, property_code, property_type, status, created_at, updated_at
       FROM owners WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }
    res.json({ owner: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener propietario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/owners/:id - Actualizar propietario
router.put('/:id', authenticateToken, requireTenant, [
  body('name').optional().trim().isLength({ min: 2, max: 150 }).withMessage('Nombre inválido'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
  validPhone('phone', true),
  body('property_code').optional().trim().isLength({ min: 1, max: 50 }).withMessage('Código de propiedad inválido'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Estado inválido'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { name, email, phone, property_code, property_type, status } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email || null); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }
    if (property_code !== undefined) { fields.push(`property_code = $${idx++}`); values.push(property_code); }
    if (property_type !== undefined) { fields.push(`property_type = $${idx++}`); values.push(property_type); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    fields.push(`updated_at = NOW()`);
    values.push(id, req.user.id);
    const result = await db.query(
      `UPDATE owners SET ${fields.join(', ')} WHERE id = $${idx} AND user_id = $${idx + 1} RETURNING id, name, email, phone, property_code, property_type, status, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }
    res.json({ message: 'Propietario actualizado exitosamente', owner: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar propietario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/owners/:id - Eliminar propietario
router.delete('/:id', authenticateToken, requireTenant, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'DELETE FROM owners WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Propietario no encontrado' });
    }
    res.json({ message: 'Propietario eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar propietario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;