const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const router = express.Router();

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }
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
// POST /api/auth/register - Registrar nuevo usuario (tenant)
// ============================================
router.post('/register', [
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido'),
  body('password').isLength({ min: 6 }).withMessage('Contraseña mínima 6 caracteres'),
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Nombre requerido (2-100 chars)'),
  body('phone').optional().trim().isMobilePhone('any').withMessage('Teléfono inválido'),
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
       RETURNING id, email, name, phone, role, status, created_at`,
      [email, passwordHash, name, phone || null]
    );
    const user = result.rows[0];
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// POST /api/auth/login - Iniciar sesión
// ============================================
router.post('/login', [
  body('email').isEmail().normalizeEmail().withMessage('Email válido requerido'),
  body('password').notEmpty().withMessage('Contraseña requerida'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Cuenta inactiva, contacte al administrador' });
    }
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// GET /api/auth/profile - Perfil del usuario autenticado
// ============================================
router.get('/profile', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'SELECT id, email, name, phone, role, status, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// POST /api/auth/change-password - Cambiar contraseña
// ============================================
router.post('/change-password', authenticateToken, [
  body('currentPassword').notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword').isLength({ min: 6 }).withMessage('Nueva contraseña mínima 6 caracteres'),
], handleValidationErrors, async (req, res) => {
  const db = req.db;
  const { currentPassword, newPassword } = req.body;
  try {
    const result = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);
    res.json({ message: 'Contraseña actualizada exitosamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
module.exports = router;