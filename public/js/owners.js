/* ============================================
   Esquelas-Balance - Gestión de Propietarios
   ============================================ */

async function loadOwners() {
  const tbody = document.getElementById('ownersTableBody');
  if (!tbody) return;
  try {
    const res = await apiFetch('/owners');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar propietarios');
    if (!data.owners || data.owners.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:var(--color-text-light);">No hay propietarios registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.owners.map(o => `
      <tr>
        <td>${o.id}</td>
        <td>${escapeHtml(o.name)}</td>
        <td>${escapeHtml(o.email || '-')}</td>
        <td>${escapeHtml(o.phone || '-')}</td>
        <td><strong>${escapeHtml(o.property_code)}</strong></td>
        <td>${escapeHtml(o.property_type)}</td>
        <td><span class="badge">${o.status === 'active' ? 'emitido' : 'enviado'}</span></td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="editOwner(${o.id}, '${escapeHtml(o.name)}', '${escapeHtml(o.email || '')}', '${escapeHtml(o.phone || '')}', '${escapeHtml(o.property_code)}', '${escapeHtml(o.property_type)}', '${o.status}')" title="Editar">✏️</button>
          <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="deleteOwner(${o.id})" title="Eliminar">✖</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:var(--color-danger);">' + escapeHtml(err.message) + '</td></tr>';
  }
}

async function saveOwner() {
  const form = document.getElementById('ownerForm');
  if (!form.reportValidity()) return;
  const id = document.getElementById('ownerId').value;
  const payload = {
    name: document.getElementById('oName').value.trim(),
    email: document.getElementById('oEmail').value.trim() || undefined,
    phone: document.getElementById('oPhone').value.trim() || undefined,
    property_code: document.getElementById('oPropertyCode').value.trim(),
    property_type: document.getElementById('oPropertyType').value.trim(),
    status: document.getElementById('oStatus').value
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/owners/${id}` : '/owners';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar propietario');
    closeModal('ownerModal');
    showAlert('alert-container', id ? 'Propietario actualizado' : 'Propietario creado', 'success');
    loadOwners();
  } catch (err) {
    showAlert('ownerAlert', err.message, 'error');
  }
}

async function editOwner(id, name, email, phone, propertyCode, propertyType, status) {
  document.getElementById('ownerId').value = id;
  document.getElementById('oName').value = name;
  document.getElementById('oEmail').value = email;
  document.getElementById('oPhone').value = phone;
  document.getElementById('oPropertyCode').value = propertyCode;
  document.getElementById('oPropertyType').value = propertyType;
  document.getElementById('oStatus').value = status;
  document.getElementById('ownerModalTitle').textContent = 'Editar Propietario';
  document.getElementById('ownerAlert').innerHTML = '';
  document.getElementById('ownerModal').classList.add('show');
}

async function deleteOwner(id) {
  if (!confirm('¿Está seguro de eliminar este propietario?')) return;
  try {
    const res = await apiFetch(`/owners/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    showAlert('alert-container', 'Propietario eliminado', 'success');
    loadOwners();
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}