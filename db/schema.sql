-- ============================================
-- Esquema de Base de Datos - Esquelas-Balance
-- Compatible con Neon (PostgreSQL)
-- Codificacion: UTF-8
-- ============================================

-- Extension para UUIDs (opcional, se usa serial para simplicidad)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  role VARCHAR(50) NOT NULL DEFAULT 'tenant',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar que roles de SAAS y propietario existan (ejecutar en DB existente)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'manager', 'resident', 'inquilino', 'tenant', 'saas_admin', 'owner'));

-- Tabla de propietarios (gestionada por cada tenant)
CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  property_code VARCHAR(50) NOT NULL,
  property_type VARCHAR(50) DEFAULT 'CHALET',
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_collection_notices_user_id ON collection_notices(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_internal_messages_user_id ON internal_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_owners_user_id ON owners(user_id);
CREATE INDEX IF NOT EXISTS idx_owners_property_code ON owners(property_code);

-- Tabla de esquelas de pago (recibos)
CREATE TABLE IF NOT EXISTS receipts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receipt_number VARCHAR(50) NOT NULL,
  client_name VARCHAR(100) NOT NULL,
  client_phone VARCHAR(50) NOT NULL,
  client_email VARCHAR(255),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  concept TEXT NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference VARCHAR(100),
  payment_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'emitido',
  whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de transacciones (ingresos y egresos)
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  category VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de mensajes internos
CREATE TABLE IF NOT EXISTS internal_messages (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'general',
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  recipient_name VARCHAR(100) NOT NULL,
  recipient_phone VARCHAR(50),
  sent_via_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de avisos de cobranza (plantilla: agua + mantenimiento, una pagina)
CREATE TABLE IF NOT EXISTS collection_notices (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_number INTEGER,
  doc_type VARCHAR(50) NOT NULL DEFAULT 'Aviso de Cobranza',
  main_concept VARCHAR(50) NOT NULL DEFAULT 'Agua',
  billing_month VARCHAR(50) NOT NULL,
  condo_name VARCHAR(150) NOT NULL,
  property_type VARCHAR(50) NOT NULL DEFAULT 'CHALET',
  property_code VARCHAR(50) NOT NULL,
  owner_name VARCHAR(200) NOT NULL,
  owner_phone VARCHAR(50),
  current_reading_date VARCHAR(20),
  current_reading NUMERIC(12,0),
  previous_reading_date VARCHAR(20),
  previous_reading NUMERIC(12,0),
  reading_diff_m3 NUMERIC(12,2),
  tariff_note TEXT,
  tariff_fixed NUMERIC(12,2),
  tariff_included_m3 NUMERIC(12,2),
  tariff_rate NUMERIC(12,2),
  prev_debt NUMERIC(12,2) NOT NULL DEFAULT 0,
  prev_payment1 NUMERIC(12,2) NOT NULL DEFAULT 0,
  prev_payment2 NUMERIC(12,2) NOT NULL DEFAULT 0,
  prev_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  meter_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  meter_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  meter_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pump_charge NUMERIC(12,2) NOT NULL DEFAULT 0,
  pump_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  pump_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  pump_note TEXT,
  water_consumption NUMERIC(12,2) NOT NULL DEFAULT 0,
  single_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  month_debt NUMERIC(12,2) NOT NULL DEFAULT 0,
  water_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_water_debt NUMERIC(12,2) NOT NULL DEFAULT 0,
  maint_debt_next_month NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_deadline VARCHAR(20),
  late_fee_start VARCHAR(20),
  due_notice TEXT,
  discrepancies JSONB,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_collection_notices_user_id ON collection_notices(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_number ON receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_internal_messages_user_id ON internal_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);