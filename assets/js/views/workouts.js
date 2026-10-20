/* ===========================================================
   GymTrack — Workouts view (Trainings + categories + exercises)
   =========================================================== */

import { $, $$, el } from '../utils.js';
import {
  listTrainings,
  findTraining,
  createTraining,
  updateTraining,
  deleteTraining,
  exercisesOf,
} from '../services/trainings.js';
import {
  listCategories,
  findCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  groupTrainingsByCategory,
} from '../services/categories.js';
import {
  listExercises,
  createExercise,
  updateExercise,
  deleteExercise,
} from '../services/exercises.js';
import { refreshIcons } from '../icons.js';
import { openModal, confirmDialog, toast, toastError } from '../components.js';
import { MUSCLE_GROUPS, MUSCLE_GROUP_BY_VALUE, BADGE_TONES, NO_CATEGORY_LABEL } from '../config.js';

const escapeHtml = (s) => String(s || '').replace(/[<>&"']/g, (c) =>
  ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

/** Filter state. Lives at module scope so it survives the panel re-renders of
 *  the trainings tab, and is reset on every route navigation in renderWorkouts. */
let catFilter = 'all'; // 'all' | 'none' | categoryId

export async function renderWorkouts() {
  const main = $('#main');
  catFilter = 'all';
  // Read the tab from the URL on every render — the module outlives the route,
  // so a module-level constant would freeze the tab on first navigation.
  const initialTab = (typeof window !== 'undefined' && typeof location !== 'undefined')
    ? new URLSearchParams((location.hash || '').split('?')[1] || '')?.get('tab') || 'trainings'
    : 'trainings';
  main.innerHTML = `
    <div class="page-head">
      <div class="page-head__row">
        <div class="stack">
          <span class="crumbs"><a href="#/dashboard">Inicio</a><span>Entrenamientos</span></span>
          <h1 class="page-head__title">Entrenamientos</h1>
          <p class="page-head__sub">Plantillas reutilizables agrupadas por categoría, y catálogo de ejercicios.</p>
        </div>
        <div class="page-head__actions" id="wkPageActions"></div>
      </div>
    </div>

    <div class="tabs" role="tablist" id="wkTabs">
      <button class="tab" data-tab="trainings" role="tab">Entrenamientos</button>
      <button class="tab" data-tab="categories" role="tab">Categorías</button>
      <button class="tab" data-tab="exercises" role="tab">Catálogo de ejercicios</button>
    </div>

    <div id="wkPanel"></div>
  `;

  const pageActions = $('#wkPageActions');
  const tabButtons = $$('#wkTabs .tab');

  function setActions(tab) {
    if (tab === 'trainings') {
      pageActions.innerHTML = `<button class="btn btn--secondary" id="wkExportBtn"><i data-lucide="download"></i>Exportar</button>
        <button class="btn btn--primary" id="wkNewTraining"><i data-lucide="plus"></i>Nuevo entrenamiento</button>`;
      $('#wkNewTraining')?.addEventListener('click', () => openTrainingForm(null, refreshTrainings));
      $('#wkExportBtn')?.addEventListener('click', async () => {
        const m = await import('../services/excel.js');
        m.exportWorkouts();
      });
    } else if (tab === 'categories') {
      pageActions.innerHTML = `<button class="btn btn--primary" id="wkNewCategory"><i data-lucide="plus"></i>Nueva categoría</button>`;
      $('#wkNewCategory')?.addEventListener('click', () => openCategoryForm(null, refreshCategories));
    } else {
      pageActions.innerHTML = `<button class="btn btn--primary" id="wkNewExercise"><i data-lucide="plus"></i>Nuevo ejercicio</button>`;
      $('#wkNewExercise')?.addEventListener('click', () => openExerciseForm(null, refreshExercises));
    }
    refreshIcons(pageActions);
  }

  function activate(tab) {
    tabButtons.forEach((b) => b.classList.toggle('is-active', b.dataset.tab === tab));
    setActions(tab);
    if (tab === 'trainings') refreshTrainings();
    else if (tab === 'categories') refreshCategories();
    else refreshExercises();
  }

  tabButtons.forEach((b) => b.addEventListener('click', () => activate(b.dataset.tab)));
  activate(['trainings', 'categories', 'exercises'].includes(initialTab) ? initialTab : 'trainings');
  refreshIcons(main);
}

/* ===========================================================
   Trainings
   =========================================================== */

/** Read the current filter out of the select. Encoded as
 *  'all' | 'none' | <categoryId>. */
function readFilter() {
  const sel = $('#wkCatFilter');
  if (!sel) return 'all';
  catFilter = sel.value || 'all';
  return catFilter;
}

function trainingCard(t) {
  const ex = exercisesOf(t.id);
  const groupsSet = new Set();
  ex.forEach((e) => (e.muscleGroups || []).forEach((g) => groupsSet.add(g)));
  const groups = [...groupsSet];
  const cat = t.categoryId ? findCategory(t.categoryId) : null;
  return `
    <article class="routine-card" data-id="${t.id}">
      <header class="routine-card__head">
        <div class="cell-name">
          <div class="stack">
            <span class="routine-card__title">${escapeHtml(t.name)}</span>
            <span class="routine-card__sub">
              ${escapeHtml(t.objective || '—')} · ${ex.length} ejercicio(s)
              ${t.observation ? ` · <span class="t-muted">${escapeHtml(t.observation.slice(0, 80))}${t.observation.length > 80 ? '…' : ''}</span>` : ''}
            </span>
            <div class="row gap-2" style="flex-wrap:wrap;margin-top:6px">
              ${cat
                ? `<span class="badge badge--${escapeHtml(cat.color)}"><i data-lucide="folder"></i>${escapeHtml(cat.name)}</span>`
                : `<span class="badge badge--muted">${escapeHtml(NO_CATEGORY_LABEL)}</span>`}
              ${groups.map((g) => {
                const def = MUSCLE_GROUP_BY_VALUE[g];
                return def ? `<span class="badge badge--${def.color}">${escapeHtml(def.label)}</span>` : '';
              }).join('')}
            </div>
          </div>
        </div>
        <div class="row gap-2">
          <button class="btn btn--ghost btn--sm" data-act="editTraining" data-id="${t.id}"><i data-lucide="pencil"></i>Editar</button>
          <button class="btn btn--danger btn--sm" data-act="delTraining" data-id="${t.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
        </div>
      </header>
      <div class="exercise-list">
        ${ex.map((e) => `
          <div class="exercise-row">
            <div class="exercise-row__name">${escapeHtml(e.name)}${e._missing ? ' <small class="t-muted">(eliminado del catálogo)</small>' : ''}<small>${(e.muscleGroups || []).map((g) => escapeHtml((MUSCLE_GROUP_BY_VALUE[g]||{label:g}).label)).join(' · ')}</small></div>
            <div class="t-mono"></div>
            <div class="t-mono"></div>
            <div class="t-mono"></div>
          </div>`).join('') || '<div class="t-muted" style="font-size:var(--fs-sm)">Sin ejercicios.</div>'}
      </div>
    </article>`;
}

function refreshTrainings() {
  const wrap = $('#wkPanel');
  if (!wrap) return;

  const categories = listCategories();
  const all = listTrainings();

  // A filter pointing at a category that was deleted on the Categorías tab would
  // render an empty list under a select showing "Todas". Snap it back.
  if (catFilter !== 'all' && catFilter !== 'none' && !categories.some((c) => c.id === catFilter)) {
    catFilter = 'all';
  }

  // 'none' is a real bucket, not a sentinel for "no filter".
  const trainings = catFilter === 'all' ? all : all.filter((t) => (t.categoryId || null) === (catFilter === 'none' ? null : catFilter));

  const filterBar = `
    <div class="toolbar">
      <div class="toolbar__filters">
        <span class="t-muted">Categoría</span>
        <select class="select input--inline" id="wkCatFilter" style="width:auto">
          <option value="all"${catFilter === 'all' ? ' selected' : ''}>Todas (${all.length})</option>
          ${categories.map((c) => {
            const n = all.filter((t) => t.categoryId === c.id).length;
            return `<option value="${c.id}"${catFilter === c.id ? ' selected' : ''}>${escapeHtml(c.name)} (${n})</option>`;
          }).join('')}
          <option value="none"${catFilter === 'none' ? ' selected' : ''}>Sin categoría (${all.filter((t) => !t.categoryId).length})</option>
        </select>
      </div>
    </div>`;

  if (!all.length) {
    wrap.innerHTML = filterBar + `
      <div class="empty">
        <div class="empty__icon"><i data-lucide="dumbbell"></i></div>
        <div class="empty__title">Sin entrenamientos</div>
        <div class="empty__text">Crea la primera plantilla de entrenamiento para empezar.</div>
      </div>`;
    bindFilter(wrap);
    refreshIcons(wrap);
    return;
  }

  if (!trainings.length) {
    wrap.innerHTML = filterBar + `
      <div class="empty">
        <div class="empty__icon"><i data-lucide="filter"></i></div>
        <div class="empty__title">Sin entrenamientos en esta categoría</div>
        <div class="empty__text">Cambia el filtro o asigna un entrenamiento a esta categoría desde "Editar".</div>
      </div>`;
    bindFilter(wrap);
    refreshIcons(wrap);
    return;
  }

  const groups = groupTrainingsByCategory(trainings, categories);
  wrap.innerHTML = filterBar + `<div class="stack-4">${groups.map((g) => `
    <section class="category-group">
      <div class="category-group__head">
        ${g.category
          ? `<span class="badge badge--${escapeHtml(g.category.color)}"><i data-lucide="folder"></i>${escapeHtml(g.category.name)}</span>`
          : `<span class="badge badge--muted">${escapeHtml(NO_CATEGORY_LABEL)}</span>`}
        <span class="category-group__count">${g.trainings.length} entrenamiento(s)</span>
        ${g.category?.observation ? `<span class="category-group__obs">${escapeHtml(g.category.observation)}</span>` : ''}
      </div>
      ${g.trainings.map(trainingCard).join('')}
    </section>`).join('')}</div>`;
  bindFilter(wrap);
  refreshIcons(wrap);

  // `#wkPanel` keeps its node across re-renders, so swap the handler instead of
  // stacking a new one on every refresh (edit → save → refresh → edit again…).
  if (wrap.__gtClick) wrap.removeEventListener('click', wrap.__gtClick);
  wrap.__gtClick = onTrainingClick;
  wrap.addEventListener('click', wrap.__gtClick);
}

function bindFilter(wrap) {
  const sel = $('#wkCatFilter');
  if (!sel) return;
  if (sel.__gtChange) sel.removeEventListener('change', sel.__gtChange);
  sel.__gtChange = () => { readFilter(); refreshTrainings(); };
  sel.addEventListener('change', sel.__gtChange);
}

async function onTrainingClick(e) {
  const editBtn = e.target.closest('[data-act="editTraining"]');
  const delBtn = e.target.closest('[data-act="delTraining"]');
  if (editBtn) {
    const t = findTraining(editBtn.dataset.id);
    openTrainingForm(t, refreshTrainings);
  }
  if (delBtn) {
    const ok = await confirmDialog({
      title: 'Eliminar entrenamiento',
      message: '¿Eliminar este entrenamiento? Las asistencias ya registradas se conservarán; sólo aparecerá la etiqueta "Entrenamiento eliminado" en su historial.',
      confirmLabel: 'Eliminar', confirmKind: 'danger',
    });
    if (!ok) return;
    deleteTraining(delBtn.dataset.id);
    toast({ type: 'success', message: 'Entrenamiento eliminado.' });
    refreshTrainings();
  }
}

/* ===========================================================
   Categories
   =========================================================== */

function refreshCategories() {
  const wrap = $('#wkPanel');
  if (!wrap) return;
  const cats = listCategories();
  const trainings = listTrainings();

  if (!cats.length) {
    wrap.innerHTML = `
      <div class="empty">
        <div class="empty__icon"><i data-lucide="folder"></i></div>
        <div class="empty__title">Sin categorías</div>
        <div class="empty__text">Las categorías agrupan entrenamientos: "Tren superior", "Full body", "Cardio". No llevan ejercicios ni datos de ejecución.</div>
      </div>`;
    refreshIcons(wrap);
    return;
  }

  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Categoría</th><th>Entrenamientos</th><th>Observación</th><th></th></tr></thead>
        <tbody>
          ${cats.map((c) => {
            const owned = trainings.filter((t) => t.categoryId === c.id);
            return `
            <tr>
              <td>
                <span class="badge badge--${escapeHtml(c.color)}"><i data-lucide="folder"></i>${escapeHtml(c.name)}</span>
              </td>
              <td>
                <div class="row gap-2" style="flex-wrap:wrap">
                  ${owned.length
                    ? owned.map((t) => `<button class="btn btn--ghost btn--sm" data-act="jumpTraining" data-id="${t.id}">${escapeHtml(t.name)}</button>`).join('')
                    : '<span class="t-muted">Sin entrenamientos asignados</span>'}
                </div>
              </td>
              <td class="t-muted">${escapeHtml(c.observation || '—')}</td>
              <td class="row-actions">
                <button class="icon-btn" data-act="editCat" data-id="${c.id}" title="Editar"><i data-lucide="pencil"></i></button>
                <button class="icon-btn" data-act="delCat" data-id="${c.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="t-muted" style="font-size:var(--fs-sm);margin-top:var(--sp-3)">
      Los entrenamientos sin categoría se agrupan bajo "${escapeHtml(NO_CATEGORY_LABEL)}". Eliminar una categoría nunca borra entrenamientos: sólo los deja sin categoría.
    </p>`;
  refreshIcons(wrap);
  if (wrap.__gtClick) wrap.removeEventListener('click', wrap.__gtClick);
  wrap.__gtClick = onCategoryClick;
  wrap.addEventListener('click', wrap.__gtClick);
}

async function onCategoryClick(e) {
  const editBtn = e.target.closest('[data-act="editCat"]');
  const delBtn = e.target.closest('[data-act="delCat"]');
  const jumpBtn = e.target.closest('[data-act="jumpTraining"]');
  if (editBtn) openCategoryForm(findCategory(editBtn.dataset.id), refreshCategories);
  if (jumpBtn) {
    openTrainingForm(findTraining(jumpBtn.dataset.id), () => {});
  }
  if (delBtn) {
    const affected = listTrainings().filter((t) => t.categoryId === delBtn.dataset.id).length;
    const ok = await confirmDialog({
      title: 'Eliminar categoría',
      message: affected
        ? `Esta categoría tiene ${affected} entrenamiento(s) asignado(s). No se borran: quedarán como "${NO_CATEGORY_LABEL}". ¿Eliminar la categoría?`
        : '¿Eliminar esta categoría?',
      confirmLabel: 'Eliminar', confirmKind: 'danger',
    });
    if (!ok) return;
    deleteCategory(delBtn.dataset.id);
    toast({ type: 'success', message: 'Categoría eliminada.' });
    refreshCategories();
  }
}

function openCategoryForm(existing, onSaved) {
  const c = existing || { name: '', observation: '', color: BADGE_TONES[0], status: 'active' };
  const dialog = el('div');
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-8"><label class="field__label">Nombre *</label>
        <input class="input" id="catName" value="${escapeHtml(c.name)}" placeholder="Ej: Tren superior" /></div>
      <div class="field col-4"><label class="field__label">Estado</label>
        <select class="select" id="catStatus">
          <option value="active" ${c.status === 'active' ? 'selected' : ''}>Activa</option>
          <option value="archived" ${c.status === 'archived' ? 'selected' : ''}>Archivada</option>
        </select></div>
      <div class="field col-12"><label class="field__label">Color</label>
        <div class="row gap-2" style="flex-wrap:wrap" id="catColors">
          ${BADGE_TONES.map((tone) => `
            <label class="row gap-1" style="padding:6px 10px;border-radius:var(--r-pill);border:1px solid var(--c-border-soft);cursor:pointer;background:${c.color === tone ? 'rgba(244,198,98,0.10)' : 'transparent'}">
              <input type="radio" name="catColor" value="${tone}" ${c.color === tone ? 'checked' : ''} />
              <span class="badge badge--${tone}">${tone}</span>
            </label>`).join('')}
        </div></div>
      <div class="field col-12"><label class="field__label">Observación</label>
        <textarea class="textarea" id="catObs" rows="2" placeholder="Ej: Rutinas de empuje y tirón">${escapeHtml(c.observation || '')}</textarea></div>
    </div>`;
  openModal({
    title: existing ? 'Editar categoría' : 'Nueva categoría',
    size: 'md',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const name = $('#catName').value.trim();
          if (!name) { toastError('El nombre es obligatorio.'); return false; }
          const checked = $('#catColors').querySelector('input[name="catColor"]:checked');
          const data = {
            name,
            observation: $('#catObs').value.trim(),
            color: checked ? checked.value : BADGE_TONES[0],
            status: $('#catStatus').value,
          };
          if (existing) updateCategory(existing.id, data);
          else createCategory(data);
          toast({ type: 'success', message: existing ? 'Categoría actualizada.' : 'Categoría creada.' });
          onSaved && onSaved();
        },
      },
    ],
  });

  $('#catColors').addEventListener('change', (ev) => {
    const radio = ev.target.closest('input[name="catColor"]');
    if (!radio) return;
    $$('#catColors label').forEach((l) => {
      const input = l.querySelector('input');
      l.style.background = input && input.checked ? 'rgba(244,198,98,0.10)' : 'transparent';
    });
  });
  refreshIcons(dialog);
}

/* ===========================================================
   Exercises (catalog)
   =========================================================== */

function refreshExercises() {
  const wrap = $('#wkPanel');
  if (!wrap) return;
  const ex = listExercises();
  if (!ex.length) {
    wrap.innerHTML = `
      <div class="empty">
        <div class="empty__icon"><i data-lucide="library"></i></div>
        <div class="empty__title">Sin ejercicios en el catálogo</div>
        <div class="empty__text">Comienza creando ejercicios reutilizables: nombre, observación y grupos musculares.</div>
      </div>`;
    refreshIcons(wrap);
    return;
  }
  wrap.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Nombre</th><th>Grupos musculares</th><th>Observación</th><th></th></tr></thead>
        <tbody>
          ${ex.map((e) => `
            <tr>
              <td><strong>${escapeHtml(e.name)}</strong></td>
              <td><div class="row gap-2" style="flex-wrap:wrap">${(e.muscleGroups || []).map((g) => {
                const def = MUSCLE_GROUP_BY_VALUE[g];
                return def ? `<span class="badge badge--${def.color}">${escapeHtml(def.label)}</span>` : '';
              }).join('') || '<span class="t-muted">—</span>'}</div></td>
              <td class="t-muted">${escapeHtml(e.observation || '—')}</td>
              <td class="row-actions">
                <button class="icon-btn" data-act="editEx" data-id="${e.id}" title="Editar"><i data-lucide="pencil"></i></button>
                <button class="icon-btn" data-act="delEx" data-id="${e.id}" title="Eliminar"><i data-lucide="trash-2"></i></button>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  refreshIcons(wrap);
  if (wrap.__gtClick) wrap.removeEventListener('click', wrap.__gtClick);
  wrap.__gtClick = onExerciseClick;
  wrap.addEventListener('click', wrap.__gtClick);
}

async function onExerciseClick(e) {
  const editBtn = e.target.closest('[data-act="editEx"]');
  const delBtn = e.target.closest('[data-act="delEx"]');
  if (editBtn) {
    const ex = (getStateExercises()).find((x) => x.id === editBtn.dataset.id);
    openExerciseForm(ex, refreshExercises);
  }
  if (delBtn) {
    const ok = await confirmDialog({
      title: 'Eliminar ejercicio del catálogo',
      message: 'Las asistencias ya registradas conservarán su historial (nombre y grupos musculares como snapshot). ¿Eliminar este ejercicio?',
      confirmLabel: 'Eliminar', confirmKind: 'danger',
    });
    if (!ok) return;
    deleteExercise(delBtn.dataset.id);
    toast({ type: 'success', message: 'Ejercicio archivado.' });
    refreshExercises();
  }
}

function getStateExercises() {
  return listExercises({ includeArchived: true });
}

/* ===========================================================
   Forms
   =========================================================== */

function openTrainingForm(existing, onSaved) {
  const t = existing || { name: '', objective: '', observation: '', categoryId: null, exerciseIds: [], status: 'active' };
  const dialog = el('div');
  const allExercises = listExercises();
  const byId = new Map(allExercises.map((e) => [e.id, e]));
  const categories = listCategories();
  // `ordered` IS the training: its index is the exercise order. Keeping it as
  // the single source of truth is what stops an edit from reshuffling the plan.
  let ordered = (t.exerciseIds || []).filter((id) => byId.has(id));

  function badges(groups) {
    return (groups || []).map((g) => {
      const def = MUSCLE_GROUP_BY_VALUE[g];
      return def ? `<span class="badge badge--${def.color}">${escapeHtml(def.label)}</span>` : '';
    }).join('');
  }

  function selectedRow(id, idx) {
    const e = byId.get(id);
    return `
      <div class="row gap-2" style="padding:6px 8px;border-radius:var(--r-sm);background:rgba(244,198,98,0.08)">
        <span class="t-muted t-mono" style="width:18px;text-align:right">${idx + 1}</span>
        <input type="checkbox" data-pick="${id}" checked title="Quitar del entrenamiento" />
        <span style="flex:1">${escapeHtml(e.name)}</span>
        <span class="row gap-1" style="flex-wrap:wrap">${badges(e.muscleGroups)}</span>
        <button class="icon-btn" type="button" data-move="up" data-id="${id}" title="Subir"><i data-lucide="arrow-up"></i></button>
        <button class="icon-btn" type="button" data-move="down" data-id="${id}" title="Bajar"><i data-lucide="arrow-down"></i></button>
      </div>`;
  }

  function availableRow(e) {
    return `
      <label class="row gap-2" style="padding:6px 8px;border-radius:var(--r-sm);cursor:pointer">
        <input type="checkbox" data-pick="${e.id}" />
        <span style="flex:1">${escapeHtml(e.name)}</span>
        <span class="row gap-1" style="flex-wrap:wrap">${badges(e.muscleGroups)}</span>
      </label>`;
  }

  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-8"><label class="field__label">Nombre *</label>
        <input class="input" id="trnName" value="${escapeHtml(t.name)}" placeholder="Ej: Tren superior fuerza" /></div>
      <div class="field col-4"><label class="field__label">Estado</label>
        <select class="select" id="trnStatus">
          <option value="active" ${t.status === 'active' ? 'selected' : ''}>Activo</option>
          <option value="archived" ${t.status === 'archived' ? 'selected' : ''}>Archivado</option>
        </select></div>
      <div class="field col-6"><label class="field__label">Objetivo</label>
        <input class="input" id="trnObj" value="${escapeHtml(t.objective || '')}" placeholder="Hipertrofia, Resistencia…" /></div>
      <div class="field col-6"><label class="field__label">Observación del entrenamiento</label>
        <input class="input" id="trnObs" value="${escapeHtml(t.observation || '')}" placeholder="Ej: Calentamiento 10 min" /></div>
      <div class="field col-12"><label class="field__label">Categoría</label>
        <select class="select" id="trnCategory">
          <option value="">${escapeHtml(NO_CATEGORY_LABEL)}</option>
          ${categories.map((c) => `<option value="${c.id}"${t.categoryId === c.id ? ' selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
        <p class="field__hint">La categoría agrupa este entrenamiento en la lista y en el registro de asistencia. Se gestiona desde la pestaña "Categorías".</p></div>
      <div class="field col-12"><label class="field__label">Ejercicios (en orden)</label>
        <div class="search" style="margin-bottom:6px"><i data-lucide="search"></i><input class="input" id="trnSearch" placeholder="Buscar ejercicio…" /></div>
        <div id="trnPickList" class="stack-2" style="max-height:340px;overflow:auto;border:1px solid var(--c-border-soft);border-radius:var(--r-sm);padding:6px"></div>
        <p class="field__hint">Marca los ejercicios que componen este entrenamiento. El número es el orden en que se ejecutan; usa ↑ ↓ para moverlos. Este orden se guarda tal cual.</p>
      </div>
    </div>
  `;

  function renderPickList(term) {
    const filter = (term || '').toLowerCase();
    const match = (e) => !filter || e.name.toLowerCase().includes(filter);
    const chosen = ordered.map((id) => byId.get(id)).filter(match);
    const rest = allExercises.filter((e) => !ordered.includes(e.id) && match(e));
    const list = $('#trnPickList');

    if (!chosen.length && !rest.length) {
      list.innerHTML = allExercises.length
        ? '<div class="t-muted" style="padding:8px">Ningún ejercicio coincide con la búsqueda.</div>'
        : '<div class="t-muted" style="padding:8px">El catálogo está vacío. Crea ejercicios desde la pestaña "Catálogo de ejercicios".</div>';
      refreshIcons(list);
      return;
    }

    list.innerHTML = `
      ${chosen.length ? `<div class="t-muted" style="font-size:var(--fs-xs);padding:2px 8px 4px;text-transform:uppercase;letter-spacing:0.06em">En este entrenamiento (${chosen.length})</div>` : ''}
      ${chosen.map((e, i) => selectedRow(e.id, i)).join('')}
      ${rest.length ? `<div class="t-muted" style="font-size:var(--fs-xs);padding:8px 8px 4px;text-transform:uppercase;letter-spacing:0.06em">Disponibles (${rest.length})</div>` : ''}
      ${rest.map(availableRow).join('')}`;
    refreshIcons(list);
  }

  openModal({
    title: existing ? 'Editar entrenamiento' : 'Nuevo entrenamiento',
    size: 'lg',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const name = $('#trnName').value.trim();
          if (!name) { toastError('El nombre es obligatorio.'); return false; }
          const data = {
            name,
            objective: $('#trnObj').value.trim(),
            observation: $('#trnObs').value.trim(),
            categoryId: $('#trnCategory').value || null,
            exerciseIds: ordered,
            status: $('#trnStatus').value,
          };
          if (existing) updateTraining(existing.id, data);
          else createTraining(data);
          toast({ type: 'success', message: existing ? 'Entrenamiento actualizado.' : 'Entrenamiento creado.' });
          onSaved && onSaved();
        },
      },
    ],
  });

  renderPickList('');
  refreshIcons(dialog);

  // One delegated handler for the whole list: membership + ordering.
  $('#trnPickList').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[type="checkbox"][data-pick]');
    if (!cb) return;
    const id = cb.dataset.pick;
    if (cb.checked) {
      if (!ordered.includes(id)) ordered.push(id);
    } else {
      ordered = ordered.filter((x) => x !== id);
    }
    renderPickList($('#trnSearch').value);
  });

  $('#trnPickList').addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-move]');
    if (!btn) return;
    ev.preventDefault();
    const i = ordered.indexOf(btn.dataset.id);
    if (i < 0) return;
    const j = btn.dataset.move === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= ordered.length) return;
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
    renderPickList($('#trnSearch').value);
  });

  $('#trnSearch').addEventListener('input', (ev) => renderPickList(ev.target.value));
}

function openExerciseForm(existing, onSaved) {
  const ex = existing || { name: '', observation: '', muscleGroups: [], status: 'active' };
  const dialog = el('div');
  const selected = new Set(ex.muscleGroups || []);
  dialog.innerHTML = `
    <div class="form-grid">
      <div class="field col-8"><label class="field__label">Nombre *</label>
        <input class="input" id="exName" value="${escapeHtml(ex.name)}" placeholder="Ej: Press banca" /></div>
      <div class="field col-4"><label class="field__label">Estado</label>
        <select class="select" id="exStatus">
          <option value="active" ${ex.status === 'active' ? 'selected' : ''}>Activo</option>
          <option value="archived" ${ex.status === 'archived' ? 'selected' : ''}>Archivado</option>
        </select></div>
      <div class="field col-12"><label class="field__label">Grupos musculares (uno o varios)</label>
        <div class="row gap-2" style="flex-wrap:wrap" id="exGroups">
          ${MUSCLE_GROUPS.map((g) => `
            <label class="row gap-1" style="padding:6px 10px;border-radius:var(--r-pill);border:1px solid var(--c-border-soft);cursor:pointer;background:${selected.has(g.value) ? 'rgba(244,198,98,0.10)' : 'transparent'}">
              <input type="checkbox" data-g="${g.value}" ${selected.has(g.value) ? 'checked' : ''} />
              <span class="badge badge--${g.color}">${escapeHtml(g.label)}</span>
            </label>
          `).join('')}
        </div>
      </div>
      <div class="field col-12"><label class="field__label">Observación (técnica)</label>
        <textarea class="textarea" id="exObs" rows="3" placeholder="Ej: espalda apoyada al banco, pies firmes, sin valgo dinámico.">${escapeHtml(ex.observation || '')}</textarea></div>
    </div>
  `;
  openModal({
    title: existing ? 'Editar ejercicio' : 'Nuevo ejercicio',
    size: 'md',
    body: dialog,
    actions: [
      { label: 'Cancelar', kind: 'ghost' },
      {
        label: 'Guardar', kind: 'primary',
        onClick: () => {
          const name = $('#exName').value.trim();
          if (!name) { toastError('El nombre es obligatorio.'); return false; }
          if (selected.size === 0) { toastError('Selecciona al menos un grupo muscular.'); return false; }
          const data = {
            name,
            observation: $('#exObs').value.trim(),
            muscleGroups: [...selected],
            status: $('#exStatus').value,
          };
          if (existing) updateExercise(existing.id, data);
          else createExercise(data);
          toast({ type: 'success', message: existing ? 'Ejercicio actualizado.' : 'Ejercicio creado.' });
          onSaved && onSaved();
        },
      },
    ],
  });

  $('#exGroups').addEventListener('change', (ev) => {
    const cb = ev.target.closest('input[type="checkbox"][data-g]');
    if (!cb) return;
    if (cb.checked) selected.add(cb.dataset.g); else selected.delete(cb.dataset.g);
    const lbl = cb.closest('label');
    if (lbl) lbl.style.background = cb.checked ? 'rgba(244,198,98,0.10)' : 'transparent';
  });
  refreshIcons(dialog);
}
