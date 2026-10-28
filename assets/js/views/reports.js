/* ===========================================================
   ALPHA-FIT — Individual reports view
   =========================================================== */

import { $, el, fmtDate, todayISO } from '../utils.js';
import { listStudents, fullName } from '../services/students.js';
import { DEFAULT_SECTIONS, buildReportContext, renderReport } from '../services/reports.js';
import { getState } from '../storage.js';
import { APP_NAME } from '../config.js';
import { refreshIcons } from '../icons.js';
import { openModal, toast } from '../components.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderReports(params) {
  const main = $('#main');
  const students = listStudents();

  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Informes</span></span>
          <h1 class="page-head__title">Informes individuales</h1>
          <p class="page-head__sub">Genera un informe imprimible con el progreso de cada alumno.</p>
        </div>
      </div>
    </div>

    <section class="report-builder">
      <aside>
        <article class="card">
          <header class="card__header"><h3 class="card__title">Configurar informe</h3></header>
          <div class="card__body stack-4">
            <div class="field">
              <label class="field__label">Alumno *</label>
              <select class="select" id="repStudent">
                <option value="">Selecciona un alumno…</option>
                ${students.map((s) => `<option value="${s.id}">${escapeHtml(fullName(s))}</option>`).join('')}
              </select>
            </div>

            <div class="form-grid">
              <div class="field col-6">
                <label class="field__label">Desde</label>
                <input class="input" type="date" id="repFrom" />
              </div>
              <div class="field col-6">
                <label class="field__label">Hasta</label>
                <input class="input" type="date" id="repTo" value="${todayISO()}" />
              </div>
            </div>

            <div class="stack-2">
              <span class="field__label" style="text-transform:uppercase; letter-spacing:0.06em; font-size:var(--fs-xs)">Secciones a incluir</span>
              ${Object.entries(DEFAULT_SECTIONS).map(([k, def]) => `
                <label class="checkbox">
                  <input type="checkbox" data-sec="${k}" ${def ? 'checked' : ''} />
                  ${sectionLabel(k)}
                </label>
              `).join('')}
            </div>

            <div class="field">
              <label class="field__label">Comentario del entrenador (opcional)</label>
              <textarea class="textarea" id="repComment" rows="3" placeholder="Texto adicional al final del informe."></textarea>
            </div>

            <div class="stack-2">
              <button class="btn btn--primary btn--block" id="repGenerate"><i data-lucide="eye"></i>Vista previa</button>
              <button class="btn btn--secondary btn--block" id="repPrint" disabled><i data-lucide="printer"></i>Imprimir / guardar PDF</button>
              <a class="btn btn--ghost btn--block" href="#/students" style="display:none" id="repBack" hidden>Volver</a>
            </div>
          </div>
        </article>
      </aside>

      <div class="report-preview" id="repPreview">
        <div class="empty" style="border:none;background:transparent">
          <div class="empty__icon"><i data-lucide="file-text"></i></div>
          <div class="empty__title">Selecciona un alumno</div>
          <div class="empty__text">Configura el informe a la izquierda y presiona "Vista previa" para ver el resultado.</div>
        </div>
      </div>
    </section>
  `;

  // Optional pre-selection via ?student=
  if (params?.query?.student) {
    $('#repStudent').value = params.query.student;
  }

  bindReport();

  refreshIcons(main);
}

function sectionLabel(key) {
  return {
    attendance: 'Asistencia y cumplimiento',
    level: 'Nivel actual e insignias',
    workouts: 'Entrenamientos y pesos por sesión',
    weight: 'Peso corporal',
    measurements: 'Medidas corporales',
    goals: 'Objetivos',
    payments: 'Historial de pagos',
    notes: 'Notas del entrenador',
  }[key] || key;
}

function bindReport() {
  $('#repGenerate').addEventListener('click', () => {
    const studentId = $('#repStudent').value;
    if (!studentId) { toast({ type: 'warning', message: 'Selecciona un alumno.' }); return; }
    generatePreview();
  });

  $('#repPrint').addEventListener('click', () => {
    const preview = $('#repPreview .report-paper');
    if (!preview) return;
    printReport(preview);
  });

  // Live preview on change
  $('#repStudent').addEventListener('change', () => {
    if ($('#repStudent').value) generatePreview();
  });
  ['repFrom', 'repTo', 'repComment'].forEach((id) => $('#' + id).addEventListener('input', () => {
    if ($('#repPreview .report-paper')) generatePreview();
  }));
  document.querySelectorAll('[data-sec]').forEach((elx) => elx.addEventListener('change', () => {
    if ($('#repPreview .report-paper')) generatePreview();
  }));
}

function generatePreview() {
  const studentId = $('#repStudent').value;
  const student = listStudents().find((s) => s.id === studentId);
  if (!student) return;
  const sections = {};
  document.querySelectorAll('[data-sec]').forEach((elx) => { sections[elx.dataset.sec] = elx.checked; });
  const ctx = buildReportContext(student, {
    sections,
    fromISO: $('#repFrom').value || null,
    toISO: $('#repTo').value || null,
    trainerComment: $('#repComment').value.trim(),
  });
  const html = renderReport(ctx, getState()?.config?.gymName || APP_NAME);
  $('#repPreview').innerHTML = html;
  $('#repPrint').disabled = false;
  refreshIcons($('#repPreview'));
}

function printReport(node) {
  // Move node to a top-level printable container, trigger print, restore.
  const original = node.parentNode;
  const printRoot = el('div', { id: 'print-host', class: 'print-host' });
  printRoot.appendChild(node);
  document.body.appendChild(printRoot);
  // Wait a tick for layout
  setTimeout(() => {
    window.print();
    setTimeout(() => {
      printRoot.remove();
    }, 100);
  }, 60);
}
