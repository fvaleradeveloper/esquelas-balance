const express = require('express');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const { validPhone } = require('../utils/validators');

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
// POST /api/whatsapp/generate - Generar enlace wa.me para compartir
// ============================================
router.post('/generate', authenticateToken, [
  validPhone('phone'),
  body('message').trim().isLength({ min: 1, max: 1000 }).withMessage('Mensaje requerido (máx 1000 chars)'),
], handleValidationErrors, (req, res) => {
  const { phone, message } = req.body;

  // Limpiar teléfono: quitar espacios, guiones, paréntesis, +
  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  // Codificar mensaje para URL
  const encodedMessage = encodeURIComponent(message);

  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  res.json({
    whatsappUrl,
    phone: cleanPhone,
    message,
    instructions: 'Abra este enlace en WhatsApp Web o WhatsApp Desktop para enviar el mensaje'
  });
});

// ============================================
// POST /api/whatsapp/receipt - Generar mensaje de esquela de pago para WhatsApp
// ============================================
router.post('/receipt', authenticateToken, [
  validPhone('phone'),
  body('receiptNumber').trim().notEmpty().withMessage('Número de recibo requerido'),
  body('clientName').trim().notEmpty().withMessage('Nombre del cliente requerido'),
  body('amount').isNumeric().withMessage('Monto requerido'),
  body('concept').trim().notEmpty().withMessage('Concepto requerido'),
  body('paymentMethod').trim().notEmpty().withMessage('Método de pago requerido'),
  body('paymentDate').trim().notEmpty().withMessage('Fecha de pago requerida'),
], handleValidationErrors, (req, res) => {
  const { phone, receiptNumber, clientName, amount, concept, paymentMethod, paymentDate } = req.body;

  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  const message = `*🧾 Esquela de Pago - Esquelas-Balance*\n\n` +
    `*Número:* ${receiptNumber}\n` +
    `*Cliente:* ${clientName}\n` +
    `*Monto:* S/ ${parseFloat(amount).toFixed(2)}\n` +
    `*Concepto:* ${concept}\n` +
    `*Método:* ${paymentMethod}\n` +
    `*Fecha:* ${paymentDate}\n\n` +
    `Gracias por su pago.`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  res.json({
    whatsappUrl,
    phone: cleanPhone,
    message,
    type: 'receipt'
  });
});

// ============================================
// POST /api/whatsapp/thank-you - Mensaje de agradecimiento por pago
// ============================================
router.post('/thank-you', authenticateToken, [
  validPhone('phone'),
  body('clientName').trim().notEmpty().withMessage('Nombre del cliente requerido'),
  body('amount').isNumeric().withMessage('Monto requerido'),
  body('concept').trim().notEmpty().withMessage('Concepto requerido'),
], handleValidationErrors, (req, res) => {
  const { phone, clientName, amount, concept } = req.body;

  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  const message = `*💰 Gracias por su pago - Esquelas-Balance*\n\n` +
    `Estimado/a ${clientName},\n\n` +
    `Hemos recibido su pago de *S/ ${parseFloat(amount).toFixed(2)}* por: ${concept}.\n\n` +
    `¡Gracias por su confianza y puntualidad!\n\n` +
    `Quedamos a su disposición.`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  res.json({
    whatsappUrl,
    phone: cleanPhone,
    message,
    type: 'thank-you'
  });
});

// ============================================
// POST /api/whatsapp/reminder - Mensaje de recordatorio de pago
// ============================================
router.post('/reminder', authenticateToken, [
  validPhone('phone'),
  body('clientName').trim().notEmpty().withMessage('Nombre del cliente requerido'),
  body('amount').isNumeric().withMessage('Monto requerido'),
  body('concept').trim().notEmpty().withMessage('Concepto requerido'),
  body('dueDate').trim().notEmpty().withMessage('Fecha de vencimiento requerida'),
], handleValidationErrors, (req, res) => {
  const { phone, clientName, amount, concept, dueDate } = req.body;

  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');

  const message = `*⚠️ Recordatorio de Pago - Esquelas-Balance*\n\n` +
    `Estimado/a ${clientName},\n\n` +
    `Le recordamos que tiene un pago pendiente:\n` +
    `*Concepto:* ${concept}\n` +
    `*Monto:* S/ ${parseFloat(amount).toFixed(2)}\n` +
    `*Fecha de vencimiento:* ${dueDate}\n\n` +
    `Por favor, realice el pago antes de la fecha indicada.\n\n` +
    `Quedamos atentos.`;

  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

  res.json({
    whatsappUrl,
    phone: cleanPhone,
    message,
    type: 'reminder'
  });
});
// POST /api/whatsapp/receipt-notification - Notificacion de esquela emitida
router.post('/receipt-notification', authenticateToken, [
  validPhone('phone'),
  body('clientName').trim().notEmpty().withMessage('Nombre del cliente requerido'),
  body('receiptNumber').trim().notEmpty().withMessage('Numero de esquela requerido'),
  body('amount').isNumeric().withMessage('Monto requerido'),
  body('concept').trim().notEmpty().withMessage('Concepto requerido'),
], handleValidationErrors, (req, res) => {
  const { phone, clientName, receiptNumber, amount, concept, paymentMethod } = req.body;
  const cleanPhone = phone.replace(/[\s\-\+\(\)]/g, '');
  let message = '*Notificacion de Esquela - Esquelas-Balance*\n\n';
  message += 'Estimado/a ' + clientName + ',\n\n';
  message += 'Le informamos que se emitio su esquela *' + receiptNumber + '*:\n';
  message += '*Concepto:* ' + concept + '\n';
  message += '*Monto:* S/ ' + parseFloat(amount).toFixed(2) + '\n';
  if (paymentMethod) { message += '*Metodo:* ' + paymentMethod + '\n'; }
  message += '\nQuedamos atentos a su pago. Gracias.';
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = 'https://wa.me/' + cleanPhone + '?text=' + encodedMessage;
  res.json({ whatsappUrl, phone: cleanPhone, message, type: 'receipt-notification' });
});


module.exports = router;