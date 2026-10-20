/* ===========================================================
   GymTrack — Students list + creation
   =========================================================== */

import { $, el, fmtDate, todayISO, initials, fmtCLP, debounce } from '../utils.js';
import { listStudents, createStudent, fullName } from '../services/students.js';
import { listAttendances, lastAttendanceFor } from '../services/attendance.js';
import { nextDueFor } from '../services/payments.js';
import { computeStudentMetrics, determineLevel } from '../services/levels.js';
import { refreshIcons } from '../icons.js';
import { openModal, toast, toastError } from '../components.js';

export async function renderStudentsList(params) {
  const main = $('#main');
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a> <span>Alumnos</span></span>
          <h1 class="page-head__title">Alumnos</h1>
          <p class="page-head__sub">Gestiona fichas, objetivos y membresías.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="exportStudentsBtn"><i data-lucide="download"></i>Exportar Excel</button>
          <button class="btn btn--primary" id="newStudentBtn"><i data-lucide="user-plus"></i>Nuevo alumno</button>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="search toolbar__search">
        <i data-lucide="search"></i>
        <input class="input" id="studentsSearch" placeholder="Buscar por nombre, email o teléfono…" />
      </div>
      <div class="toolbar__filters">
        <select class="select input--inline" id="studentsStatus" style="width:auto">
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
          <option value="suspended">Suspendidos</option>
        </select>
        <select class="select input--inline" id="studentsLevel" style="width:auto">
          <option value="">Todos los niveles</option>
          <option value="1">Principiante</option>
          <option value="2">Constante</option>
          <option value="3">Comprometido</option>
          <option value="4">Disciplinado</option>
          <option value="5">Referente</option>
        </select>
        <select class="select input--inline" id="studentsPayment" style="width:auto">
          <option value="">Pagos</option>
          <option value="ok">Al día</option>
          <option value="due">Pendientes</option>
          <option value="over">Vencidos</option>
        </select>
      </div>
    </div>

    <div id="studentsContainer"></div>
  `;

  bindFilters();
  bindActions();
  renderGrid();

  if (params?.query?.new === '1') {
    setTimeout(() => openStudentForm(), 50);
  }

  if (params?.query?.edit) {
    const student = listStudents().find((s) => s.id === params.query.edit);
    if (student) setTimeout(() => openStudentForm(student), 50);
  }

  refreshIcons(main);
}

// Always rebuild — these lists are small and renders are infrequent.
function getCache() {
  return listStudents().map((s) => ({
    s,
    metrics: computeStudentMetrics(s, listAttendances()),
    last: lastAttendanceFor(s.id),
    due: nextDueFor(s.id),
  }));
}

function bindFilters() {
  const search = $('#studentsSearch');
  const sel = (id) => $('#' + id);

  const update = debounce(renderGrid, 80);

  search.addEventListener('input', update);
  sel('studentsStatus').addEventListener('change', renderGrid);
  sel('studentsLevel').addEventListener('change', renderGrid);
  sel('studentsPayment').addEventListener('change', renderGrid);
}

function bindActions() {
  $('#newStudentBtn')?.addEventListener('click', () => openStudentForm());
  $('#exportStudentsBtn')?.addEventListener('click', async () => {
    const mod = await import('../services/excel.js');
    mod.exportStudents();
  });
}

function renderGrid() {
  const wrap = $('#studentsContainer');
  if (!wrap) return;
  const term = ($('#studentsSearch').value || '').toLowerCase().trim();
  const status = $('#studentsStatus').value;
  const levelFilter = $('#studentsLevel').value;
  const pay = $('#studentsPayment').value;
  const data = getCache().filter(({ s, metrics, due }) => {
    if (status && s.status !== status) return false;
    if (levelFilter && String(determineLevel(metrics).id) !== levelFilter) return false;
    if (pay === 'ok'    && due && (due.status === 'pending' || due.status === 'overdue')) return false;
    if (pay === 'due'   && (!due || due.status !== 'pending')) return false;
    if (pay === 'over'  && (!due || due.status !== 'overdue')) return false;
    if (term) {
      const t = term;
      const hay = [fullName(s), s.email, s.phone, s.id].join(' ').toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  });

  if (!data.length) {
    wrap.innerHTML = `
      <div class="empty">
        <div class="empty__icon"><i data-lucide="users"></i></div>
        <div class="empty__title">Sin resultados</div>
        <div class="empty__text">Prueba ajustando los filtros o crea un nuevo alumno.</div>
        <div class="empty__actions">
          <button class="btn btn--primary" onclick="document.getElementById('newStudentBtn').click()"><i data-lucide="user-plus"></i>Nuevo alumno</button>
        </div>
      </div>`;
    refreshIcons(wrap);
    return;
  }

  const html = `
    <div class="students-grid">
      ${data.map(({ s, metrics, last, due }) => {
        const lv = determineLevel(metrics);
        const statusBadge = s.status === 'active' ? 'badge--success' : s.status === 'inactive' ? 'badge--muted' : 'badge--warning';
        const statusLabel = s.status === 'active' ? 'Activo' : s.status === 'inactive' ? 'Inactivo' : 'Suspendido';
        const lastDays = last ? Math.max(0, Math.round((new Date(todayISO()) - new Date(last.dateISO)) / 86400000)) : null;
        return `
          <a class="student-card" href="#/students/${s.id}">
            <div class="student-card__head">
              <span class="avatar avatar--accent">${initials(fullName(s))}</span>
              <div class="stack" style="flex:1;min-width:0">
                <span class="student-card__name">${escapeHtml(fullName(s))}</span>
                <span class="student-card__meta">${s.email || s.phone || s.id}</span>
              </div>
              <span class="level-pill" style="--level-bg:${lv.bg}; --level-fg:${lv.fg}; --level-border:${lv.border}">
                <span class="level-pill__dot"></span>${lv.name}
              </span>
            </div>
            <div class="student-card__chips">
              <span class="badge ${statusBadge}">${statusLabel}</span>
              <span class="badge badge--muted"><i data-lucide="target"></i>${escapeHtml(s.mainGoal || 'Sin objetivo')}</span>
            </div>
            <div class="student-card__row"><span>Frecuencia semanal</span><strong>${s.weeklyGoal || 2} sesiones/sem</strong></div>
            <div class="student-card__row"><span>Total asistencias</span><strong>${metrics.totalAttendances}</strong></div>
            <div class="student-card__row"><span>Última asistencia</span><strong>${last ? `${lastDays} día(s)` : '—'}</strong></div>
            <div class="student-card__row"><span>Próximo pago</span><strong>${due ? `${fmtCLP(due.amount)} (${due.status === 'overdue' ? 'vencido' : 'pendiente'})` : '—'}</strong></div>
          </a>`;
      }).join('')}
    </div>`;
  wrap.innerHTML = html;
  refreshIcons(wrap);
}

function escapeHtml(s) {
  return String(s || '').replace(/[<>&"']/g, (c) =>
    ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ---------- Form ---------- */

function openStudentForm(existing = null) {
  const form = el('form', { class: 'form-grid' });
  form.addEventListener('submit', (e) => e.preventDefault());

  const isEdit = !!existing;

  // Section: Identidad
  const sec1 = el('section', { class: 'form-section col-12' }, [
    el('h3', { class: 'form-section__title' }, 'Identidad'),
  ]);
  form.appendChild(sec1);

  form.appendChild(makeField({ col: 6, label: 'Nombre *', name: 'firstName', value: existing?.firstName || '', required: true }));
  form.appendChild(makeField({ col: 6, label: 'Apellido', name: 'lastName', value: existing?.lastName || '' }));
  form.appendChild(makeSelect({
    col: 4,
    label: 'Sexo',
    name: 'sex',
    value: existing?.sex || '',
    options: [
      { value: '',     label: 'Sin especificar' },
      { value: 'F',    label: 'Femenino' },
      { value: 'M',    label: 'Masculino' },
    ],
  }));
  form.appendChild(makeField({ col: 4, label: 'Estatura (cm)', name: 'heightCm', value: existing?.heightCm ?? '', type: 'number', min: 80, max: 230, step: 0.5 }));
  form.appendChild(makeField({ col: 4, label: 'Fecha de nacimiento', name: 'birthdate', value: existing?.birthdate || '', type: 'date' }));
  form.appendChild(makeField({ col: 6, label: 'Fecha de inscripción', name: 'joinedAt', value: existing?.joinedAt || todayISO(), type: 'date', required: true }));
  form.appendChild(makeField({ col: 6, label: 'Email', name: 'email', value: existing?.email || '', type: 'email' }));
  form.appendChild(makeField({ col: 6, label: 'Teléfono', name: 'phone', value: existing?.phone || '' }));

  // Section: Membresía
  const sec2 = el('section', { class: 'form-section col-12' }, [ el('h3', { class: 'form-section__title' }, 'Membresía y objetivo') ]);
  form.appendChild(sec2);

  form.appendChild(makeSelect({
    col: 4,
    label: 'Estado',
    name: 'status',
    value: existing?.status || 'active',
    options: [
      { value: 'active',    label: 'Activo' },
      { value: 'inactive',  label: 'Inactivo' },
      { value: 'suspended', label: 'Suspendido' },
    ],
  }));
  form.appendChild(makeField({ col: 4, label: 'Frecuencia semanal (sesiones)', name: 'weeklyGoal', value: existing?.weeklyGoal ?? 2, type: 'number', min: 1, max: 14 }));
  form.appendChild(makeField({ col: 4, label: 'Horarios habituales', name: 'preferredTimes', value: existing?.preferredTimes || '' }));
  form.appendChild(makeField({ col: 12, label: 'Objetivo principal', name: 'mainGoal', value: existing?.mainGoal || '' }));
  form.appendChild(makeField({ col: 6, label: 'Inicio membresía', name: 'membershipStart', value: existing?.membershipStart || '', type: 'date' }));
  form.appendChild(makeField({ col: 6, label: 'Vencimiento membresía', name: 'membershipEnd', value: existing?.membershipEnd || '', type: 'date' }));

  const dialog = el('div', {});
  dialog.appendChild(form);

  openModal({
    title: isEdit ? 'Editar alumno' : 'Nuevo alumno',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: isEdit ? 'Guardar cambios' : 'Crear alumno',
        kind: 'primary',
        onClick: () => {
          const data = collectForm(form);
          if (!data.firstName) {
            toastError('El nombre es obligatorio.');
            return false;
          }
          if (!data.joinedAt) {
            toastError('La fecha de inscripción es obligatoria.');
            return false;
          }
          if (isEdit) {
            const mod = (window.__gt && window.__gt.students) || null;
            import('../services/students.js').then((m) => {
              m.updateStudent(existing.id, data);
              toast({ type: 'success', message: 'Alumno actualizado.' });
              renderGrid();
            });
          } else {
            const created = createStudent(data);
            toast({ type: 'success', message: 'Alumno creado.' });
            location.hash = `#/students/${created.id}`;
          }
        },
      },
    ],
  });
}

function makeField({ col, label, name, value = '', type = 'text', min, max, required = false }) {
  return el('div', { class: `field col-${col}` }, [
    el('label', { class: 'field__label', for: name }, [
      label,
      required ? el('span', { class: 'req' }, '*') : null,
    ].filter(Boolean)),
    el('input', {
      class: 'input',
      type,
      name,
      id: name,
      value: String(value ?? ''),
      min, max,
      required: required || null,
    }),
  ]);
}

function makeSelect({ col, label, name, value, options }) {
  const sel = el('select', { class: 'select', name, id: name });
  for (const o of options) {
    const opt = el('option', { value: o.value }, o.label);
    if (o.value === value) opt.setAttribute('selected', '');
    sel.appendChild(opt);
  }
  return el('div', { class: `field col-${col}` }, [
    el('label', { class: 'field__label', for: name }, label),
    sel,
  ]);
}

function collectForm(form) {
  const out = {};
  for (const elx of form.querySelectorAll('input, select, textarea')) {
    if (!elx.name) continue;
    if (elx.type === 'number') out[elx.name] = elx.value === '' ? null : Number(elx.value);
    else out[elx.name] = elx.value;
  }
  return out;
}
