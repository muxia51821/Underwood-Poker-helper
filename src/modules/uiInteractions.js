const focusable = 'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
const visibleControls = root => [...root.querySelectorAll(focusable)].filter(el => el.checkVisibility() && !el.closest('[inert]'));
const tasks = new WeakMap();

export function bindDropdown(trigger, menu) {
  if (!trigger || !menu || trigger.dataset.dropdownBound) return;
  trigger.dataset.dropdownBound = 'true';
  trigger.setAttribute('aria-controls', menu.id);
  trigger.setAttribute('aria-expanded', 'false');
  menu.inert = !menu.classList.contains('is-visible');
  const close = (restore = false) => {
    menu.classList.remove('is-visible');
    menu.inert = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) trigger.focus();
  };
  const open = () => { menu.inert = false; menu.classList.add('is-visible'); trigger.setAttribute('aria-expanded', 'true'); };
  trigger.addEventListener('click', event => {
    event.stopPropagation();
    if (menu.classList.contains('is-visible')) close(); else open();
  });
  trigger.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault(); open();
    const controls = visibleControls(menu);
    (event.key === 'ArrowDown' ? controls[0] : controls.at(-1))?.focus();
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const controls = visibleControls(menu);
    if (!controls.length) return;
    event.preventDefault();
    let index = controls.indexOf(document.activeElement);
    index = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
    controls[index].focus();
  });
  menu.addEventListener('click', event => { if (event.target.closest('[data-menu-dismiss]')) close(); });
  document.addEventListener('click', event => { if (!trigger.contains(event.target) && !menu.contains(event.target)) close(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && menu.classList.contains('is-visible') && document.activeElement === trigger) { close(true); event.preventDefault(); }
  });
  document.addEventListener('focusin', event => { if (!trigger.contains(event.target) && !menu.contains(event.target)) close(); });
  new MutationObserver(() => {
    const expanded = menu.classList.contains('is-visible');
    menu.inert = !expanded;
    trigger.setAttribute('aria-expanded', String(expanded));
  }).observe(menu, { attributes: true, attributeFilter: ['class'] });
}

// Keep existing feature-specific close handlers as the source of cleanup behavior.
export function initOverlayInteractions() {
  const overlays = ['shareOverlay', 'ggImportOverlay', 'statTooltip'].map(id => document.getElementById(id)).filter(Boolean);
  const opened = [];
  const app = document.querySelector('.app');
  let appWasInert = false;
  const sync = root => {
    const shown = root.id === 'statTooltip' ? root.style.display !== 'none' && root.checkVisibility() : root.classList.contains('is-active');
    const index = opened.findIndex(item => item.root === root);
    root.inert = !shown;
    root.setAttribute('aria-hidden', String(!shown));
    if (shown && index < 0) {
      const returnFocus = document.activeElement;
      if (!opened.length && app) { appWasInert = app.inert; app.inert = true; }
      opened.push({ root, returnFocus });
      root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
      root.tabIndex = -1;
      const title = root.querySelector('h2,h3,[data-dialog-title]');
      if (title) { if (!title.id) title.id = root.id + 'Title'; root.setAttribute('aria-labelledby', title.id); }
      else root.setAttribute('aria-label', root.id === 'statTooltip' ? '统计指标说明' : root.id === 'ggImportOverlay' ? '导入 GG 手牌' : '分享网站');
      const initial = root.querySelector(root.id === 'ggImportOverlay' ? '#ggImportText' : root.id === 'statTooltip' ? '#statTooltipClose' : '#shareCopyBtn');
      (initial || visibleControls(root)[0] || root).focus({ preventScroll: true });
    } else if (!shown && index >= 0) {
      const [item] = opened.splice(index, 1);
      root.removeAttribute('aria-modal');
      if (!opened.length && app) app.inert = appWasInert;
      const fallback = item.returnFocus?.closest('#settingsMenu') ? document.getElementById('settingsBtn') : document.querySelector('.nav__btn--active');
      const target = opened.at(-1)?.root || (item.returnFocus?.isConnected && item.returnFocus.checkVisibility() && !item.returnFocus.closest('[inert]') ? item.returnFocus : fallback);
      target?.focus({ preventScroll: true });
    }
    document.body.classList.toggle('ui-modal-open', opened.length > 0);
  };
  for (const root of overlays) {
    new MutationObserver(() => sync(root)).observe(root, { attributes: true, attributeFilter: ['class', 'style'] });
    sync(root);
  }
  document.addEventListener('keydown', event => {
    const root = opened.at(-1)?.root;
    if (!root || document.querySelector('dialog[open]')) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (root.getAttribute('aria-busy') === 'true') return;
      if (root.id === 'statTooltip') document.getElementById('statTooltipClose')?.click(); else root.click();
    }
    if (event.key === 'Tab') {
      const controls = visibleControls(root), first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); root.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    }
  }, true);
}

export function confirmAction({ title = '确认操作', message, confirmLabel = '确认', danger = false }) {
  // A second destructive request cannot replace the question currently being answered.
  if (document.getElementById('actionConfirmDialog')) return Promise.resolve(false);
  return new Promise(resolve => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.id = 'actionConfirmDialog'; dialog.className = 'action-dialog';
    dialog.setAttribute('aria-labelledby', 'actionConfirmTitle');
    dialog.setAttribute('aria-describedby', 'actionConfirmMessage');
    const heading = document.createElement('h2'); heading.id = 'actionConfirmTitle'; heading.textContent = title;
    const description = document.createElement('p'); description.id = 'actionConfirmMessage'; description.textContent = message;
    const actions = document.createElement('div'); actions.className = 'action-dialog__actions';
    const cancel = document.createElement('button'); cancel.className = 'ws-button'; cancel.textContent = '取消'; cancel.autofocus = true;
    const confirm = document.createElement('button'); confirm.className = danger ? 'ws-button ui-danger' : 'ws-button ws-button--primary'; confirm.textContent = confirmLabel;
    actions.append(cancel, confirm); dialog.append(heading, description, actions); document.body.append(dialog);
    let confirmed = false;
    cancel.addEventListener('click', () => dialog.close());
    confirm.addEventListener('click', () => { confirmed = true; dialog.close(); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
    dialog.addEventListener('close', () => {
      dialog.remove();
      if (previousFocus?.isConnected && previousFocus.checkVisibility() && !previousFocus.closest('[inert]')) previousFocus.focus({ preventScroll: true });
      resolve(confirmed);
    }, { once: true });
    dialog.showModal(); cancel.focus();
  });
}

export function withBusy(button, label, operation, scope = button) {
  if (button && tasks.has(button)) return tasks.get(button);
  const controls = scope ? [...new Set([scope, ...scope.querySelectorAll('button,input,textarea,select')])].filter(el => 'disabled' in el) : [];
  const states = controls.map(el => [el, el.disabled]);
  const text = button?.textContent, previousBusy = scope?.getAttribute('aria-busy');
  states.forEach(([el]) => { el.disabled = true; });
  scope?.setAttribute('aria-busy', 'true');
  if (button) { button.textContent = label; button.setAttribute('aria-busy', 'true'); }
  // Yield without depending on animation frames, which pause in background tabs.
  const promise = new Promise(resolve => setTimeout(resolve, 0)).then(operation).finally(() => {
    states.forEach(([el, disabled]) => { el.disabled = disabled; });
    if (button) { button.textContent = text; button.removeAttribute('aria-busy'); tasks.delete(button); }
    if (scope) { if (previousBusy === null) scope.removeAttribute('aria-busy'); else scope.setAttribute('aria-busy', previousBusy); }
  });
  if (button) tasks.set(button, promise);
  return promise;
}
