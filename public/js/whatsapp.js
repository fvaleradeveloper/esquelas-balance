/* ============================================
   Esquelas-Balance - Mensajería WhatsApp (wa.me)
   Sin API: se generan enlaces directos
   ============================================ */

// Generar enlace WhatsApp desde el modal de mensajes
async function generateWhatsAppMessage() {
  const form = document.getElementById('messageForm');
  if (!form.reportValidity()) return;

  const type = document.getElementById('msgType').value;
  const phone = document.getElementById('mPhone').value.trim();
  const clientName = document.getElementById('mClientName').value.trim();
  const amount = parseFloat(document.getElementById('mAmount').value);
  const concept = document.getElementById('mConcept').value.trim();
  const dueDate = document.getElementById('mDueDate') ? document.getElementById('mDueDate').value : '';

  if (!isValidPhone(phone)) {
    showAlert('msgAlert', 'El teléfono no es válido', 'error');
    return;
  }

  if (type === 'reminder' && !dueDate) {
    showAlert('msgAlert', 'Ingrese la fecha de vencimiento', 'error');
    return;
  }

  try {
    const endpoint = type === 'reminder' ? '/whatsapp/reminder' : '/whatsapp/thank-you';
    const payload = { phone, clientName, amount, concept };
    if (type === 'reminder') payload.dueDate = dueDate;

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
        title: type === 'reminder' ? 'Recordatorio de pago' : 'Agradecimiento por pago',
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

// Compartir mensaje por WhatsApp directamente desde la lista de mensajes
async function shareMessageWhatsApp(messageId) {
  try {
    const res = await apiFetch('/messages');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar mensajes');

    const msg = data.messages.find(m => m.id === messageId);
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