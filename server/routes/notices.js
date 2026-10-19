const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { computeNotice, round2 } = require('../utils/noticeCalc');

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

const moneyChecks = [
  'prevDebt', 'prevPayment1', 'prevPayment2',
  'meterCharge', 'meterPayment', 'pumpCharge', 'pumpPayment',
  'singlePayment', 'maintDebtNextMonth',
];

const noticeValidators = [
  body('billingMonth').trim().isLength({ min: 3, max: 50 }).withMessage('Mes de cobranza requerido'),
  body('condoName').trim().isLength({ min: 3, max: 150 }).withMessage('Nombre del condominio requerido'),
  body('propertyType').optional().trim().isLength({ max: 50 }),
  body('propertyCode').trim().isLength({ min: 1, max: 50 }).withMessage('Código del inmueble requerido'),
  body('ownerName').trim().isLength({ min: 3, max: 200 }).withMessage('Nombre del propietario requerido'),
  validPhone('ownerPhone', true),
  body('currentReading').isNumeric().withMessage('Lectura actual debe ser numérica'),
  body('previousReading').isNumeric().withMessage('Lectura anterior debe ser numérica'),
  body('pageNumber').optional().isInt({ min: 1 }).withMessage('Número de página inválido'),
];

for (const field of moneyChecks) {
  noticeValidators.push(
    body(field).optional().isNumeric().withMessage(`${field} debe ser numérico`)
  );
}
noticeValidators.push(
  body('tariffFixed').optional().isNumeric().withMessage('Cargo fijo debe ser numérico'),
  body('tariffIncludedM3').optional().isNumeric().withMessage('M3 incluidos deben ser numéricos'),
  body('tariffRate').optional().isNumeric().withMessage('Tarifa por m3 debe ser numérica'),
  body('tariffNote').optional().trim().isLength({ max: 500 }).withMessage('Nota de tarifa demasiado larga'),
  body('pumpNote').optional().trim().isLength({ max: 300 }).withMessage('Nota de bomba demasiado larga'),
  body('dueNotice').optional().trim().isLength({ max: 600 }).withMessage('Aviso de vencimiento demasiado largo')
);

// ============================================
// GET /api/notices - Listar avisos (paginado ?limit=&offset=, max 200; compatible)
// ============================================
router.get('/', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    const countResult = await db.query(
      'SELECT COUNT(*) FROM collection_notices WHERE user_id = $1',
      [req.user.id]
    );
    const result = await db.query(
      `SELECT id, page_number, doc_type, main_concept, billing_month, condo_name,
              property_type, property_code, owner_name, owner_phone,
              current_reading, previous_reading, reading_diff_m3,
              water_consumption, month_debt, water_total,
              total_water_debt, maint_debt_next_month,
              payment_deadline, late_fee_start, whatsapp_sent, created_at
       FROM collection_notices
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );

    // Recordatorio automatico de pago al pasarse la fecha de cobro
    try {
      for (const n of result.rows) {
        if (!n.payment_deadline) continue;
        const parts = n.payment_deadline.split('/');
        if (parts.length !== 3) continue;
        const deadline = new Date(parts[2], parts[1] - 1, parts[0]);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deadline >= today) continue;

        const title = 'Recordatorio Aviso #' + n.id;
        const exists = await db.query(
          `SELECT id FROM internal_messages WHERE user_id = $1 AND type = 'reminder' AND title = $2`,
          [req.user.id, title]
        );
        if (exists.rows.length === 0) {
          await db.query(
            `INSERT INTO internal_messages (user_id, type, title, body, recipient_name, recipient_phone, created_at)
             VALUES ($1, 'reminder', $2, $3, $4, $5, NOW())`,
            [req.user.id, title,
             'Pago vencido: ' + n.billing_month + ' - ' + n.property_type + ' ' + n.property_code + ' - Total agua S/ ' + n.total_water_debt + '. Fecha limite: ' + n.payment_deadline,
             n.owner_name, n.owner_phone || null]
          );
          console.log('⏰ Recordatorio automatico creado para aviso #' + n.id);
        }
      }
    } catch (remError) {
      console.error('Error al generar recordatorios automaticos:', remError);
    }

    res.json({ notices: result.rows, total: parseInt(countResult.rows[0].count, 10), limit, offset });
  } catch (error) {
    console.error('Error al listar avisos:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// GET /api/notices/:id - Detalle de un aviso (datos para la plantilla)
// ============================================
router.get('/:id', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'SELECT * FROM collection_notices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aviso no encontrado' });
    }
    res.json({ notice: result.rows[0] });
  } catch (error) {
    console.error('Error al obtener aviso:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// POST /api/notices/calculate - Calcular sin guardar (vista previa)
// ============================================
router.post('/calculate', authenticateToken, noticeValidators, handleValidationErrors, (req, res) => {
  const { computed, discrepancies } = computeNotice(req.body);
  res.json({ computed, discrepancies });
});

// ============================================
// POST /api/notices - Crear aviso (calcula, valida y guarda)
// ============================================
router.post('/', authenticateToken, noticeValidators, handleValidationErrors, async (req, res) => {
  const db = req.db;
  const b = req.body;

  const { computed, discrepancies, tariff } = computeNotice(b);

  try {
    const result = await db.query(
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
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,$19,
         $20,$21,$22,$23,
         $24,$25,$26,
         $27,$28,$29,$30,
         $31,$32,$33,$34,
         $35,$36,
         $37,$38,$39,$40,
         false, NOW(), NOW()
       )
       RETURNING *`,
      [
        req.user.id,
        b.pageNumber || null,
        b.docType || 'Aviso de Cobranza',
        b.mainConcept || 'Agua',
        b.billingMonth,
        b.condoName,
        (b.propertyType || 'CHALET').toUpperCase(),
        b.propertyCode,
        b.ownerName,
        b.ownerPhone || null,
        b.currentReadingDate || null,
        b.currentReading,
        b.previousReadingDate || null,
        b.previousReading,
        computed.readingDiffM3,
        b.tariffNote || 'M3 = Cargo fijo S/ 10.50 hasta 3 m3, S/ 6.50 Soles hasta 50 m3, S/ 6.50 es la diferencia de 50 m3 a más.',
        tariff.fixedCharge,
        tariff.includedM3,
        tariff.ratePerM3,
        round2(b.prevDebt || 0),
        round2(b.prevPayment1 || 0),
        round2(b.prevPayment2 || 0),
        computed.prevBalance,
        round2(b.meterCharge || 0),
        round2(b.meterPayment || 0),
        computed.meterBalance,
        round2(b.pumpCharge || 0),
        round2(b.pumpPayment || 0),
        computed.pumpBalance,
        b.pumpNote || 'Este mes se cobra Cuota Mant.Bomba y Limpieza Cisterna',
        computed.waterConsumption,
        round2(b.singlePayment || 0),
        computed.monthDebt,
        computed.waterTotal,
        computed.totalWaterDebt,
        computed.maintDebtNextMonth,
        b.paymentDeadline || null,
        b.lateFeeStart || null,
        b.dueNotice || 'Último día de pago 22/07/26 a partir de 25/07/26 se cobrará mora se efectúe el corte o no. Quienes tienen deuda de mantenimiento deben pagar mínimo 1 cuota atrasada y el mes actual.',
        JSON.stringify(discrepancies),
      ]
    );

    res.status(201).json({
      message: 'Aviso de cobranza creado exitosamente',
      notice: result.rows[0],
      computed,
      discrepancies,
    });
  } catch (error) {
    console.error('Error al crear aviso:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// PATCH /api/notices/:id/whatsapp - Marcar aviso como enviado por WhatsApp
// ============================================
router.patch('/:id/whatsapp', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      `UPDATE collection_notices SET whatsapp_sent = true, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, whatsapp_sent`,
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aviso no encontrado' });
    }
    res.json({ message: 'Aviso marcado como enviado por WhatsApp', notice: result.rows[0] });
  } catch (error) {
    console.error('Error al marcar aviso:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// ============================================
// DELETE /api/notices/:id - Eliminar aviso
// ============================================
router.delete('/:id', authenticateToken, async (req, res) => {
  const db = req.db;
  try {
    const result = await db.query(
      'DELETE FROM collection_notices WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Aviso no encontrado' });
    }
    res.json({ message: 'Aviso eliminado' });
  } catch (error) {
    console.error('Error al eliminar aviso:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
module.exports = router;