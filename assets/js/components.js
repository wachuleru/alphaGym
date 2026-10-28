/* ===========================================================
   ALPHA-FIT — toasts, modals, dialogs (UI feedback primitives)
   =========================================================== */

import { $, el } from './utils.js';
import { refreshIcons } from './icons.js';

/* ---------- Toasts ---------- */

const TOAST_ICON = {
  success: 'check-circle-2',
  info: 'info',
  warning: 'alert-triangle',
  error: 'alert-octagon',
};
const TOAST_TIMEOUT = {
  success: 3200,
  info: 3500,
  warning: 4500,
  error: 5000,
};

let toastIdCounter = 0;

export function toast(opts) {
  const { type = 'info', title = '', message = '', timeout } = opts || {};
  const container = $('#toastContainer');
  if (!container) return;
  const id = ++toastIdCounter;
  const node = el('div', {
    class: `toast toast--${type}`,
    role: 'status',
    dataset: { toastId: String(id) },
    html: `
      <i data-lucide="${TOAST_ICON[type] || 'info'}"></i>
      <div>
        ${title ? `<div class="toast__title"></div>` : ''}
        ${message ? `<div class="toast__msg"></div>` : ''}
      </div>
    `,
  });
  // Safely set text
  const inner = node.querySelectorAll('div > div');
  if (title && inner[0]) inner[0].textContent = title;
  if (message && inner[1]) inner[1].textContent = message;
  container.appendChild(node);
  refreshIcons(node);
  const ms = timeout ?? TOAST_TIMEOUT[type] ?? 3500;
  setTimeout(() => dismiss(id), ms);
  return id;
}

export function dismiss(id) {
  const node = $(`[data-toast-id="${id}"]`);
  if (!node) return;
  node.classList.add('is-leaving');
  setTimeout(() => node.remove(), 220);
}

export const toastSuccess = (msg, title = 'Listo')   => toast({ type: 'success', message: msg, title });
export const toastInfo    = (msg, title = 'Información') => toast({ type: 'info',    message: msg, title });
export const toastWarn    = (msg, title = 'Atención')    => toast({ type: 'warning', message: msg, title });
export const toastError   = (msg, title = 'Error')       => toast({ type: 'error',   message: msg, title });

/* ---------- Modal ---------- */

let modalStack = [];

export function openModal(opts) {
  const {
    title = '',
    body = '',
    size = 'md',           // 'sm' | 'md' | 'lg' | 'xl'
    actions = [],          // [{ label, kind?, onClick?, closeOnClick? }]
    closable = true,
    onClose,
    contentClass = '',
  } = opts || {};

  const container = $('#modalContainer');
  container.innerHTML = '';

  const sizeClass = size === 'sm' ? '' : `modal--${size}`;

  const dialog = el('div', {
    class: `modal ${sizeClass} ${contentClass}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': title,
    tabindex: -1,
  });

  const head = el('header', { class: 'modal__head' }, [
    el('h3', { class: 'modal__title' }, title),
    closable && el('button', {
      class: 'icon-btn',
      'aria-label': 'Cerrar',
      html: '<i data-lucide="x"></i>',
      onclick: () => closeModal(),
    }),
  ].filter(Boolean));
  dialog.appendChild(head);

  const bodyNode = el('div', { class: 'modal__body' });
  if (typeof body === 'string') bodyNode.innerHTML = body;
  else if (body instanceof Node) bodyNode.appendChild(body);
  dialog.appendChild(bodyNode);

  if (actions.length) {
    const foot = el('footer', { class: 'modal__foot' });
    for (const a of actions) {
      const btn = el('button', {
        class: `btn ${a.kind ? 'btn--' + a.kind : 'btn--ghost'}`,
        type: 'button',
        onclick: async (e) => {
          if (a.onClick) {
            try {
              const r = await a.onClick(e, dialog);
              if (r === false) return;
            } catch (err) {
              console.error(err);
              toastError(err.message || 'Error en la acción.');
              return;
            }
          }
          if (a.closeOnClick !== false) closeModal();
        },
      }, a.label);
      foot.appendChild(btn);
    }
    dialog.appendChild(foot);
  }

  const backdrop = el('div', { class: 'modal-backdrop', onclick: () => closable && closeModal() });
  container.appendChild(backdrop);
  container.appendChild(dialog);
  container.setAttribute('aria-hidden', 'false');
  container.classList.add('is-open');

  refreshIcons(dialog);

  // Trap focus
  dialog.focus();

  modalStack.push({ dialog, onClose });
}

export function closeModal() {
  const last = modalStack.pop();
  const container = $('#modalContainer');
  if (!container) return;
  container.classList.remove('is-open');
  container.innerHTML = '';
  container.setAttribute('aria-hidden', 'true');
  if (last && last.onClose) last.onClose();
}

/** Convenience confirm dialog */
export function confirmDialog({
  title = '¿Confirmar?',
  message = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmKind = 'danger',
}) {
  return new Promise((resolve) => {
    openModal({
      title,
      contentClass: 'modal--confirm',
      body: el('div', { html: `<p>${escape(message)}</p>` }),
      actions: [
        { label: cancelLabel, kind: 'ghost', onClick: () => resolve(false), closeOnClick: true },
        { label: confirmLabel, kind: confirmKind, onClick: () => resolve(true), closeOnClick: true },
      ],
    });
  });
}

function escape(s) {
  return String(s || '').replace(/[<>&"']/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
}
