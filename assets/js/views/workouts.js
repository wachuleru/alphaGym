/* ===========================================================
   GymTrack — Workouts view (global routines)
   =========================================================== */

import { $, el, fmtDate, initials } from '../utils.js';
import { fullName, listStudents } from '../services/students.js';
import { listRoutines, listRoutineExercises, createRoutine, updateRoutine, deleteRoutine, addExercise, updateExercise, deleteExercise } from '../services/workouts.js';
import { refreshIcons } from '../icons.js';
import { openModal, confirmDialog, toast, toastError } from '../components.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

export async function renderWorkouts() {
  const main = $('#main');
  const routines = listRoutines();

  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Entrenamientos</span></span>
          <h1 class="page-head__title">Entrenamientos</h1>
          <p class="page-head__sub">Rutinas y ejercicios del gimnasio.</p>
        </div>
        <div class="page-head__actions">
          <button class="btn btn--secondary" id="wkExportBtn"><i data-lucide="download"></i>Exportar</button>
          <button class="btn btn--primary" id="wkNew"><i data-lucide="plus"></i>Nueva rutina</button>
        </div>
      </div>
    </div>

    <div class="toolbar">
      <div class="search toolbar__search">
        <i data-lucide="search"></i>
        <input class="input" id="wkSearch" placeholder="Buscar rutinas…" />
      </div>
    </div>

    <div id="wkList"></div>
  `;

  bindActions();
  refreshList();

  refreshIcons(main);
}

function bindActions() {
  $('#wkNew')?.addEventListener('click', () => openRoutineForm(null, () => refreshList()));
  $('#wkExportBtn')?.addEventListener('click', async () => {
    const m = await import('../services/excel.js');
    m.exportWorkouts();
  });
  $('#wkSearch')?.addEventListener('input', () => refreshList());
  $('#wkList').addEventListener('click', onListClick);
}

function refreshList() {
  const wrap = $('#wkList');
  if (!wrap) return;
  const term = ($('#wkSearch').value || '').toLowerCase();
  const routines = listRoutines().filter((r) => {
    if (!term) return true;
    return (r.name + ' ' + (r.objective || '')).toLowerCase().includes(term);
  });
  if (!routines.length) {
    wrap.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="dumbbell"></i></div><div class="empty__title">Sin rutinas</div><div class="empty__text">Crea la primera rutina para empezar.</div><div class="empty__actions"><button class="btn btn--primary" id="wkNewEmpty"><i data-lucide="plus"></i>Nueva rutina</button></div></div>`;
    refreshIcons(wrap);
    $('#wkNewEmpty')?.addEventListener('click', () => openRoutineForm(null, () => refreshList()));
    return;
  }

  wrap.innerHTML = `<div class="stack-4">${routines.map((r) => {
    const ex = listRoutineExercises().filter((e) => e.routineId === r.id).sort((a, b) => a.order - b.order);
    const s = listStudents().find((x) => x.id === r.studentId);
    return `
      <div class="routine-card">
        <div class="routine-card__head">
          <div class="cell-name">
            <div class="stack">
              <span class="routine-card__title">${escapeHtml(r.name)}</span>
              <span class="routine-card__sub">${s ? 'Alumno: ' + escapeHtml(fullName(s)) : 'Sin asignar'} · ${escapeHtml(r.objective || '—')} · ${ex.length} ejercicio(s)</span>
            </div>
          </div>
          <div class="row gap-2">
            <button class="btn btn--ghost btn--sm" data-act="edit" data-id="${r.id}"><i data-lucide="pencil"></i>Editar</button>
            <button class="btn btn--ghost btn--sm" data-act="addEx" data-id="${r.id}"><i data-lucide="plus"></i>Ejercicio</button>
            <button class="btn btn--danger btn--sm" data-act="del" data-id="${r.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="exercise-list">
          ${ex.map((e) => `
            <div class="exercise-row">
              <div class="exercise-row__name">${escapeHtml(e.name)}<small>${escapeHtml(e.muscleGroup || '')}</small></div>
              <div class="t-mono">${escapeHtml(String(e.sets || '—'))} series</div>
              <div class="t-mono">${escapeHtml(String(e.reps || '—'))}</div>
              <div class="t-mono">${e.weightKg ? e.weightKg + ' kg' : '—'}</div>
            </div>
          `).join('') || '<div class="t-muted" style="font-size:var(--fs-sm)">Sin ejercicios.</div>'}
        </div>
      </div>
    `;
  }).join('')}</div>`;
  refreshIcons(wrap);
}

async function onListClick(e) {
  const editBtn = e.target.closest('[data-act="edit"]');
  const delBtn = e.target.closest('[data-act="del"]');
  const addBtn = e.target.closest('[data-act="addEx"]');
  if (editBtn) {
    const r = listRoutines().find((x) => x.id === editBtn.dataset.id);
    openRoutineForm(r, () => refreshList());
  }
  if (delBtn) {
    const ok = await confirmDialog({ title: 'Eliminar rutina', message: '¿Eliminar esta rutina y sus ejercicios?' });
    if (!ok) return;
    deleteRoutine(delBtn.dataset.id);
    toast({ type: 'success', message: 'Rutina eliminada.' });
    refreshList();
  }
  if (addBtn) {
    openExerciseForm(addBtn.dataset.id, () => refreshList());
  }
}

function openRoutineForm(existing, onSaved) {
  const r = existing || { name: '', objective: '', studentId: '', status: 'active' };
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-8"><label class="field__label">Nombre *</label><input class="input" id="rtName" value="${escapeHtml(r.name)}" placeholder="Ej: Tren superior fuerza" /></div>
      <div class="field col-4">
        <label class="field__label">Estado</label>
        <select class="select" id="rtStatus">
          <option value="active"   ${r.status === 'active' ? 'selected' : ''}>Activa</option>
          <option value="archived" ${r.status === 'archived' ? 'selected' : ''}>Archivada</option>
        </select>
      </div>
      <div class="field col-12"><label class="field__label">Objetivo</label><input class="input" id="rtObjective" value="${escapeHtml(r.objective || '')}" /></div>
      <div class="field col-12">
        <label class="field__label">Asignar a (opcional)</label>
        <select class="select" id="rtStudent">
          <option value="">Sin asignar</option>
          ${listStudents().map((s) => `<option value="${s.id}" ${r.studentId === s.id ? 'selected' : ''}>${escapeHtml(fullName(s))}</option>`).join('')}
        </select>
      </div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar rutina' : 'Nueva rutina',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const name = dialog.querySelector('#rtName').value.trim();
          if (!name) { toastError('El nombre es obligatorio.'); return false; }
          const data = {
            name,
            objective: dialog.querySelector('#rtObjective').value.trim(),
            studentId: dialog.querySelector('#rtStudent').value || null,
            status: dialog.querySelector('#rtStatus').value,
          };
          if (existing) updateRoutine(existing.id, data);
          else createRoutine(data);
          toast({ type: 'success', message: existing ? 'Rutina actualizada.' : 'Rutina creada.' });
          onSaved && onSaved();
        },
      },
    ],
  });
  refreshIcons(dialog);
}

function openExerciseForm(routineId, onSaved) {
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-6"><label class="field__label">Nombre *</label><input class="input" id="exName" /></div>
      <div class="field col-6"><label class="field__label">Grupo muscular</label><input class="input" id="exGroup" /></div>
      <div class="field col-3"><label class="field__label">Series</label><input class="input" id="exSets" /></div>
      <div class="field col-3"><label class="field__label">Reps</label><input class="input" id="exReps" /></div>
      <div class="field col-3"><label class="field__label">Peso (kg)</label><input class="input" type="number" step="0.5" id="exWeight" /></div>
      <div class="field col-3"><label class="field__label">Descanso (s)</label><input class="input" type="number" id="exRest" /></div>
      <div class="field col-12"><label class="field__label">Instrucciones / Notas</label><textarea class="textarea" id="exNotes" rows="2"></textarea></div>
    </div>
  `;
  openModal({
    title: 'Agregar ejercicio',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Agregar', kind: 'primary',
        onClick: () => {
          const name = dialog.querySelector('#exName').value.trim();
          if (!name) { toastError('El nombre es obligatorio.'); return false; }
          const order = (listRoutineExercises().filter((e) => e.routineId === routineId).length);
          addExercise({
            routineId,
            name,
            muscleGroup: dialog.querySelector('#exGroup').value,
            sets: dialog.querySelector('#exSets').value,
            reps: dialog.querySelector('#exReps').value,
            weightKg: dialog.querySelector('#exWeight').value,
            restSec: dialog.querySelector('#exRest').value,
            notes: dialog.querySelector('#exNotes').value,
            order,
          });
          toast({ type: 'success', message: 'Ejercicio agregado.' });
          onSaved && onSaved();
        },
      },
    ],
  });
  refreshIcons(dialog);
}
