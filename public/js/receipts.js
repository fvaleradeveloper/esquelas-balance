/* ============================================
   Esquelas-Balance - Lógica de Esquelas de Pago
   ============================================ */

// Guardar nueva esquela desde el modal
async function saveReceipt() {
  const form = document.getElementById('receiptForm');
  if (!form.reportValidity()) return;

  const payload = {
    clientName: document.getElementById('rClientName').value.trim(),
    clientPhone: document.getElementById('rClientPhone').value.trim(),
    clientEmail: document.getElementById('rClientEmail').value.trim() || undefined,
    amount: parseFloat(document.getElementById('rAmount').value),
    concept: document.getElementById('rConcept').value.trim(),
    paymentMethod: document.getElementById('rPaymentMethod').value,
    reference: document.getElementById('rReference').value.trim() || undefined,
    paymentDate: document.getElementById('rPaymentDate').value
  };

  if (!isValidPhone(payload.clientPhone)) {
    showAlert('receiptAlert', 'El teléfono del cliente no es válido', 'error');
    return;
  }

  try {
    const res = await apiFetch('/receipts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al crear la esquela');
    }

    closeModal('receiptModal');
    showAlert('alert-container', 'Esquela ' + data.receipt.receipt_number + ' creada exitosamente', 'success');
    if (typeof loadDashboard === 'function') loadDashboard();
    if (typeof loadReceipts === 'function') loadReceipts();
  } catch (err) {
    showAlert('receiptAlert', err.message, 'error');
  }
}

// Listar esquelas (usado en receipts.html)
async function loadReceipts() {
  const tbody = document.getElementById('receiptsTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/receipts');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al cargar esquelas');
    }

    if (!data.receipts || data.receipts.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--color-text-light);">
        <div class="empty-state-icon">🧾</div>
        No hay esquelas registradas. Cree su primera esquela.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.receipts.map(r => `
      <tr>
        <td><strong>${escapeHtml(r.receipt_number)}</strong></td>
        <td>
          ${escapeHtml(r.client_name)}<br>
          <small style="color:var(--color-text-light);">${escapeHtml(r.client_phone)}</small>
        </td>
        <td><strong>${formatCurrency(r.amount)}</strong></td>
        <td>${escapeHtml(r.concept)}</td>
        <td><span class="badge">${escapeHtml(r.payment_method)}</span></td>
        <td>${escapeHtml(r.payment_date)}</td>
        <td><span class="badge badge-${r.whatsapp_sent ? 'enviado' : 'emitido'}">${r.whatsapp_sent ? 'Enviado' : 'Emitido'}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="downloadReceiptPDF(${r.id})" title="Descargar PDF">📄 PDF</button>
          <button class="btn btn-sm btn-whatsapp" onclick="shareReceiptWhatsApp(${r.id})" title="Enviar por WhatsApp">📲</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--color-danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

// Descargar esquela como PDF (usando jsPDF desde CDN)
async function downloadReceiptPDF(receiptId) {
  try {
    const res = await apiFetch('/receipts/' + receiptId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener la esquela');
    const r = data.receipt;

    // Cargar jsPDF dinámicamente si no está
    if (!window.jspdf) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Encabezado
    doc.setFillColor(9, 132, 227);
    doc.rect(0, 0, 210, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('ESQUELA DE PAGO', 105, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text('Esquelas-Balance', 105, 25, { align: 'center' });

    // Detalles
    doc.setTextColor(45, 52, 54);
    doc.setFontSize(14);
    doc.text('Recibo N°: ' + r.receipt_number, 20, 50);

    doc.setFontSize(11);
    const lines = [
      ['Cliente:', r.client_name],
      ['Teléfono:', r.client_phone],
      ['Email:', r.client_email || '—'],
      ['Concepto:', r.concept],
      ['Método de pago:', r.payment_method],
      ['Referencia:', r.reference || '—'],
      ['Fecha de pago:', r.payment_date]
    ];
    let y = 65;
    for (const [label, value] of lines) {
      doc.setFont(undefined, 'bold');
      doc.text(label, 20, y);
      doc.setFont(undefined, 'normal');
      doc.text(String(value), 60, y);
      y += 9;
    }

    // Monto destacado
    doc.setFillColor(85, 239, 196);
    doc.roundedRect(20, y + 5, 170, 20, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('MONTO: S/ ' + parseFloat(r.amount).toFixed(2), 105, y + 18, { align: 'center' });

    // Pie
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(99, 110, 114);
    doc.text('Documento generado por Esquelas-Balance - ' + new Date().toLocaleDateString('es-PE'), 105, 285, { align: 'center' });

    doc.save('esquela-' + r.receipt_number + '.pdf');
  } catch (err) {
    alert('Error al generar PDF: ' + err.message);
  }
}

// Cargar script dinámicamente
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

// Compartir esquela por WhatsApp
async function shareReceiptWhatsApp(receiptId) {
  try {
    const res = await apiFetch('/receipts/' + receiptId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener la esquela');
    const r = data.receipt;

    const genRes = await apiFetch('/whatsapp/receipt', {
      method: 'POST',
      body: JSON.stringify({
        phone: r.client_phone,
        receiptNumber: r.receipt_number,
        clientName: r.client_name,
        amount: r.amount,
        concept: r.concept,
        paymentMethod: r.payment_method,
        paymentDate: r.payment_date
      })
    });
    const genData = await genRes.json();
    if (!genRes.ok) throw new Error(genData.error || 'Error al generar el mensaje');

    openWhatsApp(genData.whatsappUrl);

    // Marcar como enviado
    await apiFetch('/receipts/' + receiptId + '/whatsapp', { method: 'PATCH' });
    if (typeof loadReceipts === 'function') loadReceipts();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}