/* ============================================
   Esquelas-Balance - Utilidades compartidas
   Codificacion: UTF-8
   ============================================ */

// API base
const API_BASE = '/api';

// Obtener token de autenticacion
function getToken() {
  return localStorage.getItem('token');
}

// Obtener usuario actual
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

// Cerrar sesion
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Fetch con autenticacion y manejo de errores
async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  const res = await fetch(API_BASE + endpoint, Object.assign({}, options, { headers }));

  if (res.status === 401 || res.status === 403) {
    const data = await res.json().catch(() => ({}));
    if (data.error && data.error.includes('expirado')) {
      logout();
      return;
    }
  }

  return res;
}

// Escapar HTML (prevencion XSS)
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str == null ? '' : str);
  return div.innerHTML;
}

// Mostrar alerta en un contenedor
function showAlert(containerId, message, type = 'success') {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  setTimeout(() => {
    container.innerHTML = '';
  }, 5000);
}

// Formatear moneda
function formatCurrency(amount) {
  return 'S/ ' + parseFloat(amount).toFixed(2);
}

// Formatear fecha
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-PE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Validar telefono (formato internacional basico)
function isValidPhone(phone) {
  const cleaned = String(phone).replace(/[\\s\\-\\+\\(\\)]/g, '');
  return /^\\d{8,15}$/.test(cleaned);
}

// Limpiar telefono para wa.me
function cleanPhone(phone) {
  return String(phone).replace(/[\\s\\-\\+\\(\\)]/g, '');
}

// Abrir enlace WhatsApp en nueva pestaña
function openWhatsApp(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ============ ENDPOINTS DE LOGIN Y REGISTRO ============

// === CABECERAS DE RESPUESTA DEL SERVIDOR ===
// - Contenido: UTF-8
// - Cache: nunca para paginas dinamicas
// - Prevencion de XSS: X-Content-Type-Options nosniff, X-Frame-Options SAMEORIGIN
// - Proteccion CORS estricta: solo origen autorizado

app.use((req, res, next) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// Ruta pagina de login
app.get('/html/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'login.html'));
});

// Ruta pagina de registro
app.get('/html/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'register.html'));
});

// Validacion y login
app.post('/api/validate-login', [
  body('email').isEmail().normalizeEmail().withMessage('Correo invalido'),
  body('password').isLength({ min: 6 }).withMessage('Contrasena muy corta'),
], handleValidationErrors, async (req, res) => {
  const { email, password } = req.body;
  const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  if (existing.rows.length === 0) {
    return res.status(422).json({ error: 'Credenciales invalidas' });
  }
  const user = existing.rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(422).json({ error: 'Credenciales invalidas' });
  }
  if (user.status !== 'active') {
    return res.status(403).json({ error: 'Cuenta inactiva' });
  }
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '12h' }
  );
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.get('/api/check-login', authenticateToken, (req, res) => {
  res.json({ ok: true, user: req.user, role: req.user.role });
});