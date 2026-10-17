/* ============================================
   Esquelas-Balance - Lógica de Transacciones
   ============================================ */

// Guardar transacción (ingreso o egreso) desde el modal
async function saveTransaction() {
  const form = document.getElementById('transactionForm');
  if (!form.reportValidity()) return;

  const payload = {
    type: document.getElementById('txType').value,
    description: document.getElementById('txDescription').value.trim(),
    amount: parseFloat(document.getElementById('txAmount').value),
    category: document.getElementById('txCategory').value.trim(),
    date: document.getElementById('txDate').value
  };

  try {
    const res = await apiFetch('/transactions', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al guardar la transacción');
    }

    closeModal('transactionModal');
    showAlert('alert-container', data.message + ' registrado exitosamente', 'success');
    if (typeof loadDashboard === 'function') loadDashboard();
    if (typeof loadTransactions === 'function') loadTransactions();
  } catch (err) {
    showAlert('txAlert', err.message, 'error');
  }
}

// Listar transacciones con balance (usado en transactions.html)
async function loadTransactions() {
  const tbody = document.getElementById('transactionsTableBody');
  if (!tbody) return;

  try {
    const res = await apiFetch('/transactions');
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Error al cargar transacciones');
    }

    // Actualizar stats de balance si existen
    if (data.balance) {
      const elIncome = document.getElementById('statIncome');
      const elExpense = document.getElementById('statExpense');
      const elBalance = document.getElementById('statBalance');
      if (elIncome) elIncome.textContent = formatCurrency(data.balance.income);
      if (elExpense) elExpense.textContent = formatCurrency(data.balance.expense);
      if (elBalance) {
        elBalance.textContent = formatCurrency(data.balance.net);
        elBalance.style.color = data.balance.net >= 0 ? '#00b894' : '#d63031';
      }
    }

    if (!data.transactions || data.transactions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--color-text-light);">
        <div class="empty-state-icon">💰</div>
        No hay transacciones registradas.
      </td></tr>`;
      return;
    }

    tbody.innerHTML = data.transactions.map(t => `
      <tr>
        <td>${escapeHtml(formatDate(t.date))}</td>
        <td>${escapeHtml(t.description)}</td>
        <td><span class="badge badge-${t.type === 'income' ? 'ingreso' : 'egreso'}">${t.type === 'income' ? 'Ingreso' : 'Egreso'}</span></td>
        <td>${escapeHtml(t.category)}</td>
        <td><strong style="color:${t.type === 'income' ? '#00b894' : '#d63031'};">${t.type === 'income' ? '+' : '-'}${formatCurrency(t.amount)}</strong></td>
        <td>
          <button class="btn btn-sm btn-outline" style="color:var(--color-danger); border-color:var(--color-danger);" onclick="deleteTransaction(${t.id})">Eliminar</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--color-danger);">${escapeHtml(err.message)}</td></tr>`;
  }
}

// Eliminar transacción
async function deleteTransaction(id) {
  if (!confirm('¿Está seguro de eliminar esta transacción?')) return;

  try {
    const res = await apiFetch('/transactions/' + id, { method: 'DELETE' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Error al eliminar');

    showAlert('alert-container', 'Transacción eliminada', 'success');
    if (typeof loadTransactions === 'function') loadTransactions();
    if (typeof loadDashboard === 'function') loadDashboard();
  } catch (err) {
    showAlert('alert-container', err.message, 'error');
  }
}