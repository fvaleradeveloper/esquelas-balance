const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

const hash = async (pw) => await bcrypt.hash(pw, 10);

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Usuario administrador del sistema
    const adminHash = await hash('Admin12345');
    await client.query(
      `INSERT INTO users (email, password_hash, name, phone, role, status)
       VALUES ($1, $2, $3, $4, 'admin', 'active')
       ON CONFLICT (email) DO NOTHING`,
      ['admin@esquelas-balance.local', adminHash, 'Administrador del Sistema', '+51 900 000 000']
    );

    // 2. Usuario tenant de prueba
    const tenantHash = await hash('Tenant1234');
    const tenantResult = await client.query(
      `INSERT INTO users (email, password_hash, name, phone, role, status)
       VALUES ($1, $2, $3, $4, 'tenant', 'active')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      ['carlos@lasbrisas.local', tenantHash, 'Carlos Mendoza', '+51 987 654 321']
    );

    let tenantId;
    if (tenantResult.rows.length > 0) {
      tenantId = tenantResult.rows[0].id;
    } else {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', ['carlos@lasbrisas.local']);
      tenantId = existing.rows[0].id;
    }

    console.log(`✅ Tenant ID: ${tenantId}`);

    // 3. Esquelas de pago de prueba
    const receipts = [
      { clientName: 'Juan Pérez García', clientPhone: '+51 955 111 222', clientEmail: 'juan@email.com', amount: 1200.00, concept: 'Pago de alquiler enero 2026', paymentMethod: 'transferencia', reference: 'OP-2026-001234', paymentDate: '2026-01-05' },
      { clientName: 'María López Sánchez', clientPhone: '+51 966 333 444', clientEmail: 'maria@email.com', amount: 950.00, concept: 'Pago de alquiler febrero 2026', paymentMethod: 'deposito', reference: 'DEP-2026-000567', paymentDate: '2026-02-10' },
      { clientName: 'Luis Gómez Ramírez', clientPhone: '+51 977 555 666', clientEmail: 'luis@email.com', amount: 1500.00, concept: 'Pago de alquiler comercial marzo 2026', paymentMethod: 'transferencia', reference: 'OP-2026-001890', paymentDate: '2026-03-01' },
      { clientName: 'Carmen Ruiz Díaz', clientPhone: '+51 988 777 888', clientEmail: 'carmen@email.com', amount: 1100.00, concept: 'Pago de alquiler abril 2026', paymentMethod: 'yape', reference: 'YA-2026-000234', paymentDate: '2026-04-01' },
    ];

    for (const r of receipts) {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const receiptNumber = `RC-${dateStr}-${Math.floor(Math.random() * 9000 + 1000)}`;
      await client.query(
        `INSERT INTO receipts (user_id, receipt_number, client_name, client_phone, client_email,
                 amount, concept, payment_method, reference, payment_date, status, whatsapp_sent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'emitido', false)`,
        [tenantId, receiptNumber, r.clientName, r.clientPhone, r.clientEmail, r.amount,
         r.concept, r.paymentMethod, r.reference, r.paymentDate]
      );
    }
    console.log(`✅ ${receipts.length} esquelas de pago creadas`);

    // 4. Transacciones (ingresos y egresos)
    const transactions = [
      { type: 'income', description: 'Pago de alquiler - Juan Pérez', amount: 1200.00, category: 'Alquiler', date: '2026-01-05' },
      { type: 'income', description: 'Pago de alquiler - María López', amount: 950.00, category: 'Alquiler', date: '2026-02-10' },
      { type: 'income', description: 'Pago de alquiler comercial - Luis Gómez', amount: 1500.00, category: 'Alquiler Comercial', date: '2026-03-01' },
      { type: 'income', description: 'Pago de alquiler - Carmen Ruiz', amount: 1100.00, category: 'Alquiler', date: '2026-04-01' },
      { type: 'expense', description: 'Mantenimiento áreas comunes', amount: 300.00, category: 'Mantenimiento', date: '2026-02-15' },
      { type: 'expense', description: 'Servicios de limpieza', amount: 450.00, category: 'Servicios', date: '2026-03-10' },
      { type: 'expense', description: 'Impresos y papelería', amount: 80.00, category: 'Administración', date: '2026-04-05' },
    ];

    for (const t of transactions) {
      await client.query(
        `INSERT INTO transactions (user_id, type, description, amount, category, date)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, t.type, t.description, t.amount, t.category, t.date]
      );
    }
    console.log(`✅ ${transactions.length} transacciones creadas`);
    // 5. Mensajes internos de prueba
    const messages = [
      { type: 'thank-you', title: 'Gracias por su pago', body: 'Gracias por su pago de alquiler enero 2026.', recipientName: 'Juan Pérez García', recipientPhone: '+51 955 111 222' },
      { type: 'reminder', title: 'Recordatorio de pago pendiente', body: 'Le recordamos su pago de alquiler mayo 2026 vence el 2026-05-05.', recipientName: 'Carmen Ruiz Díaz', recipientPhone: '+51 988 777 888' },
      { type: 'receipt-notification', title: 'Esquela generada', body: 'Se ha generado su recibo de pago RC-2026-0012.', recipientName: 'Luis Gómez Ramírez', recipientPhone: '+51 977 555 666' },
      { type: 'general', title: 'Aviso importante', body: 'Mantenimiento programado el sábado 10 de mayo.', recipientName: 'Todos los inquilinos', recipientPhone: null },
    ];

    for (const m of messages) {
      await client.query(
        `INSERT INTO internal_messages (user_id, type, title, body, recipient_name, recipient_phone)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, m.type, m.title, m.body, m.recipientName, m.recipientPhone]
      );
    }
    console.log(`✅ ${messages.length} mensajes internos creados`);

    // 6. Aviso de cobranza de ejemplo (documento de referencia F-32, junio 2026)
    await client.query(
      `INSERT INTO collection_notices (
         user_id, page_number, doc_type, main_concept, billing_month, condo_name,
         property_type, property_code, owner_name, owner_phone,
         current_reading_date, current_reading, previous_reading_date, previous_reading,
         reading_diff_m3, tariff_note, tariff_fixed, tariff_included_m3, tariff_rate,
         prev_debt, prev_payment1, prev_payment2, prev_balance,
         meter_charge, meter_payment, meter_balance,
         pump_charge, pump_payment, pump_balance, pump_note,
         water_consumption, single_payment, month_debt, water_total,
         total_water_debt, maint_debt_next_month,
         payment_deadline, late_fee_start, due_notice, discrepancies,
         whatsapp_sent, created_at, updated_at
       ) VALUES (
         $1,35,'Aviso de Cobranza','Agua','Junio 2026','CONDOMINIO PUERTA DE HIERRO',
         'CHALET','F-32','SR. EDGAR BERCOVAL VARGAS-DELIMIRA PACH',NULL,
         '05/06/2026',1665,'05/05/2026',1642,
         23,'M3 = Cargo fijo S/ 10.50 hasta 3 m3, S/ 6.50 Soles hasta 50 m3, S/ 6.50 es la diferencia de 50 m3 a más.',10.50,3,6.50,
         31.50,31.50,0.00,0.00,
         0.00,0.00,0.00,
         60.00,60.00,0.00,'Este mes se cobra Cuota Mant.Bomba y Limpieza Cisterna',
         128.80,0.00,128.80,128.80,
         128.80,150.00,
         '22/07/2026','25/07/2026','Último día de pago 22/07/26 a partir de 25/07/26 se cobrará mora se efectúe el corte o no. Quienes tienen deuda de mantenimiento deben pagar mínimo 1 cuota atrasada y el mes actual.','[]',
         false, NOW(), NOW()
       )`,
      [tenantId]
    );
    console.log('✅ 1 aviso de cobranza de ejemplo creado (F-32, junio 2026)');

    await client.query('COMMIT');

    console.log('\n========================================');
    console.log('✅ SEED COMPLETADO EXITOSAMENTE');
    console.log('========================================\n');
    console.log('📋 CREDENCIALES DE PRUEBA:');
    console.log('----------------------------------------');
    console.log('Admin:     admin@esquelas-balance.local / Admin12345');
    console.log('Tenant:    carlos@lasbrisas.local / Tenant1234');
    console.log('----------------------------------------');
    console.log('💾 Datos incluidos:');
    console.log('   - 4 esquelas de pago');
    console.log('   - 7 transacciones (ingresos y egresos)');
    console.log('   - 4 mensajes internos');
    console.log('   - 1 aviso de cobranza (F-32, junio 2026)');
    console.log('========================================\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en el seed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();