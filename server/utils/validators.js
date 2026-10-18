// Validador de teléfono permisivo: acepta formatos con espacios, guiones,
// paréntesis y prefijo internacional (ej: +51 988 111 222, (51)988-111222)
const { body } = require('express-validator');

function validPhone(field = 'phone', optional = false) {
  const validator = body(field)
    .trim()
    .custom((value) => {
      if (value === undefined || value === null || value === '') {
        return true;
      }
      const cleaned = String(value).replace(/[\s\-\+\(\)]/g, '');
      if (!/^\d{8,15}$/.test(cleaned)) {
        throw new Error('Teléfono inválido (use 8-15 dígitos, con o sin +)');
      }
      return true;
    });
  return optional ? validator.optional() : validator;
}

module.exports = { validPhone };