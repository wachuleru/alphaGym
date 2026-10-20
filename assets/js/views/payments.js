/* ===========================================================
   GymTrack — Payments view (global)
   =========================================================== */

import { $, el, fmtDate, fmtCLP, todayISO, fromISODate } from '../utils.js';
import { listStudents, fullName } from '../services/students.js';
import { listPayments, refreshOverdueFlags, markPaid, deletePayment, totalReceivedInMonth, totalPending, totalOverdue } from '../services/payments.js';
import { refreshIcons } from '../icons.js';
import { openModal, confirmDialog, toast } from '../components.js';
import { barChart, waitChart } from '../charts.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderPayments() {
  refreshOverdueFlags();
  const main = $('#main');
  const payments = listPayments();
  const sumPending  = totalPending();
  const sumOverdue  = totalOverdue();
  const sumReceived = totalReceivedInMonth(new Date().getFullYear(), new Date().getMonth());

  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Pagos</span></span>
          <h1 class="page-head__title">Pagos</h1>
          <p class="page-head__sub">Mensualidades, vencimientos e ingresos.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="payExportBtn"><i data-lucide="download"></i>Exportar</button>
          <button class="btn btn--primary" id="payNewBtn"><i data-lucide="plus"></i>Nuevo pago</button>
        </div>
      </div>
    </div>

    <section class="kpi-row">
      <div class="kpi kpi--success">
        <span class="kpi__label">Ingresos del mes</span>
        <span class="kpi__value" style="font-size:var(--fs-2xl)">${fmtCLP(sumReceived)}</span>
        <span class="kpi__sub">pagos efectivamente recibidos</span>
      </div>
      <div class="kpi kpi--warning">
        <span class="kpi__label">Pendiente</span>
        <span class="kpi__value" style="font-size:var(--fs-2xl)">${fmtCLP(sumPending)}</span>
        <span class="kpi__sub">${payments.filter((p) => p.status === 'pending').length} cuota(s)</span>
      </div>
      <div class="kpi kpi--danger">
        <span class="kpi__label">Vencido</span>
        <span class="kpi__value" style="font-size:var(--fs-2xl)">${fmtCLP(sumOverdue)}</span>
        <span class="kpi__sub">${payments.filter((p) => p.status === 'overdue').length} cuota(s)</span>
      </div>
      <div class="kpi">
        <span class="kpi__label">Total registrado</span>
        <span class="kpi__value" style="font-size:var(--fs-2xl)">${fmtCLP(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0))}</span>
        <span class="kpi__sub">${payments.length} registro(s) globales</span>
      </div>
    </section>

    <section class="card" style="margin-top: var(--sp-5)">
      <header class="card__header">
        <div class="stack"><h3 class="card__title">Ingresos por mes</h3></div>
      </header>
      <div class="card__body" style="height:260px"><div class="chart-canvas-wrap"><canvas id="payChart"></canvas></div></div>
    </section>

    <section class="card" style="margin-top: var(--sp-5)">
      <header class="card__header">
        <div class="stack"><h3 class="card__title">Historial completo</h3></div>
        <div class="card__actions">
          <select class="select input--inline" id="payFilterStatus">
            <option value="">Todos los estados</option>
            <option value="pending">Pendiente</option>
            <option value="paid">Pagado</option>
            <option value="overdue">Vencido</option>
          </select>
        </div>
      </header>
      <div class="card__body" style="padding:0" id="payTable"></div>
    </section>
  `;

  $('#payExportBtn').addEventListener('click', async () => {
    const m = await import('../services/excel.js');
    m.exportPayments();
  });
  $('#payNewBtn').addEventListener('click', () => openPayForm(null));
  $('#payFilterStatus').addEventListener('change', refreshTable);
  refreshTable();
  waitChart(buildChart);

  refreshIcons(main);
}

function refreshTable() {
  const status = $('#payFilterStatus').value;
  const payments = listPayments().filter((p) => !status || p.status === status)
    .slice()
    .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1));
  const root = $('#payTable');
  if (!root) return;
  if (!payments.length) {
    root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="credit-card"></i></div><div class="empty__title">Sin pagos en esta vista</div></div>`;
    refreshIcons(root); return;
  }
  root.innerHTML = `
    <div class="table-wrap" style="border:none;border-radius:0">
      <table class="table">
        <thead><tr><th>Alumno</th><th>Período</th><th class="num">Monto</th><th>Vencimiento</th><th>Pago</th><th>Estado</th><th>Método</th><th></th></tr></thead>
        <tbody>
          ${payments.map((p) => {
            const s = listStudents().find((x) => x.id === p.studentId);
            const cls = p.status === 'paid' ? 'badge--success' : p.status === 'overdue' ? 'badge--danger' : 'badge--warning';
            const lbl = p.status === 'paid' ? 'Pagado' : p.status === 'overdue' ? 'Vencido' : 'Pendiente';
            return `<tr>
              <td>${s ? `<a href="#/students/${s.id}/payments">${escapeHtml(fullName(s))}</a>` : '<span class="t-muted">—</span>'}</td>
              <td><strong>${escapeHtml(p.period)}</strong></td>
              <td class="num">${fmtCLP(p.amount)}</td>
              <td class="t-mono">${fmtDate(p.dueDate)}</td>
              <td class="t-mono">${p.paidAt ? fmtDate(p.paidAt.slice(0,10)) : '—'}</td>
              <td><span class="badge ${cls}">${lbl}</span></td>
              <td class="t-muted">${escapeHtml(p.method || '—')}</td>
              <td class="row-actions">
                ${p.status !== 'paid' ? `<button class="btn btn--success btn--sm" data-act="pay" data-id="${p.id}"><i data-lucide="check"></i>Pagar</button>` : ''}
                <button class="icon-btn" data-act="del" data-id="${p.id}"><i data-lucide="trash-2"></i></button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  refreshIcons(root);

  root.addEventListener('click', async (e) => {
    const del = e.target.closest('[data-act="del"]');
    const pay = e.target.closest('[data-act="pay"]');
    if (del) {
      const ok = await confirmDialog({ title: 'Eliminar pago', message: '¿Eliminar este pago?' });
      if (!ok) return;
      deletePayment(del.dataset.id);
      toast({ type: 'success', message: 'Pago eliminado.' });
      refreshTable();
    }
    if (pay) {
      markPaid(pay.dataset.id, 'Efectivo');
      toast({ type: 'success', message: 'Pago registrado.' });
      refreshTable();
    }
  });
}

function buildChart() {
  const c = $('#payChart');
  if (!c || !window.Chart) return;
  const labels = [];
  const data = [];
  const today = new Date();
  for (let i = 5; i >= 0; i--) {
    const ref = new Date(today.getFullYear(), today.getMonth() - i, 1);
    labels.push(`${ref.getMonth() + 1}/${String(ref.getFullYear()).slice(2)}`);
    let sum = 0;
    for (const p of listPayments()) {
      if (p.status !== 'paid' || !p.paidAt) continue;
      const d = new Date(p.paidAt);
      if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) sum += Number(p.amount) || 0;
    }
    data.push(sum);
  }
  barChart(c, labels, [{
    label: 'Ingresos CLP',
    data,
    backgroundColor: 'rgba(56,189,248,0.50)',
    borderColor: '#38bdf8',
    borderWidth: 2,
    borderRadius: { topLeft: 6, topRight: 6 },
  }], {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#94a3b8', callback: (v) => '$' + (v/1000) + 'k' },
        grid: { color: 'rgba(148,163,184,0.08)' },
      },
    },
  });
}

function waitChart_deprecated() { /* moved to charts.js */ }
void waitChart_deprecated;

function openPayForm(existing) {
  const dialog = el('div');
  const opts = listStudents();
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-12">
        <label class="field__label">Alumno *</label>
        <select class="select" id="pyStudent">
          <option value="">Selecciona un alumno…</option>
          ${opts.map((s) => `<option value="${s.id}" ${existing && existing.studentId === s.id ? 'selected' : ''}>${escapeHtml(fullName(s))}</option>`).join('')}
        </select>
      </div>
      <div class="field col-6"><label class="field__label">Período *</label><input class="input" id="pyPeriod" value="${existing ? escapeHtml(existing.period) : ''}" /></div>
      <div class="field col-6"><label class="field__label">Monto *</label><input class="input" type="number" id="pyAmount" value="${existing ? existing.amount : ''}" /></div>
      <div class="field col-6"><label class="field__label">Vencimiento *</label><input class="input" type="date" id="pyDue" value="${existing ? existing.dueDate : todayISO()}" /></div>
      <div class="field col-6">
        <label class="field__label">Estado</label>
        <select class="select" id="pyStatus">
          <option value="pending" ${(!existing || existing.status === 'pending') ? 'selected' : ''}>Pendiente</option>
          <option value="paid"    ${existing && existing.status === 'paid' ? 'selected' : ''}>Pagado</option>
          <option value="overdue" ${existing && existing.status === 'overdue' ? 'selected' : ''}>Vencido</option>
        </select>
      </div>
      <div class="field col-6"><label class="field__label">Método</label><input class="input" id="pyMethod" value="${existing ? escapeHtml(existing.method || '') : ''}" /></div>
      <div class="field col-6"><label class="field__label">Fecha pago</label><input class="input" type="date" id="pyPaidAt" value="${existing && existing.paidAt ? existing.paidAt.slice(0,10) : ''}" /></div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar pago' : 'Nuevo pago',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: async () => {
          const m = await import('../services/payments.js');
          const data = {
            studentId: dialog.querySelector('#pyStudent').value,
            period: dialog.querySelector('#pyPeriod').value.trim(),
            amount: Number(dialog.querySelector('#pyAmount').value) || 0,
            dueDate: dialog.querySelector('#pyDue').value,
            status: dialog.querySelector('#pyStatus').value,
            method: dialog.querySelector('#pyMethod').value,
            paidAt: dialog.querySelector('#pyPaidAt').value ? new Date(dialog.querySelector('#pyPaidAt').value).toISOString() : null,
          };
          if (!data.studentId || !data.period || !data.dueDate || !data.amount) {
            toast({ type: 'warning', message: 'Completa alumno, período, monto y vencimiento.' });
            return false;
          }
          if (existing) m.updatePayment(existing.id, data);
          else m.createPayment(data);
          toast({ type: 'success', message: existing ? 'Pago actualizado.' : 'Pago registrado.' });
          refreshTable();
          buildChart();
        },
      },
    ],
  });
  refreshIcons(dialog);
}
