/* ============================================
   Esquelas-Balance - Avisos de Cobranza (plantilla agua + mantenimiento)
   ============================================ */

let currentNotice = null;

function fmtMoney(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

function fmtInt(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0';
  return Math.trunc(n).toLocaleString('en-US');
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.classList.remove('show');
}
window.closeModal = closeModal;

function openNoticeModal() {
  if (typeof window._openNoticeModal !== 'function') window._openNoticeModal = openNoticeModal;
  const form = document.getElementById('noticeForm');
  if (form) form.reset();
  const alertBox = document.getElementById('noticeAlert');
  if (alertBox) alertBox.innerHTML = '';
  const prevBox = document.getElementById('previewCalcBox');
  if (prevBox) prevBox.innerHTML = '';
  const pt = document.getElementById('nPropType');
  if (pt) pt.value = 'CHALET';
  const m = document.getElementById('noticeModal');
  if (m) m.classList.add('show');
}
window.openNoticeModal = openNoticeModal;

function collectNoticeForm() {
  const val = (id) => document.getElementById(id).value.trim();
  const num = (id) => {
    const v = document.getElementById(id).value.trim();
    return v === '' ? undefined : Number(v);
  };
  return {
    pageNumber: val('nPage') === '' ? undefined : Number(val('nPage')),
    billingMonth: val('nMonth'),
    condoName: val('nCondo'),
    propertyType: val('nPropType') || 'CHALET',
    propertyCode: val('nPropCode'),
    ownerName: val('nOwner'),
    ownerPhone: val('nOwnerPhone') || undefined,
    currentReadingDate: val('nCurDate') || undefined,
    currentReading: Number(val('nCur')),
    previousReadingDate: val('nPrevDate') || undefined,
    previousReading: Number(val('nPrev')),
    tariffFixed: num('nTariffFixed'),
    tariffIncludedM3: num('nTariffIncluded'),
    tariffRate: num('nTariffRate'),
    prevDebt: num('nPrevDebt') ?? 0,
    prevPayment1: num('nPrevPay1') ?? 0,
    prevPayment2: num('nPrevPay2') ?? 0,
    meterCharge: num('nMeterCharge') ?? 0,
    meterPayment: num('nMeterPay') ?? 0,
    pumpCharge: num('nPumpCharge') ?? 0,
    pumpPayment: num('nPumpPay') ?? 0,
    singlePayment: num('nSinglePay') ?? 0,
    maintDebtNextMonth: num('nMaintDebt') ?? 0,
    paymentDeadline: val('nDeadline') || undefined,
    lateFeeStart: val('nLateFee') || undefined,
  };
}

async function previewNoticeCalc() {
  const box = document.getElementById('previewCalcBox');
  try {
    const res = await apiFetch('/notices/calculate', {
      method: 'POST',
      body: JSON.stringify(collectNoticeForm())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al calcular');
    const c = data.computed;
    box.innerHTML = `<div class="alert alert-info">Diferencia: <strong>${c.readingDiffM3} m3</strong> · Consumo: <strong>S/ ${fmtMoney(c.waterConsumption)}</strong> · Deuda del mes: <strong>S/ ${fmtMoney(c.monthDebt)}</strong> · Total agua: <strong>S/ ${fmtMoney(c.totalWaterDebt)}</strong>${data.discrepancies && data.discrepancies.length ? ' · ⚠️ ' + data.discrepancies.length + ' discrepancia(s) registrada(s)' : ''}</div>`;
  } catch (err) {
    box.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message)}</div>`;
  }
}

async function saveNotice() {
  const form = document.getElementById('noticeForm');
  if (!form.reportValidity()) return;
  try {
    const res = await apiFetch('/notices', {
      method: 'POST',
      body: JSON.stringify(collectNoticeForm())
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar el aviso');
    closeModal('noticeModal');
    const warn = data.discrepancies && data.discrepancies.length
      ? ` (${data.discrepancies.length} discrepancia(s) registrada(s))` : '';
    showAlert('alert-container', 'Aviso creado exitosamente' + warn, 'success');
    await loadNotices();
    if (data.notice) renderNoticePreview(data.notice);
  } catch (err) {
    showAlert('noticeAlert', err.message, 'error');
  }
}

async function loadNotices() {
  const tbody = document.getElementById('noticesTableBody');
  if (!tbody) return;
  try {
    const res = await apiFetch('/notices');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar avisos');
    if (!data.notices || data.notices.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--color-text-light);"><div class="empty-state-icon">📄</div>No hay avisos registrados.</td></tr>`;
      return;
    }
    tbody.innerHTML = data.notices.map(n => `
      <tr>
        <td>${escapeHtml(n.billing_month)}</td>
        <td>${escapeHtml(n.condo_name)}</td>
        <td><strong>${escapeHtml(n.property_type)} ${escapeHtml(n.property_code)}</strong></td>
        <td>${escapeHtml(n.owner_name)}</td>
        <td><strong>S/ ${fmtMoney(n.total_water_debt)}</strong></td>
        <td><strong>S/ ${fmtMoney(n.maint_debt_next_month)}</strong></td>
        <td><span class="badge badge-${n.whatsapp_sent ? 'enviado' : 'emitido'}">${n.whatsapp_sent ? 'Enviado' : 'Emitido'}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="viewNotice(${n.id})" title="Ver plantilla">👁️ Ver</button>
          <button class="btn btn-sm btn-whatsapp" onclick="shareNoticeWhatsApp(${n.id})" title="Compartir por WhatsApp">📲</button>
          <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="deleteNotice(${n.id})" title="Eliminar">✖</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--color-danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

// Renderiza la plantilla visual del aviso (especificación: 2 columnas, recuadros,
// notas roja/azul, recuadro de vencimiento, totales inferiores).
function renderNoticePreview(n) {
  currentNotice = n;
  const box = document.getElementById('noticePrintable');
  const discBox = document.getElementById('discrepancyBox');
  if (!box) return;

  const title = `AVISO DE COBRANZA ${String(n.main_concept || 'AGUA').toUpperCase()} ${(n.billing_month || '').toUpperCase()}`;
  document.getElementById('previewTitle').textContent =
    `${n.property_type} ${n.property_code} — ${n.billing_month}`;
  document.getElementById('btnShareNotice').disabled = !n.owner_phone;

  let discrepancies = [];
  try {
    discrepancies = typeof n.discrepancies === 'string' ? JSON.parse(n.discrepancies || '[]') : (n.discrepancies || []);
  } catch (e) { discrepancies = []; }
  discBox.innerHTML = discrepancies.length
    ? `<div class="alert alert-error">Discrepancias registradas: ${discrepancies.length} (ver detalle en base de datos)</div>`
    : '';

  box.innerHTML = `
    <div class="notice-head">
      <span>Página ${escapeHtml(n.page_number || '—')}</span>
      <span>${escapeHtml(title)}</span>
      <span>${escapeHtml(n.condo_name)}</span>
    </div>
    <div class="notice-id-row">
      <span><span class="lbl">${escapeHtml(n.property_type)}</span>&nbsp;&nbsp;${escapeHtml(n.property_code)}</span>
      <span><span class="lbl">Propietario</span>&nbsp;&nbsp;${escapeHtml(n.owner_name)}</span>
    </div>
    <div class="notice-cols">
      <div class="notice-col">
        <div class="notice-section-title">LECTURAS DEL MEDIDOR</div>
        <div class="notice-row"><span>Lectura Actual (${escapeHtml(n.current_reading_date || '')}):</span><span class="amt"><strong>${fmtInt(n.current_reading)}</strong></span></div>
        <div class="notice-row"><span>Lectura Anterior (${escapeHtml(n.previous_reading_date || '')}):</span><span class="amt"><strong>${fmtInt(n.previous_reading)}</strong></span></div>
        <p class="notice-note-red">${escapeHtml(n.tariff_note || '')}</p>
        <div class="notice-section-title">DEUDA ANTERIOR</div>
        <div class="notice-row"><span>Deuda Anterior S/:</span><span class="amt">${fmtMoney(n.prev_debt)}</span></div>
        <div class="notice-row"><span>PAGOANT1:</span><span class="amt">${fmtMoney(n.prev_payment1)}</span></div>
        <div class="notice-row"><span>PAGOANT2:</span><span class="amt">${fmtMoney(n.prev_payment2)}</span></div>
        <div class="notice-row"><span>Saldo Deuda Anterior S/:</span><span class="amt"><span class="notice-box">${fmtMoney(n.prev_balance)}</span></span></div>
        <div class="notice-row"><span>Medidor:</span><span class="amt">${fmtMoney(n.meter_charge)}</span></div>
        <div class="notice-row"><span>Pago Medidor:</span><span class="amt">${fmtMoney(n.meter_payment)}</span></div>
        <div class="notice-section-title">MANTENIMIENTO DE BOMBA</div>
        <div class="notice-row"><span>Mant Bomba:</span><span class="amt">${fmtMoney(n.pump_charge)}</span></div>
        <div class="notice-row"><span>PagoMant Bomba:</span><span class="amt">${fmtMoney(n.pump_payment)}</span></div>
        <p class="notice-note-blue">${escapeHtml(n.pump_note || '')}</p>
        <div class="notice-due-box">${escapeHtml(n.due_notice || '')}</div>
      </div>
      <div class="notice-col">
        <div class="notice-section-title">RESUMEN DE COBRANZA</div>
        <div class="notice-row"><span>Diferencia de lecturas - m3:</span><span class="amt"><strong>${fmtMoney(n.reading_diff_m3)}</strong></span></div>
        <div class="notice-row"><span>Consumo de agua - S/:</span><span class="amt"><span class="notice-box">${fmtMoney(n.water_consumption)}</span></span></div>
        <div class="notice-row"><span>PAGOUNICO:</span><span class="amt">${fmtMoney(n.single_payment)}</span></div>
        <div class="notice-row"><span>Deuda del mes S/:</span><span class="amt"><span class="notice-box">${fmtMoney(n.month_debt)}</span></span></div>
        <div class="notice-row"><span>TOTAL x AGUA S/:</span><span class="amt"><span class="notice-box"><strong>${fmtMoney(n.water_total)}</strong></span></span></div>
        <div class="notice-row"><span>Saldo Pago Medidor:</span><span class="amt">${fmtMoney(n.meter_balance)}</span></div>
        <div class="notice-row"><span>Saldo Mant Bomba:</span><span class="amt">${fmtMoney(n.pump_balance)}</span></div>
      </div>
    </div>
    <div class="notice-totals">
      <div class="notice-row"><span>TOTAL DEUDA AGUA A ${(n.billing_month || '').toUpperCase()}: Suma total agua más saldos</span><span class="amt"><span class="notice-box">${fmtMoney(n.total_water_debt)}</span></span></div>
      <div class="notice-row"><span>DEUDA MANTENIMIENTO A SIG. MES</span><span class="amt"><span class="notice-box">${fmtMoney(n.maint_debt_next_month)}</span></span></div>
    </div>`;
}

async function viewNotice(id) {
  try {
    const res = await apiFetch('/notices/' + id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener el aviso');
    renderNoticePreview(data.notice);
    document.getElementById('noticePrintable').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}

async function deleteNotice(id) {
  if (!confirm('¿Eliminar este aviso de cobranza?')) return;
  try {
    const res = await apiFetch('/notices/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    showAlert('alert-container', 'Aviso eliminado', 'success');
    await loadNotices();
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}

async function shareCurrentNoticeWhatsApp() {
  if (!currentNotice) return;
  await shareNoticeWhatsApp(currentNotice.id);
}

async function shareNoticeWhatsApp(id) {
  try {
    const res = await apiFetch('/notices/' + id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener el aviso');
    const n = data.notice;
    if (!n.owner_phone) throw new Error('El aviso no tiene teléfono del propietario');

    const msg =
      `*AVISO DE COBRANZA ${(n.main_concept || 'AGUA').toUpperCase()} ${(n.billing_month || '').toUpperCase()}*\n` +
      `*${n.condo_name}*\n\n` +
      `*${n.property_type} ${n.property_code}* - ${n.owner_name}\n` +
      `Lectura: ${n.previous_reading} -> ${n.current_reading} (${n.reading_diff_m3} m3)\n` +
      `Consumo de agua: S/ ${fmtMoney(n.water_consumption)}\n` +
      `*TOTAL DEUDA AGUA: S/ ${fmtMoney(n.total_water_debt)}*\n` +
      `*DEUDA MANTENIMIENTO: S/ ${fmtMoney(n.maint_debt_next_month)}*\n\n` +
      `Ultimo dia de pago: ${n.payment_deadline || '-'}`;

    const genRes = await apiFetch('/whatsapp/generate', {
      method: 'POST',
      body: JSON.stringify({ phone: n.owner_phone, message: msg })
    });
    const genData = await genRes.json();
    if (!genRes.ok) throw new Error(genData.error || 'Error al generar el mensaje');

    openWhatsApp(genData.whatsappUrl);
    await apiFetch('/notices/' + id + '/whatsapp', { method: 'PATCH' });
    await loadNotices();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}