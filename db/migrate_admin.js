const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Crear usuario saas_admin si no existe
    const saasHash = await bcrypt.hash('SaasAdmin1234', 10);
    const existing = await client.query('SELECT id FROM users WHERE email = $1', ['admin@saas-balance.local']);
    if (existing.rows.length === 0) {
      await client.query(
        `INSERT INTO users (email, password_hash, name, phone, role, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'saas_admin', 'active', NOW(), NOW())`,
        ['admin@saas-balance.local', saasHash, 'Administrador SAAS', '+51 900 000 000']
      );
      console.log('✅ Usuario saas_admin creado: admin@saas-balance.local / SaasAdmin1234');
    } else {
      console.log('⚠️  Usuario saas_admin ya existe');
    }

    await client.query('COMMIT');
    console.log('✅ Migración de administrador SAAS completada');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en migración:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();