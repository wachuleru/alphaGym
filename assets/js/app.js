/* ===========================================================
   GymTrack — entry point
   Bootstraps: storage, router, navigation, sidebar, save status
   =========================================================== */

import { $, $$ } from './utils.js';
import { startRouter, route, navigate, onNavigate, currentRoute } from './router.js';
import { load as loadStorage, getSaveStatus, subscribe } from './storage.js';
import { initIcons, refreshIcons } from './icons.js';
import { destroyAll as destroyAllCharts } from './charts.js';

// Load storage on boot (also seeds if empty)
loadStorage();

// Sidebar toggle
function setupSidebar() {
  const sidebar = $('#sidebar');
  const backdrop = $('#sidebarBackdrop');
  const toggle = () => sidebar.classList.toggle('is-open') & backdrop.classList.toggle('is-open');
  $('#sidebarToggle')?.addEventListener('click', toggle);
  $('#sidebarClose')?.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  });
  backdrop?.addEventListener('click', () => {
    sidebar.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  });
  // Quick search button → focuses students search when relevant (not wired for now)
  $('#quickSearchBtn')?.addEventListener('click', () => {
    if (currentRoute().path.startsWith('/students')) {
      const input = $('#studentsSearch');
      if (input) input.focus();
    } else {
      navigate('/students');
      setTimeout(() => $('#studentsSearch')?.focus(), 100);
    }
  });
}

function bindGlobalKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const mc = $('#modalContainer');
      if (mc?.classList.contains('is-open')) {
        const btn = mc.querySelector('.modal .modal__head .icon-btn');
        btn?.click();
      }
    }
    // Cmd/Ctrl + K → focus students search
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      if (currentRoute().path.startsWith('/students')) $('#studentsSearch')?.focus();
      else navigate('/students');
    }
  });
}

function setupSaveIndicator() {
  const ind = $('#saveIndicator');
  const label = ind?.querySelector('.save-indicator__label');
  if (!ind || !label) return;
  const update = () => {
    const s = getSaveStatus();
    ind.classList.remove('is-saving', 'is-error');
    if (s.status === 'saving') {
      ind.classList.add('is-saving');
      label.textContent = 'Guardando…';
    } else if (s.status === 'error') {
      ind.classList.add('is-error');
      label.textContent = 'Error al guardar';
    } else {
      label.textContent = 'Datos guardados localmente';
    }
  };
  update();
  subscribe(() => update());
}

function setupWorkspaceTitle() {
  onNavigate((rt) => {
    const seg = rt.params.segments[0] || 'dashboard';
    document.title = ({
      dashboard:     'Dashboard',
      students:      'Alumnos',
      attendance:    'Asistencia',
      workouts:      'Entrenamientos',
      progress:      'Progreso físico',
      payments:      'Pagos',
      reports:       'Informes',
      settings:      'Datos y configuración',
    })[seg] || 'GymTrack';
    document.title = `GymTrack · ${document.title}`;
  });
}

/* ===========================================================
   Routes registration
   =========================================================== */

// Lazy-load views so each route only pulls what it needs.
async function loadView(name) {
  switch (name) {
    case 'dashboard':
      return (await import('./views/dashboard.js')).renderDashboard;
    case 'students':
      return (await import('./views/students.js')).renderStudentsList;
    case 'student-detail':
      return (await import('./views/student-detail.js')).renderStudentDetail;
    case 'attendance':
      return (await import('./views/attendance.js')).renderAttendance;
    case 'workouts':
      return (await import('./views/workouts.js')).renderWorkouts;
    case 'progress':
      return (await import('./views/progress.js')).renderProgress;
    case 'payments':
      return (await import('./views/payments.js')).renderPayments;
    case 'reports':
      return (await import('./views/reports.js')).renderReports;
    case 'settings':
      return (await import('./views/settings.js')).renderSettings;
    default:
      return (await import('./views/dashboard.js')).renderDashboard;
  }
}

route('/dashboard', async (params) => {
  const fn = await loadView('dashboard');
  await fn(params);
  refreshIcons($('#main'));
});

route('/students', async (params) => {
  const fn = await loadView('students');
  await fn(params);
  refreshIcons($('#main'));
});

route('/students/:id', async (params) => {
  const fn = await loadView('student-detail');
  await fn(params);
  refreshIcons($('#main'));
});

route('/students/:id/:tab', async (params) => {
  const fn = await loadView('student-detail');
  await fn(params);
  refreshIcons($('#main'));
});

route('/attendance', async (params) => {
  const fn = await loadView('attendance');
  await fn(params);
  refreshIcons($('#main'));
});

route('/workouts', async (params) => {
  const fn = await loadView('workouts');
  await fn(params);
  refreshIcons($('#main'));
});

route('/progress', async (params) => {
  const fn = await loadView('progress');
  await fn(params);
  refreshIcons($('#main'));
});

route('/payments', async (params) => {
  const fn = await loadView('payments');
  await fn(params);
  refreshIcons($('#main'));
});

route('/reports', async (params) => {
  const fn = await loadView('reports');
  await fn(params);
  refreshIcons($('#main'));
});

route('/settings', async (params) => {
  const fn = await loadView('settings');
  await fn(params);
  refreshIcons($('#main'));
});

/* ===========================================================
   Boot
   =========================================================== */

setupSidebar();
setupSaveIndicator();
bindGlobalKeyboard();
setupWorkspaceTitle();
initIcons();
startRouter();

// Destroy any chart instances before navigation (in case views don't clean up)
onNavigate(() => destroyAllCharts());

// Helpful diagnostic in console
console.info(`%c GymTrack %c v${(window.__gt && window.__gt.version) || '1.0.0'} `,
  'background:#f4c662;color:#0a1124;padding:2px 6px;border-radius:3px 0 0 3px;font-weight:700',
  'background:#0a1124;color:#f4c662;padding:2px 6px;border-radius:0 3px 3px 0');
