/* ===========================================================
   GymTrack — Settings view (data, backup, Excel, demo, themes)
   =========================================================== */

import { $, el, fmtDate, todayISO, downloadBlob } from '../utils.js';
import {
  exportJSON, importJSON, installSeed, removeDemo, wipe, getState,
  getLegacyArchive, downloadLegacyArchive, restoreLegacyKey, deleteLegacyArchive,
} from '../storage.js';
import { APP_NAME, APP_VERSION, SCHEMA_VERSION } from '../config.js';
import { refreshIcons } from '../icons.js';
import { openModal, confirmDialog, toast, toastError } from '../components.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderSettings() {
  const main = $('#main');
  const db = getState();
  const meta = db.meta;
  const archive = getLegacyArchive();
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Datos y configuración</span></span>
          <h1 class="page-head__title">Datos y configuración</h1>
          <p class="page-head__sub">Respaldo, importación, plantillas Excel y datos de demostración.</p>
        </div>
      </div>
    </div>

    <div class="settings-grid">
      <aside class="settings-nav">
        <a href="#data" data-scroll="sec-data" class="is-active"><i data-lucide="database"></i>Datos</a>
        <a href="#backup" data-scroll="sec-backup"><i data-lucide="save"></i>Respaldo</a>
        <a href="#excel" data-scroll="sec-excel"><i data-lucide="file-spreadsheet"></i>Excel</a>
        <a href="#demo" data-scroll="sec-demo"><i data-lucide="sparkles"></i>Datos demo</a>
        <a href="#about" data-scroll="sec-about"><i data-lucide="info"></i>Acerca de</a>
      </aside>

      <div class="stack-5">
        <article class="card" id="sec-data">
          <header class="card__header"><h3 class="card__title">Estado del almacenamiento</h3></header>
          <div class="card__body">
            <div class="stack-3">
              <div class="between">
                <span class="t-muted">Última exportación</span>
                <strong>${meta.lastExportAt ? fmtDate(meta.lastExportAt.slice(0,10)) + ' ' + (meta.lastExportAt.slice(11,16) || '') : '—'}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Última importación</span>
                <strong>${meta.lastImportAt ? fmtDate(meta.lastImportAt.slice(0,10)) + ' ' + (meta.lastImportAt.slice(11,16) || '') : '—'}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Alumnos cargados</span>
                <strong>${getState().students.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Asistencias cargadas</span>
                <strong>${db.attendances.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Ejercicios en catálogo</span>
                <strong>${db.exercises.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Entrenamientos definidos</span>
                <strong>${db.trainings.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Mediciones cargadas</span>
                <strong>${db.measurements.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Pagos registrados</span>
                <strong>${getState().payments.length}</strong>
              </div>
              <div class="between">
                <span class="t-muted">Versión esquema</span>
                <strong>v${SCHEMA_VERSION}</strong>
              </div>
            </div>
          </div>
        </article>

        <article class="card" id="sec-backup">
          <header class="card__header"><h3 class="card__title">Respaldo y restauración</h3></header>
          <div class="card__body stack-4">
            <p class="muted-block">Tu información se guarda en este navegador (localStorage). Si cambias de dispositivo, de navegador o borras los datos del sitio, perderás la información. Te recomendamos descargar respaldos periódicos.</p>

            <div class="row gap-2">
              <button class="btn btn--primary" id="setExport"><i data-lucide="download"></i>Exportar base de datos (JSON)</button>
              <button class="btn btn--secondary" id="setImport"><i data-lucide="upload"></i>Restaurar desde archivo</button>
            </div>
            <input type="file" id="setImportFile" accept="application/json" style="display:none" />
            <div class="alert" style="padding:var(--sp-3) var(--sp-4); border-radius:var(--r-sm); background:var(--c-warning-bg); color:var(--c-warning); font-size:var(--fs-sm); border:1px solid rgba(251,191,36,0.30)">
              <i data-lucide="alert-triangle" style="width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px"></i>
              La restauración <strong>reemplaza todos los datos actuales</strong> después de una confirmación explícita.
            </div>
          </div>
        </article>

        ${archive ? `
        <article class="card" id="sec-legacy">
          <header class="card__header">
            <h3 class="card__title"><i data-lucide="archive"></i> Archivo de la versión anterior (v1)</h3>
          </header>
          <div class="card__body stack-4">
            <p class="muted-block">
              Al pasar al esquema v2 (catálogo de ejercicios + entrenamientos compartibles) tu base v1 se archivó
              automáticamente el <strong>${archive.archivedAt ? fmtDate(archive.archivedAt.slice(0,10)) : '—'}</strong>.
              La copia se guarda aparte y <strong>GymTrack 2.0 no la lee</strong>: es sólo una red de seguridad.
            </p>
            <div class="card" style="padding:var(--sp-3) var(--sp-4); background:var(--c-bg-elev-1)">
              ${Object.entries(archive.counts || {})
                .filter(([, n]) => typeof n === 'number' && n > 0)
                .map(([k, n]) => `<div class="between" style="font-size:var(--fs-sm)"><span class="t-muted">${escapeHtml(k)}</span><strong>${n}</strong></div>`)
                .join('')}
            </div>
            <div class="row gap-2" style="flex-wrap:wrap">
              <button class="btn btn--secondary btn--sm" id="setLegacyDownload"><i data-lucide="download"></i>Descargar copia v1</button>
              <button class="btn btn--secondary btn--sm" id="setLegacyRestore"><i data-lucide="undo-2"></i>Restaurar clave v1</button>
              <button class="btn btn--danger btn--sm" id="setLegacyDelete"><i data-lucide="trash-2"></i>Eliminar archivo</button>
            </div>
            <p class="t-muted" style="font-size:var(--fs-xs)">
              "Restaurar clave v1" vuelve a escribir la base antigua en <code>gymtrack:db:v1</code> para que puedas
              abrirla con GymTrack 1.x. Tus datos v2 no se tocan.
            </p>
          </div>
        </article>
        ` : ''}

        <article class="card" id="sec-excel">
          <header class="card__header"><h3 class="card__title">Importar y exportar Excel</h3></header>
          <div class="card__body stack-4">
            <p class="muted-block">Intercambia datos con hojas de cálculo. La aplicación importa el archivo seleccionado como una copia local; los cambios posteriores en el archivo Excel no se reflejan automáticamente en la aplicación.</p>

            <div class="between">
              <h4 class="form-section__title" style="margin:0">Exportar</h4>
              <span class="t-muted" style="font-size:var(--fs-xs)">archivos .xlsx</span>
            </div>
            <div class="row gap-2" style="flex-wrap:wrap">
              <button class="btn btn--secondary btn--sm" data-ex-export="students"><i data-lucide="file-down"></i>Alumnos</button>
              <button class="btn btn--secondary btn--sm" data-ex-export="attendances"><i data-lucide="file-down"></i>Asistencias</button>
              <button class="btn btn--secondary btn--sm" data-ex-export="measurements"><i data-lucide="file-down"></i>Mediciones</button>
              <button class="btn btn--secondary btn--sm" data-ex-export="payments"><i data-lucide="file-down"></i>Pagos</button>
              <button class="btn btn--secondary btn--sm" data-ex-export="workouts"><i data-lucide="file-down"></i>Entrenamientos</button>
            </div>

            <div class="between">
              <h4 class="form-section__title" style="margin:0">Plantillas</h4>
              <span class="t-muted" style="font-size:var(--fs-xs)">formato sugerido para importación</span>
            </div>
            <div class="row gap-2" style="flex-wrap:wrap">
              <button class="btn btn--secondary btn--sm" data-ex-tpl="students"><i data-lucide="download"></i>Plantilla alumnos</button>
              <button class="btn btn--secondary btn--sm" data-ex-tpl="measurements"><i data-lucide="download"></i>Plantilla mediciones</button>
            </div>

            <div class="between">
              <h4 class="form-section__title" style="margin:0">Importar</h4>
              <span class="t-muted" style="font-size:var(--fs-xs)">arrastra tu archivo</span>
            </div>
            <div class="row gap-2" style="flex-wrap:wrap">
              <button class="btn btn--secondary btn--sm" data-ex-imp="students"><i data-lucide="file-up"></i>Importar alumnos</button>
              <button class="btn btn--secondary btn--sm" data-ex-imp="measurements"><i data-lucide="file-up"></i>Importar mediciones</button>
              <input type="file" id="setExcelFile" accept=".xlsx,.xls" style="display:none" />
              <input type="hidden" id="setExcelKind" />
            </div>
          </div>
        </article>

        <article class="card" id="sec-demo">
          <header class="card__header"><h3 class="card__title">Datos de demostración</h3></header>
          <div class="card__body stack-4">
            <p class="muted-block">Genera alumnos, catálogo de ejercicios, entrenamientos, asistencia con pesos, mediciones y pagos de prueba para evaluar la interfaz. Los registros se marcan como <code>isDemo</code> y pueden borrarse después.</p>
            <div class="row gap-2" style="flex-wrap:wrap">
              <button class="btn btn--primary" id="setSeed"><i data-lucide="sparkles"></i>Instalar datos demo</button>
              <button class="btn btn--danger" id="setRemoveDemo"><i data-lucide="trash-2"></i>Eliminar datos demo</button>
            </div>
            <p class="t-muted" style="font-size:var(--fs-xs)">Los datos de demostración actuales: <strong id="setDemoCount">0</strong> alumno(s). Actualiza la pantalla con F5 después de esta acción.</p>
          </div>
        </article>

        <article class="card" id="sec-about">
          <header class="card__header"><h3 class="card__title">Acerca de</h3></header>
          <div class="card__body">
            <ul class="muted-block" style="line-height:1.7; padding-left:18px">
              <li><strong>${APP_NAME}</strong> · Versión ${APP_VERSION}</li>
              <li>Esquema de datos: v${SCHEMA_VERSION}</li>
              <li>Almacenamiento: <code>localStorage</code></li>
              <li>Sin servidor. Sin cuentas. Sin cookies de seguimiento.</li>
              <li>No se almacena información bancaria ni contraseñas.</li>
            </ul>
          </div>
        </article>

        <article class="card">
          <header class="card__header"><h3 class="card__title">Zona peligrosa</h3></header>
          <div class="card__body stack-4">
            <p class="muted-block">Borrar toda la base de datos eliminará alumnos, asistencia, ejercicios, entrenamientos, mediciones, objetivos y pagos. Hazlo solo si realmente quieres empezar de cero o vas a restaurar un respaldo a continuación.</p>
            <button class="btn btn--danger" id="setWipe"><i data-lucide="trash"></i>Borrar toda la base</button>
          </div>
        </article>
      </div>
    </div>
  `;

  refreshDemoCount();
  bind();
  refreshIcons(main);
}

function refreshDemoCount() {
  const c = (getState().students || []).filter((s) => s.meta?.isDemo).length;
  const elx = $('#setDemoCount');
  if (elx) elx.textContent = c;
}

function bind() {
  // Export / Import
  $('#setExport')?.addEventListener('click', () => {
    const json = exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    downloadBlob(blob, `gymtrack_respaldo_${todayISO()}.json`);
    toast({ type: 'success', message: 'Respaldo descargado.' });
  });
  $('#setImport')?.addEventListener('click', () => {
    $('#setImportFile').click();
  });
  $('#setImportFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    // restoreFlow parses, shows a summary and asks for confirmation itself.
    restoreFlow(text);
    e.target.value = '';
  });

  // Excel export buttons
  document.querySelectorAll('[data-ex-export]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.exExport;
      const m = await import('../services/excel.js');
      if (kind === 'students')     m.exportStudents();
      if (kind === 'attendances')  m.exportAttendances();
      if (kind === 'measurements') m.exportMeasurements();
      if (kind === 'payments')     m.exportPayments();
      if (kind === 'workouts')     m.exportWorkouts();
    });
  });
  document.querySelectorAll('[data-ex-tpl]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const kind = btn.dataset.exTpl;
      const m = await import('../services/excel.js');
      if (kind === 'students')     m.downloadStudentsTemplate();
      if (kind === 'measurements') m.downloadMeasurementsTemplate();
    });
  });
  document.querySelectorAll('[data-ex-imp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      $('#setExcelKind').value = btn.dataset.exImp;
      $('#setExcelFile').click();
    });
  });
  $('#setExcelFile')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const kind = $('#setExcelKind').value;
    if (!file || !kind) return;
    if (!file.name.match(/\.xlsx?$/i)) {
      toastError('El archivo debe ser .xlsx'); e.target.value = ''; return;
    }
    await importExcelFlow(file, kind);
    e.target.value = '';
  });

  // Legacy v1 archive (only present after the v1 → v2 migration)
  $('#setLegacyDownload')?.addEventListener('click', () => {
    const ok = downloadLegacyArchive();
    toast({ type: ok ? 'success' : 'error', message: ok ? 'Copia v1 descargada.' : 'No hay archivo v1 disponible.' });
  });
  $('#setLegacyRestore')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Restaurar la base v1',
      message: 'GymTrack 2.0 no lee la base v1. Esta acción la escribe de nuevo en la clave "gymtrack:db:v1" para que puedas abrirla con GymTrack 1.x. Tus datos v2 no se tocan.',
      confirmLabel: 'Restaurar v1',
      confirmKind: 'secondary',
    });
    if (!ok) return;
    const done = restoreLegacyKey();
    toast({
      type: done ? 'success' : 'error',
      message: done
        ? 'Base v1 restaurada. Ábrela con GymTrack 1.x.'
        : 'No se pudo restaurar la base v1.',
    });
  });
  $('#setLegacyDelete')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Eliminar el archivo v1',
      message: 'Se borrará la copia archivada de tu base v1. Si no la descargaste antes, no podrás recuperarla. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar archivo',
      confirmKind: 'danger',
    });
    if (!ok) return;
    deleteLegacyArchive();
    toast({ type: 'success', message: 'Archivo v1 eliminado.' });
    await renderSettings();
  });

  // Demo
  $('#setSeed')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Instalar datos demo',
      message: 'Se generarán alumnos, ejercicios, entrenamientos, asistencia con pesos, mediciones y pagos ficticios marcados como demo. ¿Continuar?',
      confirmLabel: 'Instalar',
      confirmKind: 'primary',
    });
    if (!ok) return;
    const seedMod = await import('../services/seed.js');
    const db = seedMod.buildSeed();
    installSeed(db);
    toast({ type: 'success', message: 'Datos demo instalados.' });
    refreshDemoCount();
  });
  $('#setRemoveDemo')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Eliminar datos demo',
      message: 'Borrarás los alumnos demo y todos sus registros asociados (asistencia, mediciones, pagos, objetivos y notas), además de los ejercicios y entrenamientos demo. Lo que hayas creado a mano se conserva.',
      confirmLabel: 'Eliminar demo',
      confirmKind: 'danger',
    });
    if (!ok) return;
    removeDemo();
    toast({ type: 'success', message: 'Datos demo eliminados.' });
    refreshDemoCount();
  });

  // Wipe
  $('#setWipe')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Borrar base completa',
      message: '¿Borrar absolutamente todo? Esta acción no se puede deshacer.',
      confirmLabel: 'Sí, borrar todo',
      confirmKind: 'danger',
    });
    if (!ok) return;
    wipe();
    toast({ type: 'success', message: 'Base reiniciada.' });
    refreshDemoCount();
  });

  // Settings nav scroll
  document.querySelectorAll('[data-scroll]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(a.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('[data-scroll]').forEach((b) => b.classList.toggle('is-active', b === a));
    });
  });
}

async function restoreFlow(text) {
  // Parse first to show a summary, then ask confirmation.
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { toastError('Archivo no es JSON válido.'); return; }
  if (!parsed || parsed.app !== APP_NAME || !parsed.data) {
    toastError('Este archivo no es un respaldo válido de ' + APP_NAME + '.');
    return;
  }
  const d = parsed.data;
  const summary = {
    'Alumnos': (d.students || []).length,
    'Asistencias': (d.attendances || []).length,
    'Ejercicios': (d.exercises || []).length,
    'Entrenamientos': (d.trainings || []).length,
    'Mediciones': (d.measurements || []).length,
    'Pagos': (d.payments || []).length,
    'Objetivos': (d.goals || []).length,
    'Notas': (d.notes || []).length,
  };
  const summaryHtml = Object.entries(summary).map(([k, v]) => `<div class="between"><span>${k}</span><strong>${v}</strong></div>`).join('');
  const ok = await new Promise((res) => openModal({
    title: 'Restaurar respaldo',
    size: 'lg',
    body: el('div', { class: 'stack-4', html: `
      <div class="alert" style="padding:var(--sp-3) var(--sp-4); border-radius:var(--r-sm); background:var(--c-danger-bg); color:var(--c-danger); font-size:var(--fs-sm); border:1px solid rgba(251,113,133,0.30)">
        <i data-lucide="alert-triangle" style="width:16px;height:16px;display:inline-block;vertical-align:-3px;margin-right:6px"></i>
        <strong>Esta acción reemplazará toda la base de datos actual.</strong>
      </div>
      <p class="muted-block">El respaldo contiene:</p>
      <div class="card" style="padding:var(--sp-4)">${summaryHtml}</div>
      <p class="t-muted">Versión del archivo: v${parsed.schemaVersion} · Exportado el ${parsed.exportedAt ? fmtDate(parsed.exportedAt.slice(0,10)) : '—'}</p>
    ` }),
    actions: [
      { label: 'Cancelar', kind: 'ghost', onClick: () => res(false), closeOnClick: true },
      { label: 'Restaurar', kind: 'danger', onClick: () => res(true), closeOnClick: true },
    ],
  }));
  if (!ok) return;
  const result = importJSON(text);
  if (!result.ok) { toastError(result.error || 'No se pudo restaurar.'); return; }
  toast({ type: 'success', message: `Restaurado: ${result.summary.students} alumnos, ${result.summary.attendances} asistencias, ${result.summary.payments} pagos.` });
  // Refresh internal pieces
  location.reload();
}

async function importExcelFlow(file, kind) {
  const m = await import('../services/excel.js');
  let result;
  try { result = await m.importFile(file, kind); }
  catch (err) { toastError(err.message || 'Error al importar.'); return; }
  if (!result.created?.length) {
    toast({ type: 'info', message: 'Sin registros nuevos para importar.' });
    return;
  }
  if (result.errors?.length) {
    openModal({
      title: `Resultado de la importación`,
      size: 'lg',
      body: el('div', { class: 'stack-4', html: `
        <p><strong>${result.created.length}</strong> registro(s) creado(s), <strong>${result.skipped.length}</strong> omitido(s), <strong>${result.errors.length}</strong> con error.</p>
        ${result.errors.length ? `<div class="card" style="padding:var(--sp-3); background:rgba(251,113,133,0.05)">
          <h4 style="margin:0 0 8px; color:var(--c-danger)">Errores:</h4>
          <ul style="margin:0; padding-left:18px; font-size:var(--fs-sm); color:var(--c-text-muted)">${result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>
        </div>` : ''}
        ${result.skipped.length ? `<p class="t-muted" style="font-size:var(--fs-sm)">${result.skipped.length} fila(s) omitida(s) por coincidir con registros existentes.</p>` : ''}
      ` }),
      actions: [{ label: 'Entendido', kind: 'primary' }],
    });
  } else {
    toast({ type: 'success', message: `Importado: ${result.created.length} registro(s).` });
  }
  refreshIcons(document);
}
