/* ============================================
   Esquelas-Balance - Administración SAAS (Tenants)
   ============================================ */

async function loadTenants() {
  const tbody = document.getElementById('tenantsTableBody');
  if (!tbody) return;
  try {
    const res = await apiFetch('/admin/tenants');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar tenants');
    if (!data.tenants || data.tenants.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--color-text-light);">No hay tenants registrados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.tenants.map(t => `
      <tr>
        <td>${t.id}</td>
        <td>${escapeHtml(t.name)}</td>
        <td>${escapeHtml(t.email)}</td>
        <td>${escapeHtml(t.phone || '-')}</td>
        <td><span class="badge">${t.status === 'active' ? 'emitido' : 'enviado'}</span></td>
        <td>${escapeHtml(formatDate(t.created_at))}</td>
        <td style="white-space:nowrap;">
          <button class="btn btn-sm btn-primary" onclick="editTenant(${t.id})" title="Editar">✏️</button>
          <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="deleteTenant(${t.id})" title="Eliminar">✖</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--color-danger);">' + escapeHtml(err.message) + '</td></tr>';
  }
}

async function saveTenant() {
  const form = document.getElementById('tenantForm');
  if (!form.reportValidity()) return;
  const id = document.getElementById('tenantId').value;
  const payload = {
    name: document.getElementById('tName').value.trim(),
    email: document.getElementById('tEmail').value.trim(),
    phone: document.getElementById('tPhone').value.trim() || undefined,
    status: document.getElementById('tStatus').value
  };
  if (!id) payload.password = document.getElementById('tPassword').value;

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/admin/tenants/${id}` : '/admin/tenants';
    const res = await apiFetch(url, { method, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar tenant');
    closeModal('tenantModal');
    showAlert('alert-container', id ? 'Tenant actualizado' : 'Tenant creado', 'success');
    loadTenants();
  } catch (err) {
    showAlert('tenantAlert', err.message, 'error');
  }
}

async function editTenant(id) {
  try {
    const res = await apiFetch('/admin/tenants/' + id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener tenant');
    const t = data.tenant;
    if (!t) throw new Error('Tenant no encontrado');
    document.getElementById('tenantId').value = t.id;
    document.getElementById('tName').value = t.name || '';
    document.getElementById('tEmail').value = t.email || '';
    document.getElementById('tPhone').value = t.phone || '';
    document.getElementById('tStatus').value = t.status || 'active';
    document.getElementById('tenantModalTitle').textContent = 'Editar Tenant';
    document.getElementById('tenantPasswordGroup').style.display = 'none';
    document.getElementById('tenantAlert').innerHTML = '';
    document.getElementById('tenantModal').classList.add('show');
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}

async function deleteTenant(id) {
  if (!confirm('¿Está seguro de eliminar este tenant?')) return;
  try {
    const res = await apiFetch(`/admin/tenants/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar');
    showAlert('alert-container', 'Tenant eliminado', 'success');
    loadTenants();
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}