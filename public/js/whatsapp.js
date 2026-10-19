/* ============================================
   Esquelas-Balance - Mensajería WhatsApp (wa.me)
   Sin API: se generan enlaces directos
   Tipos: thank-you | reminder | receipt-notification | general
   ============================================ */

// Generar enlace WhatsApp desde el modal de mensajes
async function generateWhatsAppMessage() {
  const form = document.getElementById('messageForm');
  if (!form.reportValidity()) return;

  const type = document.getElementById('msgType').value;
  const phone = document.getElementById('mPhone').value.trim();
  const clientName = document.getElementById('mClientName').value.trim();

  if (!isValidPhone(phone)) {
    showAlert('msgAlert', 'El teléfono no es válido', 'error');
    return;
  }

  const TITLES = {
    'thank-you': 'Agradecimiento por pago',
    'reminder': 'Recordatorio de pago',
    'receipt-notification': 'Notificación de esquela',
    'general': 'Mensaje general'
  };

  try {
    let endpoint = '/whatsapp/thank-you';
    let payload = { phone, clientName };

    if (type === 'reminder') {
      const amount = parseFloat(document.getElementById('mAmount').value);
      const concept = document.getElementById('mConcept').value.trim();
      const dueDateEl = document.getElementById('mDueDate');
      const dueDate = dueDateEl ? dueDateEl.value : '';
      if (!dueDate) { showAlert('msgAlert', 'Ingrese la fecha de vencimiento', 'error'); return; }
      endpoint = '/whatsapp/reminder';
      payload = { phone, clientName, amount, concept, dueDate };
    } else if (type === 'thank-you') {
      const amount = parseFloat(document.getElementById('mAmount').value);
      const concept = document.getElementById('mConcept').value.trim();
      endpoint = '/whatsapp/thank-you';
      payload = { phone, clientName, amount, concept };
    } else if (type === 'receipt-notification') {
      const receiptNumber = document.getElementById('mReceiptNumber').value.trim();
      const amount = parseFloat(document.getElementById('mAmount').value);
      const concept = document.getElementById('mConcept').value.trim();
      if (!receiptNumber) { showAlert('msgAlert', 'Ingrese el número de esquela', 'error'); return; }
      endpoint = '/whatsapp/receipt-notification';
      payload = { phone, clientName, receiptNumber, amount, concept };
    } else if (type === 'general') {
      const message = document.getElementById('mGeneralText').value.trim();
      if (!message) { showAlert('msgAlert', 'Ingrese el mensaje', 'error'); return; }
      endpoint = '/whatsapp/generate';
      payload = { phone, message };
    } else {
      showAlert('msgAlert', 'Tipo de mensaje no soportado', 'error');
      return;
    }

    const res = await apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al generar el mensaje');

    // Guardar registro del mensaje interno
    await apiFetch('/messages', {
      method: 'POST',
      body: JSON.stringify({
        type: type,
        title: TITLES[type] || 'Mensaje',
        body: data.message,
        recipientName: clientName,
        recipientPhone: phone
      })
    });

    openWhatsApp(data.whatsappUrl);
    closeModal('messageModal');
    showAlert('alert-container', 'Enlace de WhatsApp generado y abierto', 'success');
    if (typeof loadMessages === 'function') loadMessages();
  } catch (err) {
    showAlert('msgAlert', err.message, 'error');
  }
}

// Compartir mensaje por WhatsApp directamente desde la lista (usa GET /messages/:id)
async function shareMessageWhatsApp(messageId) {
  try {
    const res = await apiFetch('/messages/' + messageId);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar mensaje');

    const msg = data.message;
    if (!msg) throw new Error('Mensaje no encontrado');
    if (!msg.recipient_phone) throw new Error('El mensaje no tiene teléfono asociado');

    const genRes = await apiFetch('/whatsapp/generate', {
      method: 'POST',
      body: JSON.stringify({
        phone: msg.recipient_phone,
        message: msg.body
      })
    });
    const genData = await genRes.json();
    if (!genRes.ok) throw new Error(genData.error || 'Error al generar enlace');

    openWhatsApp(genData.whatsappUrl);

    // Marcar como enviado
    await apiFetch('/messages/' + messageId + '/whatsapp', { method: 'PATCH' });
    if (typeof loadMessages === 'function') loadMessages();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}