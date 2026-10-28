/* ===========================================================
   ALPHA-FIT — Attendance form (shared modal)
   Replaces the three legacy register call sites:
     - views/attendance.js   ("Registrar asistencia" button)
     - views/student-detail  (sdRegisterAtt + Workouts tab)
     - views/dashboard.js    (quick register card)

   Features:
     - Training picker → preload from history (sets/reps/weight/implement)
     - Live delta hint next to weight (+ kg · + %, dot decimal)
     - Add/remove exercises on the spot (`extra:true`, persisted)
     - Single write path: `saveAttendance` recomputes lastWeightKg
   =========================================================== */

import { $, todayISO } from '../utils.js';
import { listStudents, fullName } from '../services/students.js';
import { listTrainings, findTraining } from '../services/trainings.js';
import { listCategories, findCategory, groupTrainingsByCategory } from '../services/categories.js';
import { listExercises, findExercise } from '../services/exercises.js';
import {
  saveAttendance,
  listAttendances,
  draftForAttendance,
} from '../services/attendance.js';
import { draftEntryForExercise, weightDelta } from '../services/entries.js';
import { MUSCLE_GROUP_BY_VALUE, IMPLEMENT_BY_VALUE, IMPLEMENTS, NO_CATEGORY_LABEL } from '../config.js';
import { openModal, toast, toastError } from '../components.js';
import { refreshIcons } from '../icons.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

/**
 * Open the attendance form.
 * @param {object} opts
 * @param {string} [opts.studentId]
 * @param {object} [opts.existing] — full attendance record for edit mode
 * @param {function} [opts.onSaved] — called after the write succeeds
 */
export function openAttendanceForm({ studentId = null, existing = null, onSaved = null } = {}) {
  const state = {
    studentId,
    trainingId: existing?.trainingId || null,
    dateISO: existing?.dateISO || todayISO(),
    timeISO: existing?.timeISO || null,
    type: existing?.type || 'regular',
    drafts: [],
  };

  // Cascading picker: category first, then the training inside it. On edit we
  // start pre-scoped to the category of the training already recorded, so the
  // current value is visible in the list instead of hidden by the filter.
  const categories = listCategories();
  const existingTraining = existing?.trainingId ? findTraining(existing.trainingId) : null;
  let categoryFilter = '';
  if (existingTraining) categoryFilter = existingTraining.categoryId || '__none__';

  const tpl = document.createElement('div');
  tpl.innerHTML = `
    <div class="form-grid">
      ${studentId
        ? ''
        : `<div class="field col-6"><label class="field__label">Alumno *</label>
            <select class="select" id="atStudent">
              <option value="">Selecciona un alumno…</option>
              ${listStudents().filter((s) => s.status === 'active').map((s) =>
                `<option value="${s.id}">${escapeHtml(fullName(s))}</option>`).join('')}
            </select></div>`}
      <div class="field ${studentId ? 'col-6' : 'col-3'}"><label class="field__label">Fecha</label>
        <input class="input" type="date" id="atDate" value="${escapeHtml(state.dateISO)}" /></div>
      <div class="field ${studentId ? 'col-6' : 'col-3'}"><label class="field__label">Tipo</label>
        <select class="select" id="atType">
          <option value="regular" ${state.type === 'regular' ? 'selected' : ''}>Regular</option>
          <option value="personalizada" ${state.type === 'personalizada' ? 'selected' : ''}>Personalizada</option>
          <option value="evaluación" ${state.type === 'evaluación' ? 'selected' : ''}>Evaluación</option>
        </select></div>
      <div class="field col-6"><label class="field__label">Categoría</label>
        <select class="select" id="atCategory">
          <option value="">Todas las categorías</option>
          ${categories.map((c) =>
            `<option value="${c.id}" ${categoryFilter === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
          <option value="__none__" ${categoryFilter === '__none__' ? 'selected' : ''}>Sin categoría</option>
        </select>
        <p class="field__hint">Elige una categoría para acotar la lista de entrenamientos.</p>
      </div>
      <div class="field col-6"><label class="field__label">Entrenamiento</label>
        <select class="select" id="atTraining"></select>
        <p class="field__hint" id="atTrainingHint"></p>
      </div>
      <div class="field col-12"><label class="field__label">Observaciones</label>
        <textarea class="textarea" id="atNotes" rows="2" placeholder="Notas generales de la sesión…">${escapeHtml(existing?.notes || '')}</textarea></div>
    </div>

    <div style="display:flex; flex-direction:column; gap:var(--sp-3); margin-top:var(--sp-3)">
      <div class="between">
        <h3 class="form-section__title" style="margin:0">Ejercicios realizados</h3>
        <span class="t-muted" id="atEntriesCount"></span>
      </div>
      <div id="atEntries" class="stack-2"></div>

      <div id="atAddPanel" class="card" style="padding:var(--sp-3)">
        <div class="form-grid" style="align-items:end">
          <div class="field col-9"><label class="field__label">Añadir ejercicio (sólo esta asistencia)</label>
            <select class="select" id="atAddSelect"></select></div>
          <div class="field col-3" style="justify-content:flex-end">
            <button class="btn btn--secondary" id="atAddBtn" type="button"><i data-lucide="plus"></i>Añadir</button>
          </div>
          <div class="col-12"><p class="field__hint">Esta selección queda guardada únicamente en esta asistencia; el entrenamiento no se modifica.</p></div>
        </div>
      </div>
    </div>
  `;

  openModal({
    title: existing ? 'Editar asistencia' : 'Registrar asistencia',
    size: 'xl',
    body: tpl,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: existing ? 'Guardar cambios' : 'Registrar',
        kind: 'primary',
        onClick: () => {
          if (!state.studentId) { toastError('Selecciona un alumno.'); return false; }
          const result = saveAttendance({
            id: existing?.id || null,
            studentId: state.studentId,
            trainingId: state.trainingId || null,
            dateISO: state.dateISO,
            timeISO: state.timeISO,
            type: state.type,
            notes: $('#atNotes').value.trim(),
            entries: state.drafts,
          });
          toast({ type: 'success', message: result.created ? 'Asistencia registrada.' : 'Asistencia actualizada.' });
          if (onSaved) onSaved(result);
          return true;
        },
      },
    ],
  });

  refreshIcons(tpl);

  /* ---------- Wire interactions ---------- */

  if (!studentId) {
    $('#atStudent').addEventListener('change', (e) => {
      state.studentId = e.target.value || null;
      reloadDrafts();
    });
  }
  $('#atDate').addEventListener('change', (e) => {
    state.dateISO = e.target.value || todayISO();
    reloadDrafts();
  });
  $('#atCategory').addEventListener('change', (e) => {
    categoryFilter = e.target.value || '';
    renderTrainingOptions();
    // A training that no longer belongs to the visible bucket is dropped, so
    // the form never keeps a selection the user cannot see or undo.
    const stillVisible = state.trainingId && $('#atTraining').querySelector(`option[value="${state.trainingId}"]`);
    if (state.trainingId && !stillVisible) {
      state.trainingId = null;
      $('#atTraining').value = '';
      toast({
        type: 'info',
        title: 'Entrenamiento soltado',
        message: `Ya no está en la categoría elegida, así que la sesión quedó como "Sesión libre".`,
        timeout: 3500,
      });
      reloadDrafts();
    } else {
      renderTrainingHint();
    }
  });
  $('#atTraining').addEventListener('change', (e) => {
    const newId = e.target.value || null;
    if (state.trainingId !== newId) {
      state.trainingId = newId;
      toast({ type: 'info', title: 'Entrenamiento cambiado', message: 'Se recargaron los ejercicios del entrenamiento.', timeout: 3000 });
      reloadDrafts();
    }
  });
  $('#atType').addEventListener('change', (e) => { state.type = e.target.value; });

  $('#atAddBtn').addEventListener('click', () => {
    const id = $('#atAddSelect').value;
    if (!id) { toastError('Selecciona un ejercicio para añadir.'); return; }
    const exercise = findExercise(id);
    if (!exercise) return;
    const prior = lastEntryFor(state.studentId, exercise.id, state.dateISO);
    const draft = draftEntryForExercise({ exercise, prior });
    draft.order = state.drafts.length;
    state.drafts.push(draft);
    renderEntries();
    refreshAddSelect();
  });

  /* ---------- Seed + render ---------- */

  /** Rebuild the training <select> for the current category.
   *  With "Todas" the options are grouped in <optgroup> per category, which is
   *  the same grouping the workouts view uses; with a single category picked,
   *  the list is just that bucket. */
  function renderTrainingOptions() {
    const sel = $('#atTraining');
    if (!sel) return;
    const all = listTrainings();
    const filtered = categoryFilter === ''
      ? all
      : all.filter((t) => (t.categoryId || null) === (categoryFilter === '__none__' ? null : categoryFilter));

    const free = `<option value="">— Sesión libre (sin plantilla) —</option>`;
    if (categoryFilter === '') {
      const groups = groupTrainingsByCategory(filtered, listCategories());
      sel.innerHTML = free + groups.map((g) => `
        <optgroup label="${escapeHtml(g.category ? g.category.name : NO_CATEGORY_LABEL)}">
          ${g.trainings.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
        </optgroup>`).join('');
    } else {
      sel.innerHTML = free + filtered.map((t) =>
        `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    }
    sel.value = state.trainingId || '';
    if (sel.value !== (state.trainingId || '')) sel.value = '';
  }

  /** Show the training's own guidance under the picker, so the trainer
   *  sees "calentamiento 10 min" without opening the workouts view. */
  function renderTrainingHint() {
    const hint = $('#atTrainingHint');
    if (!hint) return;
    const t = state.trainingId ? findTraining(state.trainingId) : null;
    if (!t) { hint.textContent = ''; return; }
    const bits = [];
    const cat = t.categoryId ? findCategory(t.categoryId) : null;
    bits.push(cat ? cat.name : NO_CATEGORY_LABEL);
    if (t.objective) bits.push(t.objective);
    if (t.observation) bits.push(t.observation);
    hint.textContent = bits.join(' · ');
  }

  function reloadDrafts() {
    if (existing && state.studentId === existing.studentId && state.dateISO === existing.dateISO) {
      state.drafts = existing.entries.map((e) => ({ ...e }));
    } else if (state.studentId && state.dateISO) {
      state.drafts = draftForAttendance({
        studentId: state.studentId,
        trainingId: state.trainingId,
        dateISO: state.dateISO,
        excludeAttendanceId: existing?.id || null,
      }).entries;
    } else {
      state.drafts = [];
    }
    state.drafts.forEach((d, i) => { d.order = i; });
    renderTrainingHint();
    renderEntries();
    refreshAddSelect();
  }

  renderTrainingOptions();
  if (state.studentId && state.dateISO) reloadDrafts();
  else { renderTrainingHint(); renderEntries(); refreshAddSelect(); }

  function refreshAddSelect() {
    const present = new Set(state.drafts.map((d) => d.exerciseId));
    const opts = listExercises().filter((e) => !present.has(e.id));
    const sel = $('#atAddSelect');
    sel.innerHTML = opts.length
      ? `<option value="">Selecciona…</option>${opts.map((e) =>
          `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('')}`
      : `<option value="">No quedan más ejercicios en el catálogo</option>`;
    refreshIcons(sel);
  }

  function renderEntries() {
    const root = $('#atEntries');
    const countEl = $('#atEntriesCount');
    if (countEl) countEl.textContent = `${state.drafts.length} ejercicio(s)`;
    if (!root) return;

    if (!state.drafts.length) {
      root.innerHTML = `<div class="empty"><div class="empty__icon"><i data-lucide="dumbbell"></i></div>
        <div class="empty__title">Sin ejercicios</div>
        <div class="empty__text">Elige un entrenamiento o añade ejercicios manualmente.</div></div>`;
      refreshIcons(root);
      return;
    }

    root.innerHTML = state.drafts.map((d, idx) => entryRow(d, idx)).join('');
    refreshIcons(root);

    // delegated input handler — keeps state.drafts in sync, with live delta on weightKg.
    root.oninput = (e) => {
      const t = e.target;
      if (!t.dataset || !t.dataset.f) return;
      const idx = Number(t.dataset.i);
      const draft = state.drafts[idx];
      if (!draft) return;
      const f = t.dataset.f;
      if (f === 'weightKg') {
        draft.weightKg = t.value === '' ? null : Number(t.value);
        const delta = weightDelta(draft.weightKg, draft.lastWeightKg);
        const hint = root.querySelector(`[data-entry="${idx}"] [data-delta]`);
        if (hint) {
          hint.textContent = delta.text;
          hint.className = `weight-delta ${delta.tone === 'up' ? 't-success' : delta.tone === 'down' ? 't-danger' : 't-muted'}`;
        }
      } else {
        draft[f] = t.value;
      }
    };

    root.onclick = (e) => {
      const entryEl = e.target.closest('[data-entry]');
      if (!entryEl) return;
      const idx = Number(entryEl.dataset.entry);
      if (Number.isNaN(idx)) return;
      if (e.target.closest('[data-act="at-rm"]')) {
        state.drafts.splice(idx, 1);
        state.drafts.forEach((d, i) => { d.order = i; });
        renderEntries();
        refreshAddSelect();
      } else if (e.target.closest('[data-act="at-up"]') && idx > 0) {
        const [moved] = state.drafts.splice(idx, 1);
        state.drafts.splice(idx - 1, 0, moved);
        state.drafts.forEach((d, i) => { d.order = i; });
        renderEntries();
      } else if (e.target.closest('[data-act="at-dn"]') && idx < state.drafts.length - 1) {
        const [moved] = state.drafts.splice(idx, 1);
        state.drafts.splice(idx + 1, 0, moved);
        state.drafts.forEach((d, i) => { d.order = i; });
        renderEntries();
      }
    };
  }

  function entryRow(d, idx) {
    const groups = (d.muscleGroups || [])
      .map((g) => MUSCLE_GROUP_BY_VALUE[g])
      .filter(Boolean)
      .map((g) => `<span class="badge badge--${g.color}">${escapeHtml(g.label)}</span>`)
      .join('');
    const weightVal = typeof d.weightKg === 'number' ? d.weightKg : '';
    const delta = weightDelta(d.weightKg, d.lastWeightKg);
    const implementOpts = IMPLEMENTS.map((i) =>
      `<option value="${i.value}" ${d.implement === i.value ? 'selected' : ''}>${escapeHtml(i.label)}</option>`
    ).join('');
    const extraClass = d.extra ? ' routine-card--extra' : '';
    return `
    <article class="routine-card${extraClass}" data-entry="${idx}" style="padding:var(--sp-3)">
      <header class="routine-card__head">
        <div class="cell-name">
          <div class="stack">
            <span class="routine-card__title">
              ${escapeHtml(d.name || 'Ejercicio')}
              ${d.extra ? '<span class="badge badge--warning" style="margin-left:6px"><i data-lucide="plus"></i>Añadido</span>' : ''}
            </span>
            <span class="routine-card__sub">${groups || '<span class="t-muted">(sin grupos)</span>'}</span>
          </div>
        </div>
        <div class="row gap-1">
          <button class="icon-btn" type="button" data-act="at-up" title="Subir"><i data-lucide="arrow-up"></i></button>
          <button class="icon-btn" type="button" data-act="at-dn" title="Bajar"><i data-lucide="arrow-down"></i></button>
          <button class="icon-btn" type="button" data-act="at-rm" title="Quitar"><i data-lucide="x"></i></button>
        </div>
      </header>
      <div class="exercise-list">
        <div class="exercise-row" style="grid-template-columns: 1.4fr 1fr 1.2fr 1.4fr">
          <div class="exercise-row__name">
            <small class="t-muted" style="display:block">Series × Reps</small>
            <div class="row gap-1" style="margin-top:4px">
              <input class="input input--inline" style="width:64px" data-f="sets" data-i="${idx}" value="${escapeHtml(String(d.sets || ''))}" placeholder="4" />
              <span class="t-mono">×</span>
              <input class="input input--inline" style="width:80px" data-f="reps" data-i="${idx}" value="${escapeHtml(String(d.reps || ''))}" placeholder="8-10" />
            </div>
          </div>
          <div>
            <small class="t-muted" style="display:block">Peso (kg)</small>
            <input class="input input--inline" style="margin-top:4px" type="number" step="0.5" data-f="weightKg" data-i="${idx}" value="${escapeHtml(String(weightVal))}" placeholder="0" />
          </div>
          <div>
            <small class="t-muted" style="display:block">Δ vs anterior</small>
            <div data-delta style="margin-top:8px" class="weight-delta ${delta.tone === 'up' ? 't-success' : delta.tone === 'down' ? 't-danger' : 't-muted'}">${escapeHtml(delta.text)}</div>
          </div>
          <div>
            <small class="t-muted" style="display:block">Implemento</small>
            <select class="select input--inline" style="margin-top:4px" data-f="implement" data-i="${idx}">
              <option value="">—</option>
              ${implementOpts}
            </select>
          </div>
        </div>
        <div class="col-12" style="margin-top:6px">
          <input class="input input--inline" data-f="observation" data-i="${idx}" value="${escapeHtml(String(d.observation || ''))}" placeholder="Nota del ejercicio (opcional)" />
        </div>
      </div>
    </article>`;
  }
}

/** Most recent prior entry for an exercise (for a brand new on-the-spot addition). */
function lastEntryFor(studentId, exerciseId, beforeISO) {
  if (!studentId || !exerciseId || !beforeISO) return null;
  const all = listAttendances();
  const candidates = all
    .filter((a) => a.studentId === studentId
      && a.dateISO < beforeISO
      && Array.isArray(a.entries))
    .sort((a, b) => `${b.dateISO}${b.timeISO || ''}`.localeCompare(`${a.dateISO}${a.timeISO || ''}`));
  for (const a of candidates) {
    for (const e of a.entries) {
      if (e.exerciseId === exerciseId) return e;
    }
  }
  return null;
}
