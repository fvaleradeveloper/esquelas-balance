/* ============================================
   Esquelas-Balance - Utilidades compartidas
   Codificación: UTF-8
   ============================================ */

// API base
const API_BASE = '/api';

// Obtener token de autenticación
function getToken() {
  return localStorage.getItem('token');
}

// Obtener usuario actual
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

// Cerrar sesión
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'login.html';
}

// Fetch con autenticación y manejo de errores
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
    // Token expirado o inválido
    const data = await res.json().catch(() => ({}));
    if (data.error && data.error.includes('expirado')) {
      logout();
      return;
    }
  }

  return res;
}

// Escapar HTML (prevención XSS)
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

// Validar teléfono (formato internacional básico)
function isValidPhone(phone) {
  const cleaned = String(phone).replace(/[\s\-\+\(\)]/g, '');
  return /^\d{8,15}$/.test(cleaned);
}

// Limpiar teléfono para wa.me
function cleanPhone(phone) {
  return String(phone).replace(/[\s\-\+\(\)]/g, '');
}

// Abrir enlace WhatsApp en nueva pestaña
function openWhatsApp(url) {
  window.open(url, '_blank', 'noopener,noreferrer');
}