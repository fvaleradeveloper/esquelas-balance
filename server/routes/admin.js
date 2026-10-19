const express = require('express');
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

function requireSaasAdmin(req, res, next) {
  if (req.user.role !== 'saas_admin') {
    return res.status(403).json({ error: 'Acceso denegado: solo administrador SAAS' });
  }
  next();
}

// GET /api/admin/tenants - Listar tenants (paginado ?limit=&offset=, max 200; compatible)
router.get('/tenants', authenticateToken, requireSaasAdmin, async (req, res) => {
  const db = req.db;
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const countResult = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'tenant'"
    );
    const result = await db.query(
      `SELECT id, email, name, phone, role, status, created_at, updated_at
       FROM users WHERE role = 'tenant' ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json({ tenants: result.rows, total: parseInt(countResult.rows[0].count, 10), limit, offset });
  } catch (error) {
    console.error('Error al listar tenants:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
// GET /api/admin/tenants/:id - Detalle de tenant (para editar sin interpolar strings)
router.get('/tenants/:id', authenticateToken, requireSaasAdmin, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'SELECT id, email, name, phone, role, status, created_at, updated_at FROM users WHERE id = $1 AND role = $2',
      [req.params.id, 'tenant']
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json({ tenant: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// POST /api/admin/tenants - Crear tenant (SAAS admin)
router.post('/tenants', authenticateToken, requireSaasAdmin, [
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre requerido (2-100 chars)'),
  validPhone('phone', true),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { email, password, name, phone } = req.body;
  try {
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, phone, role, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'tenant', 'active', NOW(), NOW())
       RETURNING id, email, name, phone, role, status, created_at, updated_at`,
      [email, passwordHash, name, phone || null]
    );
    res.status(201).json({ message: 'Tenant creado exitosamente', tenant: result.rows[0] });
  } catch (error) {
    console.error('Error al crear tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// PUT /api/admin/tenants/:id - Actualizar tenant (SAAS admin)
router.put('/tenants/:id', authenticateToken, requireSaasAdmin, [
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Email inválido'),
  validPhone('phone', true),
  body('status').optional().isIn(['active', 'inactive', 'deleted']).withMessage('Estado inválido'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { id } = req.params;
  const { name, email, phone, status } = req.body;
  try {
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email || null); }
    if (phone !== undefined) { fields.push(`phone = $${idx++}`); values.push(phone || null); }
    if (status !== undefined) { fields.push(`status = $${idx++}`); values.push(status); }
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No hay campos para actualizar' });
    }
    fields.push(`updated_at = NOW()`);
    values.push(id);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${idx} AND role = 'tenant' RETURNING id, email, name, phone, role, status, created_at, updated_at`,
      values
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json({ message: 'Tenant actualizado exitosamente', tenant: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// DELETE /api/admin/tenants/:id - Eliminar tenant (SAAS admin)
router.delete('/tenants/:id', authenticateToken, requireSaasAdmin, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id',
      [req.params.id, 'tenant']
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    res.json({ message: 'Tenant eliminado exitosamente' });
  } catch (error) {
    console.error('Error al eliminar tenant:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;