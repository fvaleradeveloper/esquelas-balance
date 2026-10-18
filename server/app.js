require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const { Pool } = require('pg');

// ============================================
// CONFIGURACIÓN DE BASE DE DATOS (Neon / PostgreSQL)
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => {
  console.log('✅ Conectado a Neon (PostgreSQL)');
});

pool.on('error', (err) => {
  console.error('❌ Error inesperado en cliente de base de datos', err);
});

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3100;

// ============================================
// SEGURIDAD ANTI-HACKERS - HARDENING COMPLETO
// ============================================

// 1. Helmet - Headers de seguridad (CSP, X-Frame-Options, HSTS, etc.)
// Nota: script-src permite 'unsafe-inline' porque el frontend vanilla usa scripts
// inline en las páginas HTML, y el CDN de cdnjs para jsPDF (generación de PDFs).
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'", "data:"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// 2. Rate limiting global - prevenir DDoS y fuerza bruta
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: { error: 'Demasiadas solicitudes, intente de nuevo más tarde' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// 3. Rate limiting específico para login (más estricto)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // máximo 10 intentos de login por IP
  message: { error: 'Demasiados intentos de inicio de sesión, intente de nuevo en 15 minutos' },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Límite de tamaño de payload - prevenir DDoS por payload grande
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 5. CORS restringido (solo orígenes permitidos en producción)
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3100'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
}));

// 6. Archivos estáticos
app.use(express.static(path.join(__dirname, '..', 'public')));

// ============================================
// MIDDLEWARE: inyectar pool en req para las rutas
// ============================================
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// ============================================
// RUTAS DE LA API
// ============================================
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/receipts', require('./routes/receipts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/owners', require('./routes/owners'));
app.use('/api/admin', require('./routes/admin'));

// Health check (para verificar el despliegue en vivo)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'esquelas-balance', version: '1.0.0', time: new Date().toISOString() });
});

// Ruta raíz - servir landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'index.html'));
});

// 404 - servir index para SPA o API
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Endpoint no encontrado' });
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'html', 'index.html'));
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// Exportar para Vercel y para uso local
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`🚀 Esquelas-Balance escuchando en http://localhost:${PORT}`);
  });
}

module.exports = { app, pool };