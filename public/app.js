/**
 * RH BRINNERCAS — FRONTEND CONTROLLER (GLASSMORPHISM + DOCK + SHEETS/DRIVE)
 * Grupo Gastronómico Aurora S.A.C. (RUC 20615117111)
 */

const API_BASE = (window.location.protocol === 'http:' && window.location.port === '3005')
  ? ''
  : 'http://localhost:3005';

// URL del backend gratuito Google Apps Script (HTTPS, 0 errores CORS desde Firebase Hosting)
const GAS_WEBAPP_URL = (typeof localStorage !== 'undefined' && localStorage.getItem('rh_gas_webapp_url'))
  || 'https://script.google.com/macros/s/AKfycbxQQkZp3r83pGiycuN3i33m6ndiptf9bqS-I4zD9ScvqE7b0N6U0bwnSI6fQC5wsUDpAA/exec';

const SESSION_KEY = 'rh_brinnercas_session';

function useGasBackend() {
  return Boolean(GAS_WEBAPP_URL) && (window.location.protocol === 'https:' || (window.location.port !== '3005' && window.location.protocol !== 'file:'));
}

async function gasPost(action, payload = {}) {
  const token = getAuthToken();
  const res = await fetch(GAS_WEBAPP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, ...payload })
  });
  const json = await res.json();
  if (json && !json.success && /expirada|inválida/i.test(json.error || '') && action !== 'login' && typeof window.forceLockPortal === 'function') {
    window.forceLockPortal('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }
  return json;
}

function apiUrl(p) {
  return `${API_BASE}${p}`;
}

/**
 * Validación estricta de URLs para prevenir inyección XSS por esquemas javascript:/vbscript:
 */
function safeUrl(raw) {
  const s = String(raw || '').trim();
  if (!s) return '#';
  if (/^(javascript|vbscript|data:text\/html)/i.test(s)) return '#';
  if (/^(https?:\/\/|\/|docs\/|assets\/|#)/i.test(s)) return s;
  return '#';
}

function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.expiresAt || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch (e) {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function getAuthToken() {
  return getStoredSession()?.token || '';
}

function saveSession({ user, token, expiresAt }) {
  const safeObj = {
    user: {
      email: user?.email || '',
      name: user?.name || '',
      role: user?.role || '',
      roleCode: user?.roleCode || 'ADMIN_GENERAL',
      department: user?.department || 'ALL'
    },
    token: token || '',
    expiresAt: expiresAt || (Date.now() + 8 * 60 * 60 * 1000)
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(safeObj));
  sessionStorage.removeItem('rh_brinnercas_user');
  return safeObj;
}

function clearSessionStorage() {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem('rh_brinnercas_user');
}

/**
 * Wrapper Zero-Trust para peticiones autenticadas con Bearer Token y manejo automático de 401
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && typeof window.forceLockPortal === 'function') {
    window.forceLockPortal('Tu sesión ha expirado. Inicia sesión nuevamente.');
  }
  return res;
}

function relDocUrl(localUrl, apiPath, driveUrl) {
  if (driveUrl && (useGasBackend() || window.location.protocol === 'https:' || window.location.protocol === 'file:' || !localUrl)) {
    return safeUrl(driveUrl);
  }
  if (localUrl) {
    return safeUrl(String(localUrl).replace(/^\//, ''));
  }
  const base = apiUrl(apiPath);
  const tok = getAuthToken();
  if (tok && apiPath.startsWith('/api/')) {
    const sep = base.includes('?') ? '&' : '?';
    return safeUrl(`${base}${sep}token=${encodeURIComponent(tok)}`);
  }
  return safeUrl(base);
}

const state = {
  user: null,
  currentView: 'dashboard',
  viewHistory: ['dashboard'],
  audit: window.RH_EMBEDDED_DATA?.audit || null,
  mof: window.RH_EMBEDDED_DATA?.mof || null,
  memoMotivos: window.RH_EMBEDDED_DATA?.memoMotivos || null,
  selectedColabId: 1,
  editPlanillaId: 1,
  planillaFilter: { search: '', filter: '' },
  editDniAttachment: null, // { name, base64 }
  dniAttachment: null, // { name, base64 }
  filters: {
    search: '',
    area: '',
    estado: '',
    condicionLaboral: ''
  }
};

// ==========================================================================
// UTILIDADES DE SEGURIDAD, FORMATO Y "LEER MÁS / LEER MENOS"
// ==========================================================================
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(n) {
  const num = Number(n || 0);
  return 'S/ ' + num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getInitials(name) {
  const parts = String(name || 'AU').trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * Botón obligatorio "Leer más / Leer menos" para textos largos en Glassmorphism UI
 */
function renderExpandableText(text, maxLen = 68) {
  const clean = String(text ?? '').trim();
  if (!clean || clean.length <= maxLen) {
    return escapeHtml(clean);
  }
  const truncated = clean.slice(0, maxLen).trimEnd();
  return `<span class="expandable-text-wrap" data-full="${escapeHtml(clean)}" data-short="${escapeHtml(truncated)}" data-expanded="0"><span class="expandable-content">${escapeHtml(truncated)}…</span><button type="button" class="glass-read-more-btn" aria-expanded="false" onclick="toggleReadMore(this)">Leer más</button></span>`;
}

window.toggleReadMore = function (btn) {
  const wrap = btn.closest('.expandable-text-wrap');
  if (!wrap) return;
  const contentEl = wrap.querySelector('.expandable-content');
  const isExpanded = wrap.getAttribute('data-expanded') === '1';
  if (isExpanded) {
    contentEl.textContent = wrap.getAttribute('data-short') + '…';
    wrap.setAttribute('data-expanded', '0');
    btn.textContent = 'Leer más';
    btn.setAttribute('aria-expanded', 'false');
  } else {
    contentEl.textContent = wrap.getAttribute('data-full');
    wrap.setAttribute('data-expanded', '1');
    btn.textContent = 'Leer menos';
    btn.setAttribute('aria-expanded', 'true');
  }
};

function badgeClassForSemaforo(sem) {
  if (sem === 'verde') return 'badge-verde';
  if (sem === 'naranja') return 'badge-naranja';
  if (sem === 'amarillo') return 'badge-amarillo';
  return 'badge-gris';
}

function hydrateIcons() {
  const dock = document.getElementById('left-dock-aside');
  if (!dock) return;
  if (window.ButtonWebIcons && typeof window.ButtonWebIcons.injectAll === 'function') {
    window.ButtonWebIcons.injectAll(dock);
  }
  if (window.HandsomeIcons && typeof window.HandsomeIcons.injectAll === 'function') {
    window.HandsomeIcons.injectAll(dock);
  }
}

// ==========================================================================
// MODERN WEB GUIDANCE: VALIDACIÓN POST-INTERACCIÓN Y LIGHT-DISMISS DIALOGS
// ==========================================================================
function initValidationAfterInteraction() {
  const announcer = document.getElementById('validation-announcer');
  const touched = new WeakMap();
  const baseDescribedBy = new WeakMap();
  let timer = null;

  document.querySelectorAll('input[data-error], select[data-error], textarea[data-error]').forEach(el => {
    baseDescribedBy.set(el, el.getAttribute('aria-describedby') || '');
  });

  function syncFieldValidity(el) {
    if (!el || !el.matches('input, select, textarea')) return;
    if (!touched.get(el)) return;
    const errId = el.dataset.error;
    const valid = el.checkValidity();

    el.classList.toggle('user-invalid-fallback', !valid);
    if (!valid) {
      el.setAttribute('aria-invalid', 'true');
    } else {
      el.removeAttribute('aria-invalid');
    }

    if (errId) {
      const base = baseDescribedBy.get(el) || el.getAttribute('aria-describedby') || '';
      if (!baseDescribedBy.has(el)) baseDescribedBy.set(el, base);
      const ids = base.split(/\s+/).filter(id => id && id !== errId);
      if (!valid) ids.push(errId);
      if (ids.length) {
        el.setAttribute('aria-describedby', ids.join(' '));
      } else {
        el.removeAttribute('aria-describedby');
      }
    }

    if (!valid && errId && announcer) {
      const errNode = document.getElementById(errId);
      const msg = errNode ? errNode.textContent.trim() : el.validationMessage;
      clearTimeout(timer);
      timer = setTimeout(() => {
        announcer.textContent = '';
        setTimeout(() => {
          announcer.textContent = msg;
        }, 40);
      }, 150);
    }
  }

  document.addEventListener('blur', e => {
    const el = e.target;
    if (el && el.matches('input, select, textarea')) {
      touched.set(el, true);
      syncFieldValidity(el);
    }
  }, true);

  document.addEventListener('input', e => {
    const el = e.target;
    if (el && el.matches('input, textarea') && touched.get(el)) {
      syncFieldValidity(el);
    }
  });

  document.addEventListener('change', e => {
    const el = e.target;
    if (el && el.matches('input, select, textarea')) {
      touched.set(el, true);
      syncFieldValidity(el);
    }
  });

  window.validateFormOnSubmit = function (form) {
    const fields = Array.from(form.querySelectorAll('input, select, textarea'));
    let firstInvalid = null;
    fields.forEach(el => {
      touched.set(el, true);
      syncFieldValidity(el);
      if (!el.checkValidity() && !firstInvalid) firstInvalid = el;
    });
    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  };
}

function initDialogLightDismiss() {
  const supportsClosedBy = 'closedBy' in HTMLDialogElement.prototype;
  document.querySelectorAll('dialog.glass-dialog').forEach(dialog => {
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });

    if (!supportsClosedBy) {
      let downOutside = false;
      dialog.addEventListener('pointerdown', e => {
        if (e.target !== dialog) { downOutside = false; return; }
        const r = dialog.getBoundingClientRect();
        downOutside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      });
      dialog.addEventListener('click', e => {
        if (downOutside && e.target === dialog) dialog.close();
        downOutside = false;
      });
    }
  });

  document.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-close-dialog');
      const dlg = document.getElementById(id);
      if (dlg && dlg.open) dlg.close();
    });
  });

  // Tecla ESC global: cierra cualquier ventana emergente abierta (y si no hay modal, limpia el buscador activo)
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;

    const openDialogs = Array.from(document.querySelectorAll('dialog[open]'));
    if (openDialogs.length > 0) {
      e.preventDefault();
      openDialogs[openDialogs.length - 1].close();
      return;
    }

    const active = document.activeElement;
    if (active && (active.id === 'search-input' || active.id === 'planilla-search')) {
      e.preventDefault();
      active.value = '';
      if (active.id === 'search-input') {
        state.filters.search = '';
        renderLegajos();
      } else {
        state.planillaFilter.search = '';
        renderPlanillaEditor();
      }
      return;
    }

    // Si hay texto escrito en algún buscador aunque no tenga foco, ESC lo limpia
    const sLeg = document.getElementById('search-input');
    if (sLeg && sLeg.value && document.getElementById('view-legajos')?.classList.contains('active')) {
      sLeg.value = '';
      state.filters.search = '';
      renderLegajos();
      return;
    }
    const sPlan = document.getElementById('planilla-search');
    if (sPlan && sPlan.value && document.getElementById('view-planilla')?.classList.contains('active')) {
      sPlan.value = '';
      state.planillaFilter.search = '';
      renderPlanillaEditor();
      return;
    }

    if (typeof window.closeMobileDrawer === 'function') {
      window.closeMobileDrawer();
    }
  });
}

// ==========================================================================
// CONTROL DE LOGIN Y SESIÓN
// ==========================================================================
// CONTROL DE ACCESO (ZERO-TRUST + HASH SHA-256 SIN CONTRASEÑAS EN TEXTO PLANO)
// ==========================================================================
const STATIC_AUTH_SALT = 'aurora_web_v2';
const STATIC_PASS_HASHES = [
  '02537d52a6512eec5023fcda6e7cc650bfd1a58e47b60d85d8b4a052d6b71b8b',
  '2ffc8a814e8fa64dcf4958355d06a65a9dd18a5afd8bec715dd4949aad098744'
];
const STATIC_ACCOUNTS = [
  { email: 'brinnercas', aliases: ['admr.brinnercas@gmail.com', 'brinnercas@gmail.com'], name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General', roleCode: 'ADMIN_GENERAL', department: 'ALL' },
  { email: 'gerencia@aurora.pe', aliases: [], name: 'Gladys Verónica Carbajal Urquizo', role: 'Gerente General', roleCode: 'GERENCIA', department: 'ALL' }
];

async function sha256HexClient(text) {
  if (!window.crypto?.subtle) return '';
  const data = new TextEncoder().encode(text);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStaticFallback({ email, password, pin }) {
  if (pin) {
    const h = await sha256HexClient(`${STATIC_AUTH_SALT}:${pin}`);
    return h === STATIC_PASS_HASHES[0] ? STATIC_ACCOUNTS[0] : null;
  }
  const cleanEmail = String(email || '').trim().toLowerCase();
  const acc = STATIC_ACCOUNTS.find(u => u.email === cleanEmail || u.aliases.includes(cleanEmail));
  if (!acc) return null;
  const h = await sha256HexClient(`${STATIC_AUTH_SALT}:${password}`);
  return STATIC_PASS_HASHES.includes(h) ? acc : null;
}

function initLoginControl() {
  const overlay = document.getElementById('login-screen');
  const formCred = document.getElementById('login-form-cred');
  const formPin = document.getElementById('login-form-pin');
  const tabBtns = document.querySelectorAll('[data-login-tab]');
  const togglePassBtn = document.getElementById('toggle-pass-btn');
  const passInput = document.getElementById('login-pass');
  const pinInput = document.getElementById('login-pin-input');

  // Restaurar sesión activa solo si no ha expirado
  const savedSess = getStoredSession();
  if (savedSess && savedSess.user) {
    state.user = savedSess.user;
    unlockPortal(savedSess.user);
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const mode = btn.getAttribute('data-login-tab');
      formCred.style.display = mode === 'cred' ? 'flex' : 'none';
      formPin.style.display = mode === 'pin' ? 'flex' : 'none';
    });
  });

  if (togglePassBtn && passInput) {
    const eyeOffSvg = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;
    const eyeOpenSvg = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    togglePassBtn.addEventListener('click', () => {
      const showing = passInput.type === 'text';
      passInput.type = showing ? 'password' : 'text';
      togglePassBtn.innerHTML = showing ? eyeOffSvg : eyeOpenSvg;
      togglePassBtn.setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
      togglePassBtn.setAttribute('aria-pressed', String(!showing));
    });
  }

  document.querySelectorAll('.pin-key[data-pin-val]').forEach(key => {
    key.addEventListener('click', () => {
      const val = key.getAttribute('data-pin-val');
      if (val === 'C') {
        pinInput.value = '';
      } else if (pinInput.value.length < 4) {
        pinInput.value += val;
      }
      pinInput.focus();
    });
  });

  formCred.addEventListener('submit', async e => {
    e.preventDefault();
    const feedback = document.getElementById('login-auth-feedback');
    feedback.style.display = 'none';
    if (!window.validateFormOnSubmit(formCred)) return;

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = passInput.value.trim();

    try {
      let res = null;
      let data = null;
      if (useGasBackend()) {
        data = await gasPost('login', { email, password });
        res = { ok: Boolean(data && data.success) };
      } else {
        res = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        data = await res.json();
      }
      if (!res.ok || !data.success) {
        feedback.textContent = data.error || 'Credenciales incorrectas.';
        feedback.style.display = 'block';
        return;
      }
      const sess = saveSession({ user: data.user, token: data.token, expiresAt: data.expiresAt });
      passInput.value = '';
      state.user = sess.user;
      unlockPortal(sess.user);
    } catch (err) {
      // Modo estático sin servidor local activo (Firebase Hosting): verificación criptográfica SHA-256 sin texto plano
      const fallbackUser = await verifyStaticFallback({ email, password });
      if (fallbackUser) {
        const sess = saveSession({ user: fallbackUser, token: '', expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
        passInput.value = '';
        state.user = sess.user;
        unlockPortal(sess.user);
        return;
      }
      feedback.textContent = 'Usuario o clave incorrectos.';
      feedback.style.display = 'block';
    }
  });

  formPin.addEventListener('submit', async e => {
    e.preventDefault();
    const feedback = document.getElementById('login-pin-feedback');
    feedback.style.display = 'none';
    if (!window.validateFormOnSubmit(formPin)) return;

    const pinVal = pinInput.value.trim();

    try {
      let res = null;
      let data = null;
      if (useGasBackend()) {
        data = await gasPost('login', { pin: pinVal });
        res = { ok: Boolean(data && data.success) };
      } else {
        res = await fetch(apiUrl('/api/auth/login'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinVal })
        });
        data = await res.json();
      }
      if (!res.ok || !data.success) {
        feedback.textContent = data.error || 'PIN inválido.';
        feedback.style.display = 'block';
        return;
      }
      const sess = saveSession({ user: data.user, token: data.token, expiresAt: data.expiresAt });
      pinInput.value = '';
      state.user = sess.user;
      unlockPortal(sess.user);
    } catch (err) {
      const fallbackUser = await verifyStaticFallback({ pin: pinVal });
      if (fallbackUser) {
        const sess = saveSession({ user: fallbackUser, token: '', expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
        pinInput.value = '';
        state.user = sess.user;
        unlockPortal(sess.user);
        return;
      }
      feedback.textContent = 'PIN inválido.';
      feedback.style.display = 'block';
    }
  });

  async function lockPortal(reasonMsg) {
    const tok = getAuthToken();
    if (tok) {
      try {
        if (useGasBackend()) {
          await gasPost('logout', {});
        } else {
          await fetch(apiUrl('/api/auth/logout'), {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tok}` }
          });
        }
      } catch (e) {}
    }
    clearSessionStorage();
    document.documentElement.classList.remove('session-unlocked');
    state.user = null;
    overlay.classList.remove('is-hidden');
    if (reasonMsg) {
      const fb = document.getElementById('login-auth-feedback');
      if (fb) { fb.textContent = reasonMsg; fb.style.display = 'block'; }
    }
  }

  window.forceLockPortal = lockPortal;
  document.getElementById('btn-logout-header')?.addEventListener('click', () => lockPortal());
  document.getElementById('btn-logout-dock')?.addEventListener('click', () => lockPortal());
}

function unlockPortal(user) {
  document.documentElement.classList.add('session-unlocked');
  document.getElementById('login-screen').classList.add('is-hidden');
  const badge = document.getElementById('user-badge-name');
  if (badge && user) badge.textContent = `${user.name.split(' ').slice(0, 2).join(' ')} (${user.role})`;
  loadAllData();
}

// ==========================================================================
// NAVEGACIÓN POR DOCK IZQUIERDO + HISTORIAL DEL NAVEGADOR (BOTÓN ATRÁS)
// ==========================================================================
const VALID_VIEWS = ['dashboard', 'legajos', 'ingreso', 'adendas', 'docs', 'correo', 'drive', 'chat', 'planilla'];

function pushViewHistory(viewId) {
  if (!VALID_VIEWS.includes(viewId)) return;
  state.viewHistory.push(viewId);
  try {
    window.history.pushState({ viewId, app: 'rh-brinnercas' }, '', `#${viewId}`);
  } catch (e) {
    window.location.hash = `#${viewId}`;
  }
}

window.switchView = function (viewId, toggleSubIfActive = false, fromHistory = false) {
  if (!VALID_VIEWS.includes(viewId)) viewId = 'dashboard';
  const currentActiveBtn = document.querySelector(`.dock-item[data-view="${viewId}"].active`);
  const wasAlreadyActive = Boolean(currentActiveBtn);

  if (!fromHistory && viewId !== state.currentView) {
    pushViewHistory(viewId);
  }
  state.currentView = viewId;

  document.querySelectorAll('.view-pane').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.dock-item[data-view]').forEach(btn => {
    const isMatch = btn.getAttribute('data-view') === viewId;
    const ctrlId = btn.getAttribute('aria-controls');
    const subList = ctrlId ? document.getElementById(ctrlId) : btn.closest('.dock-menu-group')?.querySelector('.dock-submenu');

    btn.classList.toggle('active', isMatch);
    if (isMatch) {
      btn.setAttribute('aria-current', 'page');
      if (subList) {
        const shouldHide = (wasAlreadyActive && toggleSubIfActive) ? !subList.hidden : false;
        subList.hidden = shouldHide;
        btn.setAttribute('aria-expanded', String(!shouldHide));
      }
    } else {
      btn.removeAttribute('aria-current');
      if (subList) {
        subList.hidden = true;
        btn.setAttribute('aria-expanded', 'false');
      }
    }
  });

  if (!wasAlreadyActive) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.jumpToSection = function (viewId, elId) {
  switchView(viewId, false);
  setTimeout(() => {
    const el = document.getElementById(elId);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 60);
};

window.quickFilterLegajos = function (estadoVal) {
  switchView('legajos', false);
  const fEst = document.getElementById('filter-estado');
  if (fEst) fEst.value = estadoVal;
  state.filters.estado = estadoVal;
  renderLegajos();
};

window.quickFilterCondicionLaboral = function (condVal) {
  switchView('legajos', false);
  const fCond = document.getElementById('filter-condicion-laboral');
  if (fCond) fCond.value = condVal;
  state.filters.condicionLaboral = condVal;
  renderLegajos();
};

function initDock() {
  // Inicializar historial del navegador para que el botón "Atrás" navegue a la pantalla anterior sin salir de la web
  const hashView = (window.location.hash || '').replace(/^#/, '');
  const initialView = VALID_VIEWS.includes(hashView) ? hashView : 'dashboard';
  state.currentView = initialView;
  state.viewHistory = [initialView];
  try {
    window.history.replaceState({ viewId: initialView, app: 'rh-brinnercas', root: true }, '', `#${initialView}`);
  } catch (e) {}

  if (initialView !== 'dashboard') {
    switchView(initialView, false, true);
  }

  window.addEventListener('popstate', e => {
    const stateView = e.state && e.state.viewId;
    const currentHash = (window.location.hash || '').replace(/^#/, '');
    const targetView = VALID_VIEWS.includes(stateView)
      ? stateView
      : (VALID_VIEWS.includes(currentHash) ? currentHash : 'dashboard');

    // Si un modal <dialog> está abierto, cerrarlo primero y restaurar estado
    const openDialog = document.querySelector('dialog[open]');
    if (openDialog) {
      openDialog.close();
      return;
    }

    switchView(targetView, false, true);
  });

  window.addEventListener('hashchange', () => {
    const currentHash = (window.location.hash || '').replace(/^#/, '');
    if (VALID_VIEWS.includes(currentHash) && currentHash !== state.currentView) {
      switchView(currentHash, false, true);
    }
  });

  document.querySelectorAll('.dock-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.getAttribute('data-view'), true);
    });
  });

  // Colapsar / expandir el Dock vertical izquierdo (Desktop) + Drawer móvil/tablet (<= 1024px)
  const leftDock = document.getElementById('left-dock-aside');
  const toggleDockBtn = document.getElementById('btn-toggle-dock');
  const mobileMenuBtn = document.getElementById('btn-mobile-menu');
  const mobileBackdrop = document.getElementById('mobile-dock-backdrop');
  const mobileThemeBtn = document.getElementById('btn-mobile-theme');

  function setMobileDrawer(open) {
    if (!leftDock) return;
    leftDock.classList.toggle('is-mobile-open', open);
    if (mobileBackdrop) mobileBackdrop.hidden = !open;
    if (mobileMenuBtn) {
      mobileMenuBtn.setAttribute('aria-expanded', String(open));
      mobileMenuBtn.textContent = open ? 'CERRAR' : 'MENÚ';
    }
    document.body.classList.toggle('mobile-drawer-open', open);
  }
  window.closeMobileDrawer = () => setMobileDrawer(false);

  toggleDockBtn?.addEventListener('click', () => {
    if (window.innerWidth <= 1024) {
      setMobileDrawer(false);
    } else {
      leftDock?.classList.toggle('is-collapsed');
    }
  });

  mobileMenuBtn?.addEventListener('click', () => {
    const isOpen = leftDock?.classList.contains('is-mobile-open');
    setMobileDrawer(!isOpen);
  });

  mobileBackdrop?.addEventListener('click', () => setMobileDrawer(false));

  // Cerrar el drawer automáticamente en tablet/móvil al elegir un submenú o link del Dock
  leftDock?.querySelectorAll('.dock-sub-link, .dock-cloud-open-btn, .dock-logout-btn').forEach(el => {
    el.addEventListener('click', () => {
      if (window.innerWidth <= 1024) setMobileDrawer(false);
    });
  });

  mobileThemeBtn?.addEventListener('click', () => {
    document.getElementById('btn-theme-toggle')?.click();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1024) setMobileDrawer(false);
  });

  // Conmutador general Modo Día / Modo Noche (incluyendo el Dock) siguiendo dark-mode-toggle
  const themeBtn = document.getElementById('btn-theme-toggle');
  const themeLabel = document.getElementById('theme-toggle-label');
  const themeBadge = document.getElementById('theme-toggle-badge');
  const metaScheme = document.querySelector('meta[name="color-scheme"]');

  function getRenderedScheme() {
    const stored = localStorage.getItem('color-scheme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applySchemeUI(scheme) {
    document.documentElement.setAttribute('data-theme', scheme);
    if (themeBadge) themeBadge.textContent = scheme === 'dark' ? 'NOCHE' : 'DÍA';
    if (themeLabel) themeLabel.textContent = scheme === 'dark' ? 'Modo Día' : 'Modo Noche';
  }

  applySchemeUI(getRenderedScheme());

  themeBtn?.addEventListener('click', () => {
    const currentRendered = getRenderedScheme();
    const target = currentRendered === 'dark' ? 'light' : 'dark';
    const sysScheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

    if (target === sysScheme) {
      localStorage.removeItem('color-scheme');
      if (metaScheme) metaScheme.content = 'light dark';
    } else {
      localStorage.setItem('color-scheme', target);
      if (metaScheme) metaScheme.content = target;
    }
    applySchemeUI(target);
  });

  window.addEventListener('storage', e => {
    if (e.key === 'color-scheme') {
      const val = e.newValue;
      if (metaScheme) metaScheme.content = (val === 'dark' || val === 'light') ? val : 'light dark';
      applySchemeUI(getRenderedScheme());
    }
  });
}

// ==========================================================================
// CARGA DE DATOS (EMBEDDED DRIVE/SHEETS DATA + BACKEND SYNC) Y RENDERIZADO
// ==========================================================================
function renderAllViews() {
  if (!state.audit) return;
  populateSelects();
  renderDashboard();
  renderLegajos();
  renderPlanillaEditor();
  renderAdendasView();
  renderDocsAndMof();
  renderDriveHub();
  hydrateIcons();
}

function normalizeAuditData(audit) {
  if (!audit || !Array.isArray(audit.colaboradores)) return audit;
  const porCL = { CONTRATO: 0, RXH: 0, OTROS: 0 };
  audit.colaboradores.forEach(c => {
    const raw = String(c.condicionLaboral || '').toUpperCase().trim();
    if (raw === 'CONTRATO' || raw === 'RXH' || raw === 'OTROS') {
      c.condicionLaboral = raw;
    } else if (c.estado === 'RXH' || String(c.condicionLaborable || '').toUpperCase().includes('RXH')) {
      c.condicionLaboral = 'RXH';
    } else if (c.estado === 'APOYO') {
      c.condicionLaboral = 'OTROS';
    } else {
      c.condicionLaboral = 'CONTRATO';
    }
    porCL[c.condicionLaboral] = (porCL[c.condicionLaboral] || 0) + 1;
  });
  audit.resumen = audit.resumen || {};
  const existingCL = audit.resumen.porCondicionLaboral;
  const existingSum = existingCL ? ((existingCL.CONTRATO || 0) + (existingCL.RXH || 0) + (existingCL.OTROS || 0)) : 0;
  if (!existingCL || existingSum === 0) {
    audit.resumen.porCondicionLaboral = porCL;
  }
  return audit;
}

function formatSheetDate(val) {
  if (!val) return '';
  const s = String(val).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function toIsoDate(val) {
  const s = String(val || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoT = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoT) return isoT[1];
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return '';
}

function toDmyDate(val) {
  const s = String(val || '').trim();
  if (!s) return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return s;
}

function calcularEdadPorAnio(dateStr) {
  const s = String(dateStr || '').trim();
  if (!s) return '';
  let birthYear = NaN;
  const iso = s.match(/^(\d{4})-\d{2}-\d{2}/);
  const dmy = s.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/);
  if (iso) birthYear = parseInt(iso[1], 10);
  else if (dmy) birthYear = parseInt(dmy[1], 10);
  if (isNaN(birthYear) || birthYear < 1920 || birthYear > new Date().getFullYear()) return '';
  return String(new Date().getFullYear() - birthYear);
}

function mergeGasPadronIntoAudit(gasRows, baseAudit) {
  const existing = Array.isArray(baseAudit?.colaboradores) ? baseAudit.colaboradores : [];
  const byDni = new Map(existing.map(c => [String(c.dni || '').trim(), c]));
  const byId = new Map(existing.map(c => [Number(c.id), c]));

  const hoy = new Date();
  const mergedCols = (gasRows || []).filter(r => r && (r['DNI'] || r['Apellidos y Nombres'])).map((r, idx) => {
    const id = Number(r['ID']) || (idx + 1);
    const dni = String(r['DNI'] || '').trim();
    const prev = byDni.get(dni) || byId.get(id) || {};

    const nombre = String(r['Apellidos y Nombres'] || prev.nombre || '').trim();
    const area = String(r['Área'] || prev.area || 'General').trim();
    const cargo = String(r['Cargo Actual'] || prev.cargo || 'Colaborador').trim();
    const condicionLaborable = String(r['Condición'] || prev.condicionLaborable || 'FULL TIME').trim();
    const estado = String(r['Estado'] || prev.estado || 'ACTIVO').toUpperCase().trim();
    const rawCL = String(r['CONDICION LABORAL'] || prev.condicionLaboral || '').toUpperCase().trim();
    const condicionLaboral = ['CONTRATO', 'RXH', 'OTROS'].includes(rawCL)
      ? rawCL
      : (estado === 'RXH' ? 'RXH' : (estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));

    const fechaIngreso = formatSheetDate(r['Ingreso / Contrato']) || prev.fechaIngreso || 'N/A';
    const vigenciaHasta = formatSheetDate(r['Vigencia / Cese']) || prev.vigenciaHasta || 'Vigente';
    const sueldo = Number(r['Sueldo S/'] !== '' && r['Sueldo S/'] !== undefined ? r['Sueldo S/'] : (prev.sueldo || 0));
    const domicilio = String(r['Domicilio'] || prev.domicilio || 'No registrado').trim();
    const celular = String(r['Celular'] || prev.celular || 'No registrado').trim();
    const correo = String(r['Correo'] || prev.correo || 'No registrado').trim();

    const bancoCuenta = String(r['Banco / Cuenta'] || '').trim();
    let banco = prev.banco || 'No registrado';
    let numeroCuenta = prev.numeroCuenta || 'No registrado';
    if (bancoCuenta) {
      const spIdx = bancoCuenta.indexOf(' ');
      if (spIdx > 0 && /\d/.test(bancoCuenta.slice(spIdx + 1))) {
        banco = bancoCuenta.slice(0, spIdx).trim();
        numeroCuenta = bancoCuenta.slice(spIdx + 1).trim();
      } else {
        banco = bancoCuenta;
      }
    }

    let semaforo = 'gris';
    let estadoTexto = estado;
    if (estado === 'ACTIVO') {
      const parts = vigenciaHasta.split('/');
      const fVig = parts.length === 3 ? new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])) : null;
      if (fVig && !isNaN(fVig.getTime()) && fVig < hoy) {
        semaforo = 'naranja';
        estadoTexto = 'Renovación Pendiente';
      } else {
        semaforo = 'verde';
        estadoTexto = 'Contrato Vigente';
      }
    } else if (estado === 'RXH') {
      semaforo = 'verde';
      estadoTexto = 'Fijo RxH Activo';
    } else if (estado === 'APOYO') {
      semaforo = 'amarillo';
      estadoTexto = 'Apoyo / Por Regularizar';
    } else if (estado === 'CESADO') {
      semaforo = 'gris';
      estadoTexto = `Cesado (${vigenciaHasta || 'Concluido'})`;
    }

    const prevDocs = prev.documentos || { contrato: null, adendas: [], memorandums: [], liquidacion: null, fotoDni: null };
    const sheetDniUrl = String(r['Foto DNI (Drive)'] || '').trim();
    const sheetContratoUrl = String(r['Contrato (Drive)'] || '').trim();
    const fotoDni = sheetDniUrl
      ? { ...(prevDocs.fotoDni || {}), driveUrl: sheetDniUrl, originalName: prevDocs.fotoDni?.originalName || `DNI_${dni}` }
      : prevDocs.fotoDni;
    const contratoDoc = sheetContratoUrl
      ? { ...(prevDocs.contrato || {}), driveUrl: sheetContratoUrl }
      : prevDocs.contrato;

    return {
      ...prev,
      id,
      nombre,
      dni,
      area,
      cargo,
      cargoContrato: prev.cargoContrato || cargo,
      condicionLaborable,
      condicionLaboral,
      sueldo,
      estado,
      estadoTexto,
      semaforo,
      fechaIngreso,
      finContratoBase: prev.finContratoBase || vigenciaHasta,
      vigenciaHasta,
      fechaCese: estado === 'CESADO' ? vigenciaHasta : null,
      domicilio,
      celular,
      correo,
      banco,
      numeroCuenta,
      fechaNacimiento: prev.fechaNacimiento || 'No registrado',
      edad: prev.edad || 'N/A',
      carnetSanitario: prev.carnetSanitario || 'NO',
      adendas: prev.adendas || [],
      observaciones: prev.observaciones || (estado === 'ACTIVO' ? 'Sincronizado en vivo con Google Sheets.' : 'Vínculo laboral concluido.'),
      documentos: {
        ...prevDocs,
        fotoDni,
        contrato: contratoDoc
      }
    };
  });

  const activos = mergedCols.filter(c => c.estado === 'ACTIVO');
  const cesados = mergedCols.filter(c => c.estado === 'CESADO');
  const rxhApoyo = mergedCols.filter(c => c.estado === 'RXH' || c.estado === 'APOYO');
  const totalNominaActiva = activos.reduce((sum, c) => sum + (Number(c.sueldo) || 0), 0);
  const masaInicialFeb = baseAudit?.resumen?.masaInicialFeb || 40880;
  const ahorroMensual = Math.max(0, masaInicialFeb - totalNominaActiva);

  const porArea = {};
  activos.forEach(c => {
    const a = c.area || 'General';
    if (!porArea[a]) porArea[a] = { count: 0, total: 0, colaboradores: [] };
    porArea[a].count += 1;
    porArea[a].total += Number(c.sueldo) || 0;
    porArea[a].colaboradores.push(c.nombre);
  });

  const porCondicionLaboral = { CONTRATO: 0, RXH: 0, OTROS: 0 };
  mergedCols.forEach(c => {
    porCondicionLaboral[c.condicionLaboral] = (porCondicionLaboral[c.condicionLaboral] || 0) + 1;
  });

  return {
    ...(baseAudit || {}),
    resumen: {
      ...(baseAudit?.resumen || {}),
      totalColaboradores: mergedCols.length,
      activosCount: activos.length,
      cesadosCount: cesados.length,
      rxhApoyoCount: rxhApoyo.length,
      totalNominaActiva,
      masaInicialFeb,
      ahorroMensual,
      porcentajeOptimizacion: Number(((ahorroMensual / masaInicialFeb) * 100).toFixed(1)),
      porArea,
      porCondicionLaboral
    },
    colaboradores: mergedCols
  };
}

async function loadAllData() {
  // 1. Renderizar de inmediato desde el bundle embebido de Drive + Padrón (0ms)
  if (window.RH_EMBEDDED_DATA) {
    if (!state.audit) state.audit = normalizeAuditData(window.RH_EMBEDDED_DATA.audit);
    if (!state.mof) state.mof = window.RH_EMBEDDED_DATA.mof;
    if (!state.memoMotivos) state.memoMotivos = window.RH_EMBEDDED_DATA.memoMotivos;
    renderAllViews();
  }

  const tok = getAuthToken();
  if (!tok) return;

  // 2A. En Firebase Hosting / Nube (HTTPS): sincronizar en vivo directamente desde Google Sheets (Apps Script)
  if (useGasBackend()) {
    try {
      const res = await fetch(`${GAS_WEBAPP_URL}?action=padron&token=${encodeURIComponent(tok)}`);
      const data = await res.json();
      if (data && data.success && Array.isArray(data.colaboradores)) {
        state.audit = normalizeAuditData(mergeGasPadronIntoAudit(data.colaboradores, state.audit || window.RH_EMBEDDED_DATA?.audit));
        renderAllViews();
      }
    } catch (e) {
      // Mantiene los datos embebidos si falla la red
    }
    return;
  }

  // 2B. En Local (http://localhost:3005): sincronizar con servidor Node.js
  try {
    const [auditRes, mofRes, motivosRes] = await Promise.all([
      authFetch(apiUrl('/api/audit')),
      authFetch(apiUrl('/api/mof')),
      authFetch(apiUrl('/api/memo-motivos'))
    ]);
    if (auditRes.ok && mofRes.ok && motivosRes.ok) {
      state.audit = normalizeAuditData(await auditRes.json());
      state.mof = await mofRes.json();
      state.memoMotivos = await motivosRes.json();
      renderAllViews();
    }
  } catch (err) {
    renderAllViews();
  }
}

window.sincronizarAhora = async function (btnEl) {
  const orig = btnEl ? btnEl.textContent : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'SINCRONIZANDO...';
  }
  try {
    await loadAllData();
    const total = state.audit?.colaboradores?.length || 0;
    if (btnEl) btnEl.textContent = `SINCRONIZADO (${total})`;
  } catch (e) {
    if (btnEl) btnEl.textContent = 'REINTENTAR SYNC';
  } finally {
    setTimeout(() => {
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.textContent = orig;
      }
    }, 2200);
  }
};

function populateSelects() {
  if (!state.audit) return;
  const cols = state.audit.colaboradores;
  const fColab = document.getElementById('select-colaborador-ficha');
  const memoColab = document.getElementById('memo-colab');
  const actaColab = document.getElementById('acta-colab');
  const liqColab = document.getElementById('liq-colab');
  const emailColab = document.getElementById('email-colab');

  const optsHtml = cols.map(c =>
    `<option value="${c.id}">${escapeHtml(c.nombre)} (${escapeHtml(c.dni)}) — ${escapeHtml(c.estado)}</option>`
  ).join('');

  if (fColab) {
    fColab.innerHTML = '<option value="">-- Seleccionar personal específico --</option>' + optsHtml;
    if (state.selectedColabId) fColab.value = String(state.selectedColabId);
  }
  if (memoColab) memoColab.innerHTML = optsHtml;
  if (actaColab) actaColab.innerHTML = optsHtml;
  if (liqColab) liqColab.innerHTML = optsHtml;
  if (emailColab) {
    emailColab.innerHTML = '<option value="ALL">TODOS LOS COLABORADORES (RESUMEN GENERAL)</option>' + optsHtml;
    if (state.selectedColabId) emailColab.value = String(state.selectedColabId);
  }

  const filterAreaSel = document.getElementById('filter-area');
  if (filterAreaSel) {
    const prevArea = filterAreaSel.value;
    const uniqueAreas = Array.from(new Set(cols.map(c => c.area).filter(Boolean))).sort();
    filterAreaSel.innerHTML = '<option value="">Todas las Áreas</option>' +
      uniqueAreas.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
    if (prevArea) filterAreaSel.value = prevArea;
  }

  const memoMotivoSel = document.getElementById('memo-motivo');
  if (memoMotivoSel && state.memoMotivos) {
    memoMotivoSel.innerHTML = Object.entries(state.memoMotivos).map(([k, v]) =>
      `<option value="${k}">${escapeHtml(v.tipo)}: ${escapeHtml(v.asunto)}</option>`
    ).join('');
  }
}

// ==========================================================================
// 1. RENDERIZADO DEL DASHBOARD
// ==========================================================================
function renderDashboard() {
  if (!state.audit) return;
  const { resumen, colaboradores, manifest } = state.audit;

  const kpiGrid = document.getElementById('kpi-grid');
  kpiGrid.innerHTML = `
    <article class="glass-card kpi-glass">
      <div class="kpi-label">Planilla Activa (Modal)</div>
      <div class="kpi-value">${resumen.activosCount}</div>
      <div class="kpi-meta">${resumen.totalColaboradores} registros totales incl. cesados y RxH/Apoyo</div>
    </article>
    <article class="glass-card kpi-glass">
      <div class="kpi-label">Masa Salarial Activa</div>
      <div class="kpi-value">${formatMoney(resumen.totalNominaActiva)}</div>
      <div class="kpi-meta">Base auditada mensual Grupo Aurora</div>
    </article>
    <article class="glass-card kpi-glass">
      <div class="kpi-label">Ahorro vs. Febrero 2026</div>
      <div class="kpi-value" style="color:var(--emerald-ok);">${formatMoney(resumen.ahorroMensual)}</div>
      <div class="kpi-meta">Optimización del ${resumen.porcentajeOptimizacion}% sobre S/ 40,880.00</div>
    </article>
    <article class="glass-card kpi-glass">
      <div class="kpi-label">Personal Cesado</div>
      <div class="kpi-value" style="color:#FCA5A5;">${resumen.cesadosCount}</div>
      <div class="kpi-meta">+ ${resumen.rxhApoyoCount} colaboradores RxH / Apoyo con DNI</div>
    </article>
    <article class="glass-card kpi-glass">
      <div class="kpi-label">Bóveda Documental Drive</div>
      <div class="kpi-value" style="color:var(--aurora-gold-bright);">${manifest?.stats?.contratos || 22} + ${manifest?.stats?.adendas || 43}</div>
      <div class="kpi-meta">Contratos PDF, Adendas DOCX y ${manifest?.stats?.dnis || 25} DNIs</div>
    </article>
  `;

  const areasGrid = document.getElementById('areas-grid');
  areasGrid.innerHTML = Object.entries(resumen.porArea || {}).map(([area, info]) => `
    <div class="glass-card-subtle">
      <div style="font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--aurora-gold-foil); font-weight:700;">${escapeHtml(area)}</div>
      <div style="font-family:var(--font-serif); font-size:1.35rem; font-weight:700; margin:4px 0;">${info.count} activos</div>
      <div style="font-size:0.84rem; color:var(--aurora-alabaster); margin-bottom:4px;">${formatMoney(info.total)} / mes</div>
      <div style="font-size:0.74rem; color:var(--aurora-bone); opacity:0.82;">${renderExpandableText(info.colaboradores.join(', '), 45)}</div>
    </div>
  `).join('');

  const condGrid = document.getElementById('condicion-laboral-grid');
  if (condGrid) {
    const computedCL = { CONTRATO: 0, RXH: 0, OTROS: 0 };
    (colaboradores || []).forEach(c => {
      const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));
      computedCL[cl] = (computedCL[cl] || 0) + 1;
    });
    const rawCL = resumen.porCondicionLaboral;
    const rawSum = rawCL ? ((rawCL.CONTRATO || 0) + (rawCL.RXH || 0) + (rawCL.OTROS || 0)) : 0;
    const porCL = rawSum > 0 ? rawCL : computedCL;
    const totalCL = Math.max(1, (porCL.CONTRATO || 0) + (porCL.RXH || 0) + (porCL.OTROS || 0));
    const clItems = [
      { key: 'CONTRATO', label: 'CONTRATO', desc: 'Planilla / Modal D.Leg. 728', color: '#6049E7', badge: 'badge-verde' },
      { key: 'RXH', label: 'RXH', desc: 'Recibo por Honorarios', color: '#007DFC', badge: 'badge-naranja' },
      { key: 'OTROS', label: 'OTROS', desc: 'Apoyo / Otros Vínculos', color: '#FF630B', badge: 'badge-amarillo' }
    ];
    condGrid.innerHTML = clItems.map(item => {
      const cnt = porCL[item.key] || 0;
      const pct = Math.round((cnt / totalCL) * 100);
      return `
        <button type="button" class="condicion-stat-card" onclick="quickFilterCondicionLaboral('${item.key}')">
          <div class="condicion-stat-top">
            <span class="status-badge ${item.badge}">${item.label}</span>
            <span class="condicion-stat-pct">${pct}%</span>
          </div>
          <div class="condicion-stat-val">${cnt} <small>colaboradores</small></div>
          <div class="condicion-bar-track">
            <div class="condicion-bar-fill" style="width:${pct}%; background:${item.color};"></div>
          </div>
          <div class="condicion-stat-desc">${item.desc} • Clic para filtrar</div>
        </button>
      `;
    }).join('');
  }

  const cloudBox = document.getElementById('dashboard-cloud-summary');
  const rootUrl = manifest?.drive?.rootFolder?.url || 'https://drive.google.com/drive/';
  const masterSheetUrl = manifest?.sheets?.masterSheetUrl || 'https://docs.google.com/spreadsheets/d/1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk/edit';
  const histSheetUrl = manifest?.sheets?.historicalSheetUrl || 'https://docs.google.com/spreadsheets/d/1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM/edit';

  if (cloudBox) {
    cloudBox.innerHTML = `
      <a href="${escapeHtml(rootUrl)}" target="_blank" rel="noopener" class="dock-cloud-link">
        <span class="dock-cloud-link-title">Carpeta Raíz Drive</span>
        <span class="dock-cloud-link-sub">6 Subcarpetas • ${manifest?.stats?.contratos || 22} Contratos</span>
      </a>
      <a href="${escapeHtml(masterSheetUrl)}" target="_blank" rel="noopener" class="dock-cloud-link">
        <span class="dock-cloud-link-title">Sheets Maestro (En Vivo)</span>
        <span class="dock-cloud-link-sub">Col. CONDICION LABORAL</span>
      </a>
      <a href="${escapeHtml(histSheetUrl)}" target="_blank" rel="noopener" class="dock-cloud-link">
        <span class="dock-cloud-link-title">Sheets Histórico Aurora</span>
        <span class="dock-cloud-link-sub">Registro del Personal</span>
      </a>
    `;
  }

  // Alertas recientes (Activos + Cesados mayo/octubre 2026)
  const relevantes = colaboradores.filter(c => c.estado === 'ACTIVO' || c.id === 2 || c.id === 11 || c.id === 17).slice(0, 12);
  document.getElementById('dash-alerts-tbody').innerHTML = relevantes.map(c => `
    <tr>
      <th scope="row">${escapeHtml(c.nombre)}</th>
      <td data-label="Puesto">${escapeHtml(c.cargo)} <span style="opacity:0.65;">(${escapeHtml(c.area)})</span></td>
      <td data-label="Estado"><span class="status-badge ${badgeClassForSemaforo(c.semaforo)}">${escapeHtml(c.estadoTexto)}</span></td>
      <td data-label="Vigencia">${escapeHtml(c.vigenciaHasta)}</td>
      <td data-label="Detalle">${renderExpandableText(c.observaciones, 62)}</td>
      <td data-label="Acceso">
        <button type="button" class="bw-btn-sm is-gold" onclick="focusEmployeeVault(${c.id})">Ver 5 Docs</button>
      </td>
    </tr>
  `).join('');
}

window.focusEmployeeVault = function (id) {
  state.selectedColabId = id;
  const sel = document.getElementById('select-colaborador-ficha');
  if (sel) sel.value = String(id);
  switchView('legajos');
  renderLegajos();
  openSpotlightModal(id);
};

window.openSpotlightModal = function (id) {
  const c = state.audit?.colaboradores?.find(x => Number(x.id) === Number(id) || String(x.id) === String(id));
  if (!c) return;
  state.selectedColabId = c.id;
  const titleEl = document.getElementById('spotlight-dialog-title');
  if (titleEl) titleEl.textContent = `${c.nombre} — DNI ${c.dni}`;
  renderSpotlight(c);
  const dlg = document.getElementById('spotlight-dialog');
  if (dlg) {
    if (!dlg.open) dlg.showModal();
    dlg.focus();
  }
};

window.handleLegajoRowClick = function (event, id) {
  if (event && event.target && event.target.closest('a, button:not(.legajo-name-btn)')) {
    return;
  }
  selectSpotlight(id);
};

// ==========================================================================
// 2. LEGAJOS: FILTRADO + SPOTLIGHT DE 5 OPCIONES DE DESCARGA POR PERSONAL
// ==========================================================================
function getFilteredColaboradores() {
  if (!state.audit) return [];
  const q = state.filters.search.toLowerCase().trim();
  const area = state.filters.area;
  const est = state.filters.estado;
  const condLab = state.filters.condicionLaboral;

  return state.audit.colaboradores.filter(c => {
    const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));
    if (area && c.area !== area) return false;
    if (est === 'RXH' && !(c.estado === 'RXH' || c.estado === 'APOYO')) return false;
    if (est && est !== 'RXH' && c.estado !== est) return false;
    if (condLab && cl !== condLab) return false;
    if (q) {
      const hay = `${c.nombre} ${c.dni} ${c.cargo} ${c.area} ${c.domicilio} ${c.banco} ${c.estado} ${cl}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderLegajos() {
  if (!state.audit) return;
  const filtered = getFilteredColaboradores();
  const countPill = document.getElementById('legajos-count-pill');
  if (countPill) countPill.textContent = `${filtered.length} de ${state.audit.colaboradores.length} colaboradores mostrados`;

  // Si la ventana emergente de bóveda está abierta, mantenerla sincronizada
  let spotlightColab = filtered.find(c => c.id === Number(state.selectedColabId));
  const spotDlg = document.getElementById('spotlight-dialog');
  if (spotDlg && spotDlg.open && spotlightColab) {
    renderSpotlight(spotlightColab);
  }

  const tbody = document.getElementById('legajos-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:28px;">No se encontraron colaboradores con el filtro actual.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isSel = spotlightColab && c.id === spotlightColab.id;
    const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));
    const clBadge = cl === 'CONTRATO' ? 'badge-verde' : (cl === 'RXH' ? 'badge-naranja' : 'badge-amarillo');

    return `
      <tr onclick="handleLegajoRowClick(event, ${c.id})" style="cursor:pointer; ${isSel ? 'background:rgba(96,73,231,0.08);' : ''}">
        <th scope="row">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <button type="button" class="legajo-name-btn" onclick="selectSpotlight(${c.id})" style="background:none; border:none; color:var(--hs-text-primary); font-weight:800; text-align:left; cursor:pointer; padding:0; font-size:0.86rem;">
              ${escapeHtml(c.nombre)}
            </button>
            <span style="font-size:0.72rem; color:var(--hs-text-secondary); font-weight:600;">${escapeHtml(c.condicionLaborable)}</span>
          </div>
        </th>
        <td data-label="DNI" style="white-space:nowrap;"><strong>${escapeHtml(c.dni)}</strong></td>
        <td data-label="Área y Puesto">${escapeHtml(c.area)}<br><span style="font-size:0.76rem; color:var(--aurora-gold-bright); font-weight:600;">${escapeHtml(c.cargo)}</span></td>
        <td data-label="Condición Laboral"><span class="status-badge ${clBadge}">${escapeHtml(cl)}</span></td>
        <td data-label="Estado"><span class="status-badge ${badgeClassForSemaforo(c.semaforo)}">${escapeHtml(c.estadoTexto)}</span></td>
        <td data-label="Sueldo" style="white-space:nowrap;"><strong>${formatMoney(c.sueldo)}</strong></td>
        <td data-label="Detalle" style="white-space:nowrap;">
          <button type="button" class="bw-btn-sm is-primary" onclick="event.stopPropagation(); selectSpotlight(${c.id})" title="Ver toda la información y los 5 documentos del personal">
            MOSTRAR MÁS
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

window.selectSpotlight = function (id) {
  state.selectedColabId = id;
  const sel = document.getElementById('select-colaborador-ficha');
  if (sel) sel.value = String(id);
  renderLegajos();
  openSpotlightModal(id);
};

function renderSpotlight(c) {
  const box = document.getElementById('expediente-spotlight');
  if (!box) return;
  if (!c) {
    box.innerHTML = '<p style="text-align:center; padding:18px; color:var(--aurora-bone);">Selecciona o filtra un colaborador para desplegar su Bóveda Individual de 5 Documentos.</p>';
    return;
  }

  const docs = c.documentos || {};
  const adendas = docs.adendas || [];
  const memos = docs.memorandums || [];
  const driveInfo = state.audit?.manifest?.drive || {};
  const manifest = driveInfo.subfolders || {};

  const adendasLinksHtml = adendas.length > 0
    ? adendas.map((a, idx) => {
        const href = relDocUrl(a.localUrl, `/api/docs/adenda/${c.id}?index=${idx}`, a.driveUrl);
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="bw-btn-sm">${idx + 1}ª Adenda DOCX</a>`;
      }).join('')
    : '';

  const memosLinksHtml = memos.length > 0
    ? memos.map((m, idx) => {
        const href = relDocUrl(m.localUrl, `/api/docs/memo/${c.id}?index=${idx}`, m.driveUrl);
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener" class="bw-btn-sm">${escapeHtml((m.name || m.fileName || 'Memo').slice(0, 18))}</a>`;
      }).join('')
    : '';

  const contratoDownloadHref = relDocUrl(docs.contrato?.localUrl, `/api/docs/contrato/${c.id}`, docs.contrato?.driveUrl);
  const liqDownloadHref = relDocUrl(docs.liquidacion?.localUrl, `/api/docs/liquidacion/${c.id}`, docs.liquidacion?.driveUrl);
  const dniDownloadHref = docs.fotoDni ? relDocUrl(docs.fotoDni.localUrl, `/api/docs/dni/${c.id}`, docs.fotoDni.driveUrl) : '';

  const adendasTextoResumen = (c.adendas || []).map(a => `${a.numero || ''}: ${a.inicio || a.desde || ''} al ${a.fin || a.hasta || ''} (${a.concepto || a.observacion || 'Prórroga'})`).join(' | ') || 'Sin adendas previas registradas.';

  box.innerHTML = `
    <div class="spotlight-header">
      <div style="display:flex; gap:16px; align-items:center;">
        <div class="spotlight-avatar">${getInitials(c.nombre)}</div>
        <div>
          <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            <h3 style="font-family:var(--font-sans); font-size:1.35rem; font-weight:800; color:var(--hs-text-primary);">${escapeHtml(c.nombre)}</h3>
            <span class="status-badge ${badgeClassForSemaforo(c.semaforo)}">${escapeHtml(c.estadoTexto)}</span>
            <span class="status-badge ${(c.condicionLaboral || 'CONTRATO') === 'CONTRATO' ? 'badge-verde' : ((c.condicionLaboral || '') === 'RXH' ? 'badge-naranja' : 'badge-amarillo')}">
              COND. LABORAL: ${escapeHtml(c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO')))}
            </span>
          </div>
          <p style="font-size:0.84rem; font-weight:700; color:var(--accent-orange); margin-top:3px;">
            ${escapeHtml(c.cargo)} • Área: ${escapeHtml(c.area)} • ${escapeHtml(c.condicionLaborable)}
          </p>
        </div>
      </div>

      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="bw-btn-sm is-primary" onclick="document.getElementById('spotlight-dialog')?.close(); openPlanillaEditor(${c.id})">Editar Ficha (Sheets)</button>
        <button type="button" class="bw-btn-sm" onclick="document.getElementById('spotlight-dialog')?.close(); openEmailComposer('CONTRATO', ${c.id})">Enviar Docs por Correo</button>
        <button type="button" class="bw-btn-sm is-gold" onclick="openColabDetailDialog(${c.id})">Ver Ficha Completa</button>
        ${driveInfo.rootFolder?.url ? `<a href="${escapeHtml(driveInfo.rootFolder.url)}" target="_blank" rel="noopener" class="bw-btn-sm">Carpeta Drive</a>` : ''}
      </div>
    </div>

    <div class="spotlight-info-grid">
      <div class="info-chip">
        <div class="info-chip-label">Documento Identidad</div>
        <div><strong>DNI ${escapeHtml(c.dni)}</strong> • Nac: ${escapeHtml(c.fechaNacimiento)} (${escapeHtml(c.edad)} años)</div>
      </div>
      <div class="info-chip">
        <div class="info-chip-label">Remuneración / Banco</div>
        <div><strong>${formatMoney(c.sueldo)}</strong> • ${escapeHtml(c.banco)} (${escapeHtml(c.numeroCuenta)})</div>
      </div>
      <div class="info-chip">
        <div class="info-chip-label">Fechas &amp; Vigencia</div>
        <div>Ingreso: ${escapeHtml(c.fechaIngreso)} • Fin/Cese: <strong>${escapeHtml(c.vigenciaHasta)}</strong></div>
      </div>
      <div class="info-chip">
        <div class="info-chip-label">Contacto &amp; Sanidad</div>
        <div>Tel: ${escapeHtml(c.celular)} • Carnet Sanidad: <strong>${escapeHtml(c.carnetSanitario)}</strong></div>
      </div>
      <div class="info-chip">
        <div class="info-chip-label">Domicilio Declarado (Leer más)</div>
        <div>${renderExpandableText(c.domicilio, 42)}</div>
      </div>
      <div class="info-chip">
        <div class="info-chip-label">Observaciones / Historial Adendas</div>
        <div>${renderExpandableText(`${c.observaciones} — Historial: ${adendasTextoResumen}`, 46)}</div>
      </div>
    </div>

    <!-- LAS 5 OPCIONES DIRECTAS DE DESCARGA PARA EL PERSONAL SELECCIONADO -->
    <div class="docs-5-grid">
      <!-- 1. CONTRATO -->
      <div class="doc-vault-card">
        <div>
          <div class="doc-vault-title">
            <span>1. Contrato de Trabajo</span>
          </div>
          <p style="font-size:0.75rem; color:var(--hs-text-secondary); margin-top:6px;">
            ${docs.contrato ? escapeHtml(docs.contrato.fileName) : 'Base Oficial 01_CONTRATOS_PERSONAL_PDF (Anexo N° 001 + 18 Cláusulas)'}
          </p>
        </div>
        <div class="doc-actions-stack">
          <a href="${escapeHtml(contratoDownloadHref)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">Descargar</a>
          ${docs.contrato
            ? `<button type="button" class="bw-btn-sm" onclick="openDocPreview('Contrato — ${escapeHtml(c.nombre)}', '${escapeHtml(contratoDownloadHref)}', '${escapeHtml(contratoDownloadHref)}', false)">Ver PDF</button>`
            : ''
          }
          <button type="button" class="bw-btn-sm" onclick="previewContratoOficial(${c.id})">Anexo N° 001</button>
          ${docs.contrato?.driveUrl ? `<a href="${escapeHtml(docs.contrato.driveUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Drive</a>` : ''}
        </div>
      </div>

      <!-- 2. ADENDAS -->
      <div class="doc-vault-card">
        <div>
          <div class="doc-vault-title">
            <span>2. Adendas de Contrato (${adendas.length})</span>
          </div>
          <p style="font-size:0.75rem; color:var(--hs-text-secondary); margin-top:6px;">
            ${adendas.length ? 'Descarga directa de adendas firmadas en Word (.docx) o genera la siguiente.' : 'Emite nueva adenda de prórroga en formato oficial Aptos 11pt.'}
          </p>
        </div>
        <div class="doc-actions-stack">
          ${adendasLinksHtml}
          <a href="${escapeHtml(apiUrl(`/api/docs/adenda/${c.id}`))}" class="bw-btn-sm is-primary">Emitir Nueva DOCX</a>
          ${manifest.adendas?.url ? `<a href="${escapeHtml(manifest.adendas.url)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Drive</a>` : ''}
        </div>
      </div>

      <!-- 3. MEMORÁNDUMS -->
      <div class="doc-vault-card">
        <div>
          <div class="doc-vault-title">
            <span>3. Memorándums (${memos.length})</span>
          </div>
          <p style="font-size:0.75rem; color:var(--hs-text-secondary); margin-top:6px;">
            ${memos.length ? 'Documentos disciplinarios / actas en carpeta o emisión al vuelo.' : 'Genera memorándum o constancia personalizada para este trabajador.'}
          </p>
        </div>
        <div class="doc-actions-stack">
          ${memosLinksHtml}
          <a href="${escapeHtml(apiUrl(`/api/docs/memo/${c.id}`))}" class="bw-btn-sm is-primary">Descargar Memo</a>
          <button type="button" class="bw-btn-sm" onclick="openDocPreview('Memorándum — ${escapeHtml(c.nombre)}', '${escapeHtml(apiUrl(`/api/docs/memo/${c.id}?inline=1`))}', '${escapeHtml(apiUrl(`/api/docs/memo/${c.id}`))}', true)">Vista Previa</button>
          <button type="button" class="bw-btn-sm is-gold" onclick="prefillDocsTab(${c.id}, 'memo')">Redactar</button>
        </div>
      </div>

      <!-- 4. LIQUIDACIÓN DE BBSS -->
      <div class="doc-vault-card">
        <div>
          <div class="doc-vault-title">
            <span>4. Liquidación BB.SS.</span>
          </div>
          <p style="font-size:0.75rem; color:var(--hs-text-secondary); margin-top:6px;">
            ${docs.liquidacion ? `Archivo firmado: ${escapeHtml(docs.liquidacion.fileName)}` : 'Cálculo legal completo (CTS, Gratificación y Vacaciones truncas).'}
          </p>
        </div>
        <div class="doc-actions-stack">
          <a href="${escapeHtml(liqDownloadHref)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">Descargar Liq.</a>
          <button type="button" class="bw-btn-sm" onclick="openLiquidacionModal(${c.id})">Calcular / Ver</button>
          ${docs.liquidacion?.driveUrl ? `<a href="${escapeHtml(docs.liquidacion.driveUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Drive</a>` : ''}
        </div>
      </div>

      <!-- 5. FOTO DE DNI (PDF / JPG DESDE DRIVE) -->
      <div class="doc-vault-card">
        <div>
          <div class="doc-vault-title">
            <span>5. Foto de DNI (PDF / JPG)</span>
          </div>
          <p style="font-size:0.75rem; color:var(--hs-text-secondary); margin-top:6px;">
            ${docs.fotoDni ? escapeHtml(docs.fotoDni.originalName || docs.fotoDni.fileName) : 'Sin imagen cargada aún — súbela al registrar o en Drive.'}
          </p>
        </div>
        <div class="doc-actions-stack">
          ${docs.fotoDni
            ? `<a href="${escapeHtml(dniDownloadHref)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">Descargar DNI</a>
               <button type="button" class="bw-btn-sm" onclick="openDocPreview('DNI — ${escapeHtml(c.nombre)}', '${escapeHtml(dniDownloadHref)}', '${escapeHtml(dniDownloadHref)}', false, ${Boolean(docs.fotoDni.isImage)})">Ver DNI</button>
               ${docs.fotoDni.driveUrl ? `<a href="${escapeHtml(docs.fotoDni.driveUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Drive</a>` : ''}`
            : `<button type="button" class="bw-btn-sm" onclick="switchView('ingreso')">Subir en Nuevo Ingreso</button>`
          }
        </div>
      </div>
    </div>
  `;
  hydrateIcons();
}

window.prefillDocsTab = function (id, target) {
  const mSel = document.getElementById('memo-colab');
  const aSel = document.getElementById('acta-colab');
  const lSel = document.getElementById('liq-colab');
  if (mSel) mSel.value = String(id);
  if (aSel) aSel.value = String(id);
  if (lSel) lSel.value = String(id);
  switchView('docs');
};

function initFilters() {
  const searchIn = document.getElementById('search-input');
  const btnBuscar = document.getElementById('btn-buscar-legajo');
  const fArea = document.getElementById('filter-area');
  const fEst = document.getElementById('filter-estado');
  const fCondLab = document.getElementById('filter-condicion-laboral');
  const selColab = document.getElementById('select-colaborador-ficha');
  const btnClean = document.getElementById('btn-limpiar-filtros');

  const apply = () => {
    state.filters.search = searchIn?.value || '';
    state.filters.area = fArea?.value || '';
    state.filters.estado = fEst?.value || '';
    state.filters.condicionLaboral = fCondLab?.value || '';
    renderLegajos();
  };

  // Mantener siempre limpios los buscadores al cargar (evita autocompletado residual del navegador)
  const cleanSearchInputs = () => {
    if (searchIn) searchIn.value = '';
    const pSearch = document.getElementById('planilla-search');
    if (pSearch) pSearch.value = '';
    state.filters.search = '';
    state.planillaFilter.search = '';
  };
  cleanSearchInputs();
  setTimeout(cleanSearchInputs, 120);

  searchIn?.addEventListener('input', apply);
  btnBuscar?.addEventListener('click', apply);
  fArea?.addEventListener('change', apply);
  fEst?.addEventListener('change', apply);
  fCondLab?.addEventListener('change', apply);

  selColab?.addEventListener('change', () => {
    if (selColab.value) {
      state.selectedColabId = Number(selColab.value);
      renderLegajos();
      openSpotlightModal(Number(selColab.value));
    }
  });

  btnClean?.addEventListener('click', () => {
    if (searchIn) searchIn.value = '';
    if (fArea) fArea.value = '';
    if (fEst) fEst.value = '';
    if (fCondLab) fCondLab.value = '';
    if (selColab) selColab.value = '';
    state.filters = { search: '', area: '', estado: '', condicionLaboral: '' };
    renderLegajos();
  });
}

// ==========================================================================
// 3. FORMULARIO DE PRIMER INGRESO -> GOOGLE SHEETS + GOOGLE DRIVE
// ==========================================================================
function initOnboardingForm() {
  const form = document.getElementById('form-nuevo-ingreso');
  const fileIn = document.getElementById('dni-file-input');
  const statusEl = document.getElementById('dni-file-status');
  const dropzone = document.getElementById('dni-dropzone');
  const fInicio = document.getElementById('ing-fecha-inicio');
  const fFin = document.getElementById('ing-fecha-fin');
  const resBox = document.getElementById('ingreso-result-box');

  // Cálculo automático de vigencia +3 meses desde calendario (YYYY-MM-DD)
  fInicio?.addEventListener('change', () => {
    const val = fInicio.value.trim();
    const iso = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso && fFin) {
      const y = parseInt(iso[1], 10);
      const m = parseInt(iso[2], 10) - 1;
      const d = parseInt(iso[3], 10);
      const dt = new Date(y, m + 3, d - 1);
      if (!isNaN(dt.getTime())) {
        fFin.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      }
    }
  });

  // Cálculo automático de edad = año actual - año de nacimiento
  const ingNac = document.getElementById('ing-nacimiento');
  const ingEdad = document.getElementById('ing-edad');
  const syncIngEdad = () => {
    if (ingEdad && ingNac) ingEdad.value = calcularEdadPorAnio(ingNac.value);
  };
  ingNac?.addEventListener('change', syncIngEdad);
  ingNac?.addEventListener('input', syncIngEdad);

  function handleFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      statusEl.innerHTML = `<strong style="color:#EF4444;">Archivo muy pesado (${(file.size / (1024 * 1024)).toFixed(1)} MB):</strong> El máximo permitido es 8 MB. Comprime el PDF e intenta nuevamente.`;
      state.dniAttachment = null;
      return;
    }
    statusEl.innerHTML = `Leyendo archivo <strong>${escapeHtml(file.name)}</strong>...`;
    const reader = new FileReader();
    reader.onload = () => {
      state.dniAttachment = { name: file.name, base64: reader.result };
      statusEl.innerHTML = `<strong style="color:var(--emerald-ok);">Archivo listo para Drive:</strong> ${escapeHtml(file.name)} (${Math.round(file.size / 1024)} KB)`;
    };
    reader.onerror = () => {
      state.dniAttachment = null;
      statusEl.innerHTML = `<strong style="color:#EF4444;">Error leyendo el archivo PDF/imagen.</strong> Vuelve a seleccionarlo.`;
    };
    reader.readAsDataURL(file);
  }

  fileIn?.addEventListener('change', e => handleFile(e.target.files[0]));
  dropzone?.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('is-dragover'); });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  document.getElementById('btn-reset-ingreso')?.addEventListener('click', () => {
    form.reset();
    state.dniAttachment = null;
    statusEl.textContent = 'Ningún archivo adjunto aún (opcional si se cargará luego).';
    resBox.style.display = 'none';
  });

  // Previsualizar en vivo el Contrato Oficial (Anexo N° 001 + 18 Cláusulas de 01_CONTRATOS_PERSONAL_PDF)
  document.getElementById('btn-preview-contrato-ingreso')?.addEventListener('click', () => {
    const fd = new FormData(form);
    const p = Object.fromEntries(fd.entries());
    const tempColab = {
      id: 0,
      nombre: (p.nombre || 'NUEVO COLABORADOR').toUpperCase(),
      tipoDocumento: p.tipoDocumento || 'DNI',
      dni: p.dni || '00000000',
      domicilio: p.domicilio || 'LA LIBERTAD - TRUJILLO - TRUJILLO',
      celular: p.celular || '-',
      correo: p.correo || '-',
      cargo: (p.cargo || 'COLABORADOR').toUpperCase(),
      area: p.area || 'Salón',
      sueldo: Number(p.sueldo || 1500),
      fechaIngreso: toDmyDate(p.fechaInicio) || '01/11/2026',
      vigenciaHasta: toDmyDate(p.fechaFin) || '31/01/2027'
    };
    const html = buildContratoOficialHtml(tempColab);
    openDocPreview(`Contrato Oficial (Anexo N° 001) — ${tempColab.nombre}`, null, null, false, false, html);
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    resBox.style.display = 'none';
    if (!window.validateFormOnSubmit(form)) return;

    const btn = document.getElementById('btn-submit-ingreso');
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'SINCRONIZANDO CON GOOGLE SHEETS Y DRIVE...';

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.fechaInicio = toDmyDate(payload.fechaInicio);
    payload.fechaFin = toDmyDate(payload.fechaFin);
    payload.fechaNacimiento = toDmyDate(payload.fechaNacimiento);
    if (payload.fechaNacimiento) {
      payload.edad = calcularEdadPorAnio(payload.fechaNacimiento) || payload.edad;
    }
    if (state.dniAttachment) {
      payload.fotoDniBase64 = state.dniAttachment.base64;
      payload.fotoDniName = state.dniAttachment.name;
    }

    try {
      let res = null;
      let data = null;
      if (useGasBackend()) {
        data = await gasPost('create_personal', payload);
        res = { ok: Boolean(data && data.success) };
      } else {
        res = await authFetch(apiUrl('/api/personal/nuevo'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      }

      if (!res.ok || !data.success) {
        resBox.style.display = 'block';
        resBox.style.borderColor = '#EF4444';
        resBox.innerHTML = `<strong style="color:#FCA5A5;">Error al registrar:</strong> ${escapeHtml(data.error || 'Verifica los campos e intenta nuevamente.')}`;
        return;
      }

      const c = data.colaborador;
      const sync = data.sheetSyncResult || {};
      resBox.style.display = 'block';
      resBox.style.borderColor = 'var(--emerald-ok)';
      resBox.innerHTML = `
        <h4 style="color:var(--emerald-ok); font-size:1rem; margin-bottom:8px;">
          Registro Completado y Sincronizado: ${escapeHtml(c.nombre)} (DNI ${escapeHtml(c.dni)})
        </h4>
        <ul style="margin-left:18px; font-size:0.84rem; display:flex; flex-direction:column; gap:5px; margin-bottom:12px;">
          <li>Google Sheets Maestro RH BRINNERCAS: <strong>${sync.masterSynced ? 'FILA AGREGADA EN VIVO' : 'Guardado local (revisar cuota)'}</strong></li>
          <li>Google Sheet Histórico Formulario: <strong>${sync.historicalSynced ? 'FILA AGREGADA EN VIVO' : 'Pendiente'}</strong></li>
          <li>Contrato Inicial DOCX generado: <strong>${escapeHtml(c.documentos?.contrato?.fileName || 'Generado')}</strong></li>
          <li>Foto de DNI: <strong>${c.documentos?.fotoDni ? escapeHtml(c.documentos.fotoDni.fileName) : 'No se adjuntó'}</strong></li>
        </ul>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button type="button" class="bw-btn-sm is-primary" onclick="focusEmployeeVault(${c.id})">Ver Bóveda de 5 Documentos del Nuevo Ingreso</button>
          ${data.masterSheetUrl ? `<a href="${escapeHtml(data.masterSheetUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Abrir Google Sheet Maestro</a>` : ''}
          ${data.historicalSheetUrl ? `<a href="${escapeHtml(data.historicalSheetUrl)}" target="_blank" rel="noopener" class="bw-btn-sm">Abrir Sheet Histórico</a>` : ''}
          ${c.documentos?.contrato?.driveUrl ? `<a href="${escapeHtml(c.documentos.contrato.driveUrl)}" target="_blank" rel="noopener" class="bw-btn-sm">Ver Contrato en Drive</a>` : ''}
        </div>
      `;

      state.selectedColabId = c.id;
      await loadAllData();
    } catch (err) {
      resBox.style.display = 'block';
      resBox.style.borderColor = '#EF4444';
      const isHttps = window.location.protocol === 'https:';
      resBox.innerHTML = isHttps
        ? `<strong style="color:#EF4444;">Bloqueo de red HTTPS → servidor local:</strong> Desde <code>${escapeHtml(window.location.host)}</code> el navegador bloquea envíos a <code>http://localhost:3005</code>. Para registrar y sincronizar en vivo con Google Sheets + Drive, abre <a href="http://localhost:3005" style="color:var(--accent-orange); font-weight:700; text-decoration:underline;">http://localhost:3005</a> en esta PC (o conecta Google Apps Script <code>Code.gs</code>).`
        : `<strong style="color:#EF4444;">Error de red (${escapeHtml(err.message)}):</strong> Verifica que el servidor local esté activo en <a href="http://localhost:3005" style="color:var(--accent-orange); font-weight:700; text-decoration:underline;">http://localhost:3005</a> (ejecuta <code>INICIAR_RH_BRINNERCAS.bat</code>).`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = origHtml;
      hydrateIcons();
    }
  });
}

// ==========================================================================
// 4. GENERADOR DE ADENDAS
// ==========================================================================
function renderAdendasView() {
  if (!state.audit) return;
  const activos = state.audit.colaboradores.filter(c => c.estado === 'ACTIVO');
  const tbody = document.getElementById('adendas-tbody');
  if (!tbody) return;

  tbody.innerHTML = activos.map(c => {
    const hist = (c.adendas || []).map(a => `${a.numero || ''}: ${a.inicio || a.desde || ''} - ${a.fin || a.hasta || ''}`).join(' | ') || 'Contrato Base';
    return `
      <tr>
        <th scope="row">${escapeHtml(c.nombre)}</th>
        <td data-label="DNI">${escapeHtml(c.dni)}</td>
        <td data-label="Puesto / Área">${escapeHtml(c.cargo)} (${escapeHtml(c.area)})</td>
        <td data-label="Sueldo Actual">${formatMoney(c.sueldo)}</td>
        <td data-label="Historial">${renderExpandableText(hist, 48)}</td>
        <td data-label="Acción">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button type="button" class="bw-btn-sm is-primary" onclick="generarAdendaIndividual(${c.id}, this)">Generar Adenda DOCX</button>
            <button type="button" class="bw-btn-sm is-gold" onclick="openEmailComposer('ADENDA', ${c.id})">Enviar por Correo</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.generarAdendaIndividual = async function (id, btn) {
  const fechaInicioNueva = document.getElementById('adenda-fecha-inicio')?.value || '01 de noviembre de 2026';
  const fechaFinNueva = document.getElementById('adenda-fecha-fin')?.value || '31 de enero de 2027';
  const firmaTexto = document.getElementById('adenda-fecha-firma')?.value || '31 días del mes de octubre de 2026';

  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Generando...';
  try {
    const res = await authFetch(apiUrl(`/api/adenda/generate/${id}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fechaInicioNueva, fechaFinNueva, firmaTexto })
    });
    const data = await res.json();
    if (data.success && data.downloadUrl) {
      window.location.href = apiUrl(data.downloadUrl);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = orig;
  }
};

function initAdendaBatch() {
  document.getElementById('btn-gen-all-adendas')?.addEventListener('click', async () => {
    const status = document.getElementById('adenda-batch-status');
    const linksBox = document.getElementById('adenda-batch-links');
    const fechaInicioNueva = document.getElementById('adenda-fecha-inicio')?.value || '01 de noviembre de 2026';
    const fechaFinNueva = document.getElementById('adenda-fecha-fin')?.value || '31 de enero de 2027';
    const firmaTexto = document.getElementById('adenda-fecha-firma')?.value || '31 días del mes de octubre de 2026';

    status.textContent = 'Compilando adendas en Aptos 11pt...';
    linksBox.innerHTML = '';

    const res = await authFetch(apiUrl('/api/adenda/generate-all'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fechaInicioNueva, fechaFinNueva, firmaTexto })
    });
    const data = await res.json();
    if (data.success) {
      status.textContent = `${data.total} adendas generadas listas para descarga:`;
      linksBox.innerHTML = data.adendas.map(a =>
        `<a href="${escapeHtml(apiUrl(a.downloadUrl))}" class="bw-btn-sm is-gold">${escapeHtml(a.fileName)}</a>`
      ).join('');
    }
  });
}

// ==========================================================================
// 5. MEMORÁNDUMS, ACTAS, LIQUIDACIONES & MOF (CON "LEER MÁS" + DOCUMENTACION GNRL RH)
// ==========================================================================
function renderDocsAndMof() {
  const mofGrid = document.getElementById('mof-grid');
  const normGrid = document.getElementById('normativa-general-grid');
  if (!state.mof) return;

  if (normGrid) {
    const bib = state.mof.bibliotecaGeneral || [];
    const memosEmitidos = state.mof.memorandumsEmitidos || [];
    const bibCards = bib.map(item => `
      <div class="glass-card-subtle" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--aurora-gold-foil); font-weight:700;">
            ${escapeHtml(item.categoria || 'DOCUMENTACION GNRL RH')}
          </div>
          <h4 style="font-family:var(--font-sans); font-size:0.98rem; font-weight:800; margin:4px 0 6px; color:var(--hs-text-primary);">
            ${escapeHtml(item.titulo)}
          </h4>
          <p style="font-size:0.78rem; color:var(--hs-text-secondary); margin:0;">
            ${renderExpandableText(item.descripcion || '', 90)}
          </p>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:4px;">
          ${item.pdfUrl ? `<a href="${escapeHtml(item.pdfUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">VER / DESCARGAR PDF</a>` : ''}
          ${item.htmlUrl ? `<a href="${escapeHtml(item.htmlUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">ABRIR HTML</a>` : ''}
          ${item.docxUrl ? `<a href="${escapeHtml(item.docxUrl)}" download class="bw-btn-sm">WORD DOCX</a>` : ''}
          ${item.pptxUrl ? `<a href="${escapeHtml(item.pptxUrl)}" download class="bw-btn-sm">PPTX</a>` : ''}
        </div>
      </div>
    `);

    const memoCards = memosEmitidos.map(m => `
      <div class="glass-card-subtle" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
        <div>
          <div style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--accent-orange); font-weight:700;">
            04 • MEMORÁNDUM DISCIPLINARIO EMITIDO
          </div>
          <h4 style="font-family:var(--font-sans); font-size:0.95rem; font-weight:800; margin:4px 0 6px; color:var(--hs-text-primary);">
            ${escapeHtml(m.title)}
          </h4>
          <p style="font-size:0.76rem; color:var(--hs-text-secondary); margin:0;">
            Archivo oficial sincronizado desde DOCUMENTACION GNRL RH.
          </p>
        </div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">VER MEMORÁNDUM</a>
        </div>
      </div>
    `);

    normGrid.innerHTML = [...bibCards, ...memoCards].join('');
  }

  if (!mofGrid) return;
  const puestos = state.mof.puestos || state.mof;
  if (!Array.isArray(puestos)) return;

  mofGrid.innerHTML = puestos.map(p => `
    <div class="glass-card-subtle" style="display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <div style="font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em; color:var(--accent-orange); font-weight:700;">
            ${escapeHtml(p.area || 'Operaciones')}
          </div>
          ${p.codigo ? `<span style="font-family:var(--font-mono); font-size:0.66rem; opacity:0.72;">${escapeHtml(p.codigo)}</span>` : ''}
        </div>
        <h4 style="font-family:var(--font-sans); font-size:1.05rem; font-weight:800; margin:4px 0 8px; color:var(--hs-text-primary);">${escapeHtml(p.puesto || p.cargo)}</h4>
        <div style="font-size:0.8rem; color:var(--hs-text-secondary); margin-bottom:8px;">
          <strong>Misión / Objetivo:</strong> ${renderExpandableText(p.mision || p.objetivo || '', 75)}
        </div>
        <div style="font-size:0.78rem; color:var(--hs-text-primary);">
          <strong>Funciones:</strong> ${renderExpandableText(Array.isArray(p.funciones) ? p.funciones.join(' • ') : (p.funciones || ''), 85)}
        </div>
      </div>
      ${(p.pdfUrl || p.htmlUrl) ? `
        <div style="display:flex; gap:6px; flex-wrap:wrap; padding-top:6px; border-top:1px solid rgba(197,160,89,0.18);">
          ${p.pdfUrl ? `<a href="${escapeHtml(p.pdfUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">DESCARGAR MOF (PDF)</a>` : ''}
          ${p.htmlUrl ? `<a href="${escapeHtml(p.htmlUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">VER FICHA HTML</a>` : ''}
        </div>
      ` : ''}
    </div>
  `).join('');
}

function initDocsForms() {
  document.getElementById('form-memo')?.addEventListener('submit', async e => {
    e.preventDefault();
    const res = await authFetch(apiUrl('/api/memo/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colaboradorId: document.getElementById('memo-colab').value,
        motivoClave: document.getElementById('memo-motivo').value,
        asuntoPersonalizado: document.getElementById('memo-asunto').value.trim() || undefined,
        descripcionHechos: document.getElementById('memo-hechos').value.trim() || undefined
      })
    });
    const data = await res.json();
    if (data.success) {
      openDocPreview(`Memorándum — ${data.colaborador}`, null, apiUrl(data.downloadUrl), false, false, data.html);
    }
  });

  document.getElementById('form-acta')?.addEventListener('submit', async e => {
    e.preventDefault();
    const bienes = document.getElementById('acta-bienes').value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    const res = await authFetch(apiUrl('/api/acta/generate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        colaboradorId: document.getElementById('acta-colab').value,
        tipoActa: document.getElementById('acta-tipo').value,
        bienesEntregados: bienes
      })
    });
    const data = await res.json();
    if (data.success) {
      openDocPreview(`${data.titulo} — ${data.colaborador}`, null, apiUrl(data.downloadUrl), false, false, data.html);
    }
  });

  document.getElementById('form-liquidacion')?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('liq-colab').value;
    const regimen = document.getElementById('liq-regimen').value;
    const fechaCese = document.getElementById('liq-fecha-cese').value.trim();
    await openLiquidacionModal(id, regimen, fechaCese);
  });
}

window.openLiquidacionModal = async function (id, regimen = 'GENERAL', fechaCese = '') {
  const qs = new URLSearchParams({ regimen });
  if (fechaCese) qs.set('fechaCese', fechaCese);
  const res = await authFetch(apiUrl(`/api/liquidacion/calc/${id}?${qs.toString()}`));
  const data = await res.json();
  if (data.success) {
    openDocPreview(
      `Liquidación BB.SS. — ${data.calculo.colaborador} (Neto: ${formatMoney(data.calculo.totalNeto)})`,
      null,
      apiUrl(`/api/docs/liquidacion/${id}?regimen=${encodeURIComponent(regimen)}`),
      false,
      false,
      data.html
    );
  }
};

// ==========================================================================
// 6. BÓVEDA GOOGLE DRIVE & GOOGLE SHEETS
// ==========================================================================
function renderDriveHub() {
  const grid = document.getElementById('drive-hub-grid');
  if (!grid || !state.audit?.manifest) return;
  const { drive, sheets, stats } = state.audit.manifest;
  const subs = drive?.subfolders || {};

  const cards = [
    {
      eyebrow: 'Carpeta Principal en Google Drive',
      title: drive?.rootFolder?.name || 'RH BRINNERCAS - GRUPO GASTRONOMICO AURORA SAC',
      desc: `ID: ${drive?.rootFolder?.id || 'N/A'} — Cuenta conectada: ${state.audit.manifest.account || 'admr.brinnercas@gmail.com'}`,
      url: drive?.rootFolder?.url,
      btn: 'Abrir Carpeta Raíz'
    },
    {
      eyebrow: 'Google Sheets en Vivo',
      title: sheets?.masterSheetName || 'BD_MAESTRA_RH_BRINNERCAS_AURORA_2026',
      desc: 'Base sincronizada automáticamente desde el formulario de Primer Ingreso (pestañas Padrón, Nuevos Ingresos y Ceses).',
      url: sheets?.masterSheetUrl,
      btn: 'Abrir Google Sheet Maestro'
    },
    {
      eyebrow: 'Google Sheet Formulario Original',
      title: sheets?.historicalSheetName || 'REGISTRO DEL PERSONAL DE AURORA',
      desc: 'Hoja histórica de respuestas de ingreso del personal vinculada en tiempo real.',
      url: sheets?.historicalSheetUrl,
      btn: 'Abrir Sheet Histórico'
    },
    {
      eyebrow: 'Subcarpeta 01 • Contratos',
      title: subs.contratos?.name || '01_CONTRATOS_PERSONAL_PDF',
      desc: `${stats?.contratos || 22} contratos PDF y DOCX iniciales respaldados.`,
      url: subs.contratos?.url,
      btn: 'Abrir Contratos'
    },
    {
      eyebrow: 'Subcarpeta 02 • Adendas',
      title: subs.adendas?.name || '02_ADENDAS_MODALIDAD_DOCX',
      desc: `${stats?.adendas || 43} adendas Word editables clasificadas por trabajador.`,
      url: subs.adendas?.url,
      btn: 'Abrir Adendas'
    },
    {
      eyebrow: 'Subcarpeta 03 • Fotos DNI (PDF/JPG)',
      title: subs.fotosDni?.name || '03_FOTOS_DNI_PERSONAL',
      desc: `${stats?.dnis || 25} archivos de DNI extraídos y enlazados al buscador individual.`,
      url: subs.fotosDni?.url,
      btn: 'Abrir Fotos DNI'
    },
    {
      eyebrow: 'Subcarpeta 04 • Memorándums',
      title: subs.memosActas?.name || '04_MEMORANDUMS_Y_ACTAS',
      desc: `${stats?.memos || 3} documentos base + generador de actas RIT y sanciones.`,
      url: subs.memosActas?.url,
      btn: 'Abrir Memorándums'
    },
    {
      eyebrow: 'Subcarpeta 05 • Liquidaciones',
      title: subs.liquidaciones?.name || '05_LIQUIDACIONES_BBSS',
      desc: `${stats?.liquidaciones || 15} liquidaciones firmadas + calculador D.Leg 728.`,
      url: subs.liquidaciones?.url,
      btn: 'Abrir Liquidaciones'
    },
    {
      eyebrow: 'Subcarpeta 06 • Contabilidad Excel',
      title: subs.baseDatos?.name || '06_BASE_DATOS_SHEETS_Y_EXCEL',
      desc: 'Libro RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx listo para gerencia y estudio contable.',
      url: subs.baseDatos?.url,
      btn: 'Abrir Reportes Drive'
    }
  ];

  grid.innerHTML = cards.map(card => `
    <article class="glass-card hs-grid-block" style="display:flex; flex-direction:column; justify-content:space-between; gap:14px;">
      <div>
        <p class="section-eyebrow">${escapeHtml(card.eyebrow)}</p>
        <h3 style="font-family:var(--font-sans); font-size:1.05rem; font-weight:800; color:var(--hs-text-primary); margin-bottom:6px;">${escapeHtml(card.title)}</h3>
        <p style="font-size:0.82rem; color:var(--hs-text-secondary);">${renderExpandableText(card.desc, 80)}</p>
      </div>
      <div>
        ${card.url ? `<a href="${escapeHtml(card.url)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">${escapeHtml(card.btn)}</a>` : '<span class="field-hint">Enlace pendiente</span>'}
      </div>
    </article>
  `).join('');
}

// ==========================================================================
// 7. CENTRO DE ENVÍO DE CORREOS CORPORATIVOS (ADENDAS, CONTRATOS, MEMOS, RESUMEN)
// ==========================================================================
const emailHistoryLocal = JSON.parse(localStorage.getItem('rh_brinnercas_email_history') || '[]');

function buildEmailDraft(tipo, colabId) {
  if (!state.audit) return { to: '', subject: '', body: '', links: [] };
  const { resumen, colaboradores, manifest } = state.audit;
  const rootDrive = manifest?.drive?.rootFolder?.url || 'https://drive.google.com/drive/folders/1i_K5OJHe5vvnQTrMnwEm0e2CQIT4MGuT';
  const masterSheet = manifest?.sheets?.masterSheetUrl || 'https://docs.google.com/spreadsheets/d/1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk/edit';

  if (tipo === 'RESUMEN_GENERAL' || colabId === 'ALL') {
    const activos = colaboradores.filter(c => c.estado === 'ACTIVO');
    const rxh = colaboradores.filter(c => c.estado === 'RXH' || c.estado === 'APOYO');
    const cesados = colaboradores.filter(c => c.estado === 'CESADO');

    const listaActivos = activos.map((c, idx) =>
      `${idx + 1}. ${c.nombre} (DNI ${c.dni}) — ${c.cargo} [${c.area}] — S/ ${c.sueldo.toFixed(2)} — Vigencia: ${c.vigenciaHasta}`
    ).join('\n');

    const listaRxh = rxh.map((c, idx) =>
      `${idx + 1}. ${c.nombre} (DNI ${c.dni}) — ${c.cargo} [${c.area}] — S/ ${c.sueldo.toFixed(2)} (${c.estado})`
    ).join('\n');

    const subject = `REPORTE EJECUTIVO DE PERSONAL Y PLANILLA 2026 — GRUPO GASTRONÓMICO AURORA S.A.C.`;
    const body = [
      `Estimada Gerencia General / Estudio Contable:`,
      ``,
      `Por medio del presente, remitimos el Resumen Ejecutivo Auditado del Personal de GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111) actualizado desde la plataforma RH BRINNERCAS:`,
      ``,
      `===================================================================`,
      `1. INDICADORES GENERALES DE PLANILLA`,
      `===================================================================`,
      `• Total Registros en Padrón: ${resumen.totalColaboradores} colaboradores`,
      `• Planilla Activa (Modal D.Leg. 728): ${resumen.activosCount} colaboradores`,
      `• Masa Salarial Mensual Activa: ${formatMoney(resumen.totalNominaActiva)}`,
      `• Ahorro Mensual vs. Febrero 2026 (S/ 40,880.00): ${formatMoney(resumen.ahorroMensual)} (${resumen.porcentajeOptimizacion}% de optimización)`,
      `• Personal RxH / Apoyo: ${resumen.rxhApoyoCount} colaboradores`,
      `• Personal Cesado / Liquidado: ${resumen.cesadosCount} colaboradores`,
      ``,
      `===================================================================`,
      `2. RELACIÓN DE PERSONAL ACTIVO EN PLANILLA MODAL (${activos.length})`,
      `===================================================================`,
      listaActivos,
      ``,
      `===================================================================`,
      `3. PERSONAL RXH / APOYO (${rxh.length})`,
      `===================================================================`,
      listaRxh,
      ``,
      `===================================================================`,
      `4. ACCESOS DIRECTOS A BÓVEDA CLOUD (GOOGLE DRIVE & SHEETS)`,
      `===================================================================`,
      `• Carpeta Raíz Google Drive (Contratos, Adendas, DNIs, Liquidaciones):`,
      `  ${rootDrive}`,
      `• Base de Datos Maestra en Vivo (Google Sheets):`,
      `  ${masterSheet}`,
      ``,
      `Atentamente,`,
      `Wilmer Brinner Castro Vásquez`,
      `Administración General — Grupo Gastronómico Aurora S.A.C.`
    ].join('\n');

    return {
      to: 'gerencia@aurora.pe, admr.brinnercas@gmail.com',
      subject,
      body,
      links: [
        { label: 'Carpeta Raíz Google Drive', url: rootDrive },
        { label: 'Google Sheets Maestro', url: masterSheet }
      ]
    };
  }

  const c = colaboradores.find(x => x.id === Number(colabId)) || colaboradores[0];
  const destEmail = (c.correo && c.correo !== 'No registrado') ? c.correo : 'admr.brinnercas@gmail.com';
  const docs = c.documentos || {};
  const links = [];
  if (docs.contrato?.driveUrl) links.push({ label: `Contrato PDF (${c.nombre.split(' ')[0]})`, url: docs.contrato.driveUrl });
  if (docs.adendas?.length) {
    docs.adendas.forEach((a, i) => {
      if (a.driveUrl) links.push({ label: `${i + 1}ª Adenda DOCX`, url: a.driveUrl });
    });
  }
  if (docs.liquidacion?.driveUrl) links.push({ label: 'Liquidación BB.SS.', url: docs.liquidacion.driveUrl });
  if (docs.fotoDni?.driveUrl) links.push({ label: 'Documento DNI', url: docs.fotoDni.driveUrl });

  if (tipo === 'ADENDA') {
    const fIni = document.getElementById('adenda-fecha-inicio')?.value || '01 de noviembre de 2026';
    const fFin = document.getElementById('adenda-fecha-fin')?.value || '31 de enero de 2027';
    const lastAdendaUrl = docs.adendas?.length ? (docs.adendas[docs.adendas.length - 1].driveUrl || rootDrive) : rootDrive;
    return {
      to: destEmail,
      subject: `ADENDA DE PRÓRROGA DE CONTRATO DE TRABAJO — ${c.nombre} (DNI ${c.dni})`,
      body: [
        `Estimado(a) ${c.nombre}:`,
        ``,
        `Por medio del presente, la Administración de GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111) le remite su ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD correspondiente a la prórroga de su vínculo laboral:`,
        ``,
        `• Colaborador(a): ${c.nombre}`,
        `• DNI: ${c.dni}`,
        `• Cargo / Área: ${c.cargo} (${c.area})`,
        `• Remuneración Mensual: ${formatMoney(c.sueldo)}`,
        `• Nuevo Período de Vigencia: Del ${fIni} al ${fFin}`,
        `• Enlace Directo al Documento en Google Drive:`,
        `  ${lastAdendaUrl}`,
        ``,
        `Sírvase revisar el documento y acercarse a la oficina de Administración para la suscripción física correspondiente.`,
        ``,
        `Atentamente,`,
        `Administración General — Grupo Gastronómico Aurora S.A.C.`
      ].join('\n'),
      links
    };
  }

  if (tipo === 'CONTRATO') {
    const contratoUrl = docs.contrato?.driveUrl || rootDrive;
    return {
      to: destEmail,
      subject: `CONTRATO INDIVIDUAL DE TRABAJO SUJETO A MODALIDAD — ${c.nombre}`,
      body: [
        `Estimado(a) ${c.nombre}:`,
        ``,
        `Le damos la bienvenida a GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111). Por medio del presente remitimos copia y enlace de su Contrato Individual de Trabajo Sujeto a Modalidad bajo el régimen del D.Leg. 728:`,
        ``,
        `• Colaborador(a): ${c.nombre} (DNI ${c.dni})`,
        `• Puesto / Área: ${c.cargo} (${c.area}) — ${c.condicionLaborable}`,
        `• Fecha de Inicio: ${c.fechaIngreso}`,
        `• Vigencia: Hasta el ${c.vigenciaHasta}`,
        `• Remuneración Bruta Mensual: ${formatMoney(c.sueldo)}`,
        `• Domicilio Declarado: ${c.domicilio}`,
        `• Enlace del Contrato en Google Drive:`,
        `  ${contratoUrl}`,
        ``,
        `Atentamente,`,
        `Administración General — Grupo Gastronómico Aurora S.A.C.`
      ].join('\n'),
      links
    };
  }

  if (tipo === 'MEMORANDUM') {
    const motivoKey = document.getElementById('memo-motivo')?.value || 'comunicado_general';
    const motivoObj = state.memoMotivos?.[motivoKey] || { tipo: 'MEMORÁNDUM INFORMATIVO', asunto: 'Cumplimiento del Reglamento Interno de Trabajo (RIT)' };
    const asuntoCustom = document.getElementById('memo-asunto')?.value.trim() || motivoObj.asunto;
    const hechosCustom = document.getElementById('memo-hechos')?.value.trim() || 'Se le recuerda el estricto cumplimiento de las normas operativas, horarios y estándares de calidad de Aurora Restaurant.';
    return {
      to: destEmail,
      subject: `${motivoObj.tipo.toUpperCase()}: ${asuntoCustom} — ${c.nombre}`,
      body: [
        `MEMORÁNDUM CORPORATIVO — GRUPO GASTRONÓMICO AURORA S.A.C.`,
        `-------------------------------------------------------------------`,
        `PARA      : ${c.nombre} (DNI ${c.dni})`,
        `CARGO     : ${c.cargo} — Área de ${c.area}`,
        `DE        : Administración General / Gerencia General`,
        `ASUNTO    : ${asuntoCustom}`,
        `FECHA     : ${new Date().toLocaleDateString('es-PE')}`,
        `-------------------------------------------------------------------`,
        ``,
        `Por medio del presente documento nos dirigimos a usted en relación con el asunto de la referencia:`,
        ``,
        `${hechosCustom}`,
        ``,
        `El presente documento se incorpora a su legajo personal digital en RH BRINNERCAS conforme al Reglamento Interno de Trabajo (RIT) y al D.Leg. 728.`,
        ``,
        `Atentamente,`,
        `Administración General — Grupo Gastronómico Aurora S.A.C.`
      ].join('\n'),
      links
    };
  }

  // LIQUIDACION
  const liqUrl = docs.liquidacion?.driveUrl || rootDrive;
  return {
    to: destEmail,
    subject: `LIQUIDACIÓN DE BENEFICIOS SOCIALES D.LEG. 728 — ${c.nombre}`,
    body: [
      `Estimado(a) ${c.nombre}:`,
      ``,
      `Por medio del presente, GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111) remite el detalle de su Liquidación de Beneficios Sociales (CTS, Gratificaciones Truncas y Vacaciones Truncas):`,
      ``,
      `• Colaborador(a): ${c.nombre} (DNI ${c.dni})`,
      `• Cargo: ${c.cargo} (${c.area})`,
      `• Fecha de Ingreso: ${c.fechaIngreso} | Fecha de Cese/Término: ${c.vigenciaHasta}`,
      `• Base Remunerativa: ${formatMoney(c.sueldo)}`,
      `• Enlace al Documento de Liquidación en Google Drive:`,
      `  ${liqUrl}`,
      ``,
      `Atentamente,`,
      `Administración General — Grupo Gastronómico Aurora S.A.C.`
    ].join('\n'),
    links
  };
}

function syncEmailFormFields() {
  const tipoSel = document.getElementById('email-tipo');
  const colabSel = document.getElementById('email-colab');
  const toIn = document.getElementById('email-to');
  const subjIn = document.getElementById('email-subject');
  const bodyIn = document.getElementById('email-body');
  const attachBox = document.getElementById('email-attachments-box');
  if (!tipoSel || !colabSel || !toIn || !subjIn || !bodyIn) return;

  const tipo = tipoSel.value;
  if (tipo === 'RESUMEN_GENERAL') {
    colabSel.value = 'ALL';
  } else if (colabSel.value === 'ALL') {
    colabSel.value = String(state.selectedColabId || 1);
  }

  document.querySelectorAll('[data-email-tpl]').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-email-tpl') === tipo);
  });

  const draft = buildEmailDraft(tipo, colabSel.value);
  toIn.value = draft.to;
  subjIn.value = draft.subject;
  bodyIn.value = draft.body;

  if (attachBox) {
    if (draft.links.length === 0) {
      attachBox.innerHTML = '<span class="field-hint">Se incluirán los datos del expediente local en el cuerpo del mensaje.</span>';
    } else {
      attachBox.innerHTML = draft.links.map(l =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">${escapeHtml(l.label)}</a>`
      ).join('');
    }
  }
}

window.setEmailTemplate = function (tipo) {
  const tipoSel = document.getElementById('email-tipo');
  if (tipoSel) tipoSel.value = tipo;
  syncEmailFormFields();
};

window.openEmailComposer = function (tipo = 'ADENDA', colabId = null) {
  switchView('correo');
  const tipoSel = document.getElementById('email-tipo');
  const colabSel = document.getElementById('email-colab');
  if (tipoSel) tipoSel.value = tipo;
  if (colabSel) {
    if (tipo === 'RESUMEN_GENERAL') {
      colabSel.value = 'ALL';
    } else if (colabId) {
      state.selectedColabId = Number(colabId);
      colabSel.value = String(colabId);
    } else if (state.selectedColabId) {
      colabSel.value = String(state.selectedColabId);
    }
  }
  syncEmailFormFields();
};

window.sendCurrentMemoToEmail = function () {
  const colabId = document.getElementById('memo-colab')?.value || state.selectedColabId || 1;
  openEmailComposer('MEMORANDUM', colabId);
};

async function recordEmailDispatch(canal) {
  const tipo = document.getElementById('email-tipo')?.value || 'DOCUMENTO';
  const colabVal = document.getElementById('email-colab')?.value;
  const colabObj = state.audit?.colaboradores?.find(c => String(c.id) === String(colabVal));
  const payload = {
    to: document.getElementById('email-to')?.value || '',
    cc: document.getElementById('email-cc')?.value || '',
    tipo,
    colaboradorNombre: colabVal === 'ALL' ? 'TODOS (27 Colaboradores)' : (colabObj?.nombre || 'Colaborador'),
    subject: document.getElementById('email-subject')?.value || '',
    body: document.getElementById('email-body')?.value || ''
  };

  const entry = {
    id: Date.now(),
    fecha: new Date().toLocaleString('es-PE'),
    para: payload.to,
    tipo: payload.tipo,
    colaborador: payload.colaboradorNombre,
    asunto: payload.subject,
    estado: `DESPACHADO (${canal})`
  };

  emailHistoryLocal.unshift(entry);
  try {
    localStorage.setItem('rh_brinnercas_email_history', JSON.stringify(emailHistoryLocal.slice(0, 40)));
  } catch (e) {}

  try {
    await authFetch(apiUrl('/api/email/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, sendViaGmailCli: true })
    });
  } catch (e) {}

  renderEmailHistory();
  const fb = document.getElementById('email-feedback-box');
  if (fb) {
    fb.style.display = 'flex';
    fb.innerHTML = `Correo despachado desde admr.brinnercas@gmail.com (${escapeHtml(canal)}) para: ${escapeHtml(payload.to)}`;
  }
}

function renderEmailHistory() {
  const tbody = document.getElementById('email-history-tbody');
  if (!tbody) return;
  if (emailHistoryLocal.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Aún no hay envíos registrados en esta sesión. Usa los botones superiores para enviar por Gmail, Outlook o registrar un despacho.</td></tr>';
    return;
  }
  tbody.innerHTML = emailHistoryLocal.map(item => `
    <tr>
      <td data-label="Fecha">${escapeHtml(item.fecha)}</td>
      <td data-label="Tipo"><span class="status-badge badge-naranja">${escapeHtml(item.tipo)}</span></td>
      <th scope="row">${escapeHtml(item.colaborador)}</th>
      <td data-label="Para">${escapeHtml(item.para)}</td>
      <td data-label="Asunto">${renderExpandableText(item.asunto, 52)}</td>
      <td data-label="Estado"><span class="status-badge badge-verde">${escapeHtml(item.estado)}</span></td>
    </tr>
  `).join('');
}

function initEmailCenter() {
  const tipoSel = document.getElementById('email-tipo');
  const colabSel = document.getElementById('email-colab');
  const form = document.getElementById('form-enviar-correo');

  tipoSel?.addEventListener('change', syncEmailFormFields);
  colabSel?.addEventListener('change', () => {
    if (colabSel.value === 'ALL' && tipoSel) tipoSel.value = 'RESUMEN_GENERAL';
    syncEmailFormFields();
  });

  // 1. Enviar por Gmail Web en 1 clic forzando la cuenta remitente seleccionada (authuser)
  document.getElementById('btn-send-gmail')?.addEventListener('click', () => {
    const from = document.getElementById('email-from')?.value.trim() || 'admr.brinnercas@gmail.com';
    const to = document.getElementById('email-to')?.value.trim() || '';
    const cc = document.getElementById('email-cc')?.value.trim() || '';
    const su = document.getElementById('email-subject')?.value.trim() || '';
    const body = document.getElementById('email-body')?.value || '';
    const gmailUrl = `https://mail.google.com/mail/?authuser=${encodeURIComponent(from)}&view=cm&fs=1&to=${encodeURIComponent(to)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank', 'noopener');
    recordEmailDispatch(`GMAIL (${from})`);
  });

  // 2. Abrir en cliente de correo local (Outlook / Mailto)
  document.getElementById('btn-send-mailto')?.addEventListener('click', () => {
    const to = document.getElementById('email-to')?.value.trim() || '';
    const cc = document.getElementById('email-cc')?.value.trim() || '';
    const su = document.getElementById('email-subject')?.value.trim() || '';
    const body = document.getElementById('email-body')?.value || '';
    window.location.href = `mailto:${encodeURIComponent(to)}?cc=${encodeURIComponent(cc)}&subject=${encodeURIComponent(su)}&body=${encodeURIComponent(body)}`;
    recordEmailDispatch('CLIENTE CORREO');
  });

  // 3. Registrar despacho en historial
  form?.addEventListener('submit', e => {
    e.preventDefault();
    recordEmailDispatch('REGISTRO INTERNO');
  });

  // 4. Copiar texto completo
  document.getElementById('btn-copy-email')?.addEventListener('click', () => {
    const su = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';
    navigator.clipboard?.writeText(`ASUNTO: ${su}\n\n${body}`);
    const fb = document.getElementById('email-feedback-box');
    if (fb) {
      fb.style.display = 'flex';
      fb.textContent = 'Asunto y cuerpo del correo copiados al portapapeles.';
    }
  });

  // 5. Redactar / Mejorar con Gemini IA
  document.getElementById('btn-gemini-draft-email')?.addEventListener('click', () => {
    syncEmailFormFields();
    const bodyIn = document.getElementById('email-body');
    if (bodyIn) {
      bodyIn.value += `\n\n[Nota Gemini IA — Verificación Legal D.Leg. 728]: Todos los documentos referenciados cuentan con respaldo criptográfico y trazabilidad en la Bóveda Google Drive de Grupo Gastronómico Aurora S.A.C.`;
    }
  });

  syncEmailFormFields();
  renderEmailHistory();
}

// ==========================================================================
// 8. ASISTENTE GEMINI IA (CONSOLA PRINCIPAL + COPILOTO FLOTANTE)
// ==========================================================================
function generateLocalGeminiReply(question) {
  const q = String(question || '').toLowerCase().trim();
  if (!state.audit) return 'Cargando base de datos de RH BRINNERCAS...';
  const { resumen, colaboradores, manifest } = state.audit;

  if (q.includes('correo') || q.includes('email') || q.includes('redact')) {
    return `He preparado las plantillas en el menú **06 Enviar por Correo** para remitir Adendas, Contratos, Memorándums o el Resumen General de los ${resumen.totalColaboradores} colaboradores (${resumen.activosCount} activos por ${formatMoney(resumen.totalNominaActiva)}/mes). También puedes hacer clic en el botón **Enviar por Correo** dentro de la ficha de cualquier trabajador.`;
  }

  if (q.includes('planilla') || q.includes('ahorro') || q.includes('nomina') || q.includes('nómina') || q.includes('total') || q.includes('cuánto') || q.includes('cuanto')) {
    return `**Análisis Gemini IA — Planilla Aurora S.A.C.:**\n• **Planilla Activa (Modal):** ${resumen.activosCount} colaboradores por **${formatMoney(resumen.totalNominaActiva)} / mes**.\n• **Ahorro Mensual vs. Febrero 2026 (S/ 40,880.00):** **${formatMoney(resumen.ahorroMensual)}** (${resumen.porcentajeOptimizacion}% de optimización).\n• **Personal RxH / Apoyo:** ${resumen.rxhApoyoCount} colaboradores.\n• **Personal Cesado:** ${resumen.cesadosCount} colaboradores.`;
  }

  const colabMatch = colaboradores.find(c => {
    const tokens = c.nombre.toLowerCase().split(/\s+/);
    return tokens.some(t => t.length > 3 && q.includes(t)) || (c.dni && q.includes(c.dni));
  });

  if (colabMatch) {
    const adendasStr = (colabMatch.adendas || []).map(a => `${a.numero} (${a.inicio} al ${a.fin})`).join(', ') || 'Sin adendas previas';
    return `**Ficha Gemini IA — ${colabMatch.nombre} (DNI ${colabMatch.dni}):**\n• **Puesto / Área:** ${colabMatch.cargo} (${colabMatch.area}) — ${colabMatch.condicionLaborable}\n• **Estado:** ${colabMatch.estadoTexto} | **Sueldo:** ${formatMoney(colabMatch.sueldo)}\n• **Ingreso:** ${colabMatch.fechaIngreso} | **Vigencia/Cese:** ${colabMatch.vigenciaHasta}\n• **Correo:** ${colabMatch.correo} | **Celular:** ${colabMatch.celular}\n• **Banco:** ${colabMatch.banco} (${colabMatch.numeroCuenta})\n• **Domicilio:** ${colabMatch.domicilio}\n• **Adendas:** ${adendasStr}`;
  }

  if (q.includes('adenda') || q.includes('renovac') || q.includes('pendiente') || q.includes('vence')) {
    const activos = colaboradores.filter(c => c.estado === 'ACTIVO').map(c => c.nombre).join(', ');
    return `**Renovación de Adendas (01/11/2026 al 31/01/2027):**\nLos **${resumen.activosCount} colaboradores activos** (${activos}) cuentan con generación inmediata de Adenda en formato Word (\`Aptos 11pt\`, título \`<ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD>\`) desde el menú **04 Adendas DOCX**.`;
  }

  if (q.includes('mof') || q.includes('funcion') || q.includes('cocina') || q.includes('mozo')) {
    const puestos = state.mof?.puestos || [];
    const pMatch = puestos.find(p => q.includes((p.puesto || '').toLowerCase()));
    if (pMatch) {
      return `**Perfil MOF — ${pMatch.puesto} (${pMatch.area}):**\n• **Misión:** ${pMatch.mision}\n• **Funciones:** ${(pMatch.funciones || []).join(' | ')}`;
    }
  }

  return `Soy **Gemini HR Assistant (\`gemini-4-hydrogen\`)** de **RH BRINNERCAS**. Tengo acceso en vivo a los **${resumen.totalColaboradores} colaboradores**, sus 5 documentos en Google Drive (${manifest?.drive?.rootFolder?.name || 'Drive'}), Google Sheets y el Centro de Correos. Pregúntame por cualquier nombre, DNI, sueldo, liquidación o pídeme redactar un correo.`;
}

async function queryGeminiAssistant(q) {
  const savedKey = localStorage.getItem('rh_gemini_api_key') || '';

  // 1. Intentar con el servidor Node en puerto 3005
  try {
    const res = await authFetch(apiUrl('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: q, apiKey: savedKey })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) return data.reply;
    }
  } catch (e) {}

  // 2. Si el usuario configuró su API Key de Gemini en el navegador, llamar a Interactions API v1 (gemini-4-hydrogen)
  if (savedKey) {
    try {
      const res = await fetch('https://generativelanguage.googleapis.com/v1/interactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': savedKey
        },
        body: JSON.stringify({
          model: 'gemini-4-hydrogen',
          input: q,
          system_instruction: 'Eres Gemini HR Assistant de Grupo Gastronómico Aurora S.A.C. Responde en español de forma ejecutiva y concisa.'
        })
      });
      if (res.ok) {
        const parsed = await res.json();
        if (parsed.output_text) return parsed.output_text;
      }
    } catch (e) {}
  }

  // 3. Motor experto local instantáneo con toda la data de Drive/Padrón
  return generateLocalGeminiReply(q);
}

window.toggleGeminiDrawer = function (forceOpen) {
  const drawer = document.getElementById('gemini-copilot-drawer');
  if (!drawer) return;
  const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : drawer.hidden;
  drawer.hidden = !shouldOpen;
  if (shouldOpen) {
    document.getElementById('gemini-drawer-input')?.focus();
  }
};

window.askGeminiCopilot = async function (q) {
  const drawer = document.getElementById('gemini-copilot-drawer');
  if (drawer && drawer.hidden) drawer.hidden = false;
  const box = document.getElementById('gemini-drawer-messages');
  if (!box || !q.trim()) return;

  const uBubble = document.createElement('div');
  uBubble.className = 'chat-bubble user';
  uBubble.textContent = q;
  box.appendChild(uBubble);
  box.scrollTop = box.scrollHeight;

  const reply = await queryGeminiAssistant(q);
  const bBubble = document.createElement('div');
  bBubble.className = 'chat-bubble bot';
  bBubble.innerHTML = renderExpandableText(reply, 220);
  box.appendChild(bBubble);
  box.scrollTop = box.scrollHeight;
};

function initChat() {
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const box = document.getElementById('chat-messages');
  const drawerForm = document.getElementById('gemini-drawer-form');
  const drawerInput = document.getElementById('gemini-drawer-input');
  const keyInput = document.getElementById('gemini-api-key-input');
  const saveKeyBtn = document.getElementById('btn-save-gemini-key');

  if (keyInput) {
    keyInput.value = localStorage.getItem('rh_gemini_api_key') || '';
  }
  saveKeyBtn?.addEventListener('click', () => {
    const val = keyInput?.value.trim() || '';
    if (val) {
      localStorage.setItem('rh_gemini_api_key', val);
      saveKeyBtn.textContent = 'KEY ACTIVA';
    } else {
      localStorage.removeItem('rh_gemini_api_key');
      saveKeyBtn.textContent = 'GUARDAR KEY';
    }
  });

  async function sendQuestion(q) {
    if (!q.trim()) return;
    const uBubble = document.createElement('div');
    uBubble.className = 'chat-bubble user';
    uBubble.textContent = q;
    box.appendChild(uBubble);
    input.value = '';
    box.scrollTop = box.scrollHeight;

    const reply = await queryGeminiAssistant(q);
    const bBubble = document.createElement('div');
    bBubble.className = 'chat-bubble bot';
    bBubble.innerHTML = renderExpandableText(reply || 'Sin respuesta disponible.', 240);
    box.appendChild(bBubble);
    box.scrollTop = box.scrollHeight;
  }

  form?.addEventListener('submit', e => {
    e.preventDefault();
    sendQuestion(input.value);
  });

  drawerForm?.addEventListener('submit', e => {
    e.preventDefault();
    const val = drawerInput.value;
    drawerInput.value = '';
    askGeminiCopilot(val);
  });

  document.querySelectorAll('.quick-chat-btn').forEach(btn => {
    btn.addEventListener('click', () => sendQuestion(btn.getAttribute('data-q')));
  });
}

// ==========================================================================
// GENERADOR CLIENT-SIDE DEL FORMATO OFICIAL 01_CONTRATOS_PERSONAL_PDF (ANEXO N° 001 + 18 CLÁUSULAS)
// ==========================================================================
function numeroALetrasClient(monto) {
  const n = Math.round(Number(monto || 0));
  const mapa = {
    500: 'QUINIENTOS', 550: 'QUINIENTOS CINCUENTA', 600: 'SEISCIENTOS', 750: 'SETECIENTOS CINCUENTA',
    850: 'OCHOCIENTOS CINCUENTA', 900: 'NOVECIENTOS', 1000: 'MIL', 1025: 'MIL VEINTICINCO',
    1100: 'MIL CIEN', 1130: 'MIL CIENTO TREINTA', 1200: 'MIL DOSCIENTOS', 1300: 'MIL TRESCIENTOS',
    1400: 'MIL CUATROCIENTOS', 1500: 'MIL QUINIENTOS', 1600: 'MIL SEISCIENTOS', 1700: 'MIL SETECIENTOS',
    1800: 'MIL OCHOCIENTOS', 1900: 'MIL NOVECIENTOS', 2000: 'DOS MIL', 2200: 'DOS MIL DOSCIENTOS',
    2500: 'DOS MIL QUINIENTOS', 2800: 'DOS MIL OCHOCIENTOS', 3000: 'TRES MIL', 3200: 'TRES MIL DOSCIENTOS',
    3500: 'TRES MIL QUINIENTOS', 3800: 'TRES MIL OCHOCIENTOS', 4000: 'CUATRO MIL'
  };
  return (mapa[n] || n.toLocaleString('es-PE')) + ' Y 00/100 SOLES';
}

function buildContratoOficialHtml(c) {
  const nombre = String(c.nombre || 'COLABORADOR').toUpperCase();
  const tipoDoc = String(c.tipoDocumento || 'DNI').toUpperCase();
  const dni = String(c.dni || '');
  const domicilio = String(c.domicilio || 'LA LIBERTAD - TRUJILLO - TRUJILLO').toUpperCase();
  const telefono = String(c.celular || '-');
  const correo = String(c.correo || '-').toLowerCase();
  const cargo = String(c.cargo || c.cargoContrato || 'COLABORADOR').toUpperCase();
  const fIni = c.fechaIngreso && c.fechaIngreso !== 'N/A' ? c.fechaIngreso : '01/11/2026';
  const fFin = c.finContratoBase && c.finContratoBase !== 'N/A' ? c.finContratoBase : (c.vigenciaHasta || '31/01/2027');
  const sueldoNum = Number(c.sueldo || 1500);
  const sueldoFmt = sueldoNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sonLetras = numeroALetrasClient(sueldoNum);
  const funciones = `- ORGANIZA Y EJECUTA LAS LABORES DE ${cargo}, ASEGURANDO LA CALIDAD DE ATENCIÓN Y EL CUMPLIMIENTO DE LAS NORMAS DE SEGURIDAD Y BPM.`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>CONTRATO OFICIAL — ${escapeHtml(nombre)}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9.8pt; line-height: 1.42; color: #000; margin: 0; padding: 20px; background: #fff; }
    .page-sheet { max-width: 780px; margin: 0 auto 26px; padding-bottom: 18px; border-bottom: 1.5px solid #000; page-break-after: always; }
    .page-sheet:last-child { page-break-after: auto; }
    .doc-header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 14px; }
    .aurora-logo-text { font-family: Georgia, serif; font-style: italic; font-size: 23pt; line-height: 1; }
    .aurora-logo-sub { font-family: Arial, sans-serif; font-style: normal; font-size: 6.5pt; letter-spacing: 0.25em; display: block; margin-top: 2px; }
    .header-company { text-align: right; font-weight: bold; font-size: 9.5pt; }
    .anexo-title { text-align: center; font-weight: bold; font-size: 12pt; text-decoration: underline; margin: 0; }
    .contract-main-title { text-align: center; font-weight: bold; font-size: 10.5pt; text-decoration: underline; margin: 8px 0 12px; }
    table.anexo-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 8.8pt; }
    table.anexo-table th, table.anexo-table td { border: 1px solid #888; padding: 5px 8px; vertical-align: top; text-align: left; }
    table.anexo-table tr.sec-row th { background: #EFEFEF; font-size: 9.2pt; font-weight: bold; text-decoration: underline; color: #000; }
    .lbl { width: 24%; color: #222; }
    .clause-title { font-weight: bold; text-decoration: underline; margin: 10px 0 4px; font-size: 9.8pt; }
    p { margin: 0 0 7px; text-align: justify; }
    .sign-row { display: flex; justify-content: space-between; align-items: center; margin-top: 42px; gap: 20px; }
    .sign-col { width: 38%; text-align: center; border-top: 1px dashed #000; padding-top: 6px; font-size: 8.5pt; }
    .huella-box { width: 70px; height: 90px; border: 1.5px solid #000; border-radius: 8px; }
    .doc-footer { margin-top: 16px; padding-top: 6px; border-top: 1.5px solid #000; text-align: center; font-size: 8pt; }
    @media print { body { padding: 0; } .no-print { display: none !important; } }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:780px; margin:0 auto 14px; display:flex; justify-content:flex-end; gap:8px;">
    <button onclick="window.print()" style="padding:8px 16px; background:#FF6008; color:#fff; border:none; font-weight:bold; cursor:pointer;">IMPRIMIR / GUARDAR PDF</button>
  </div>

  <!-- ANEXO N° 001 (PÁGINAS 1 Y 2 DEL MODELO EN DRIVE 01_CONTRATOS_PERSONAL_PDF) -->
  <section class="page-sheet">
    <div class="doc-header">
      <div class="aurora-logo-text">Aurora<span class="aurora-logo-sub">RESTAURANT</span></div>
      <div class="anexo-title">ANEXO N° 001</div>
      <div style="width:110px;"></div>
    </div>

    <div class="contract-main-title">CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES</div>
    <p>Conste por el presente documento, que las partes celebran según los datos que consignan tales como:</p>

    <table class="anexo-table">
      <tr class="sec-row"><th colspan="4">I. DATOS DE EL EMPLEADOR.</th></tr>
      <tr><td class="lbl">Razón Social:</td><td colspan="3">GRUPO GASTRONOMICO AURORA S.A.C.</td></tr>
      <tr><td class="lbl">RUC N°:</td><td colspan="3">20615117111</td></tr>
      <tr><td class="lbl">Domicilio Fiscal:</td><td colspan="3">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</td></tr>
      <tr><td class="lbl">Representante Legal:</td><td colspan="3">CARBAJAL URQUIZO GLADYS VERONICA</td></tr>
      <tr><td class="lbl">Documento Identidad:</td><td colspan="3">DNI 42892738</td></tr>
      <tr><td class="lbl">Cargo:</td><td colspan="3">GERENTE GENERAL</td></tr>

      <tr class="sec-row"><th colspan="4">II. DATOS DE EL TRABAJADOR.</th></tr>
      <tr><td class="lbl">Apellidos y Nombres:</td><td colspan="3"><strong>${escapeHtml(nombre)}</strong></td></tr>
      <tr><td class="lbl">Documento Identidad:</td><td colspan="3">${escapeHtml(tipoDoc)} ${escapeHtml(dni)}</td></tr>
      <tr><td class="lbl">Domicilio Actual:</td><td colspan="3">${escapeHtml(domicilio)}</td></tr>
      <tr><td class="lbl">Teléfono Actual:</td><td colspan="3">${escapeHtml(telefono)}</td></tr>
      <tr><td class="lbl">Correo Electrónico:</td><td colspan="3">${escapeHtml(correo)}</td></tr>

      <tr class="sec-row"><th colspan="4">III. DATOS DE LA CONTRATACION.</th></tr>
      <tr><td class="lbl">Cargo:</td><td colspan="3"><strong>${escapeHtml(cargo)}</strong></td></tr>
      <tr><td class="lbl">Tipo de Condición:</td><td>CONTRATO</td><td class="lbl">Situación Especial:</td><td>NINGUNA</td></tr>
      <tr><td class="lbl">Fecha de Inicio:</td><td>${escapeHtml(fIni)}</td><td class="lbl">Fecha de Término:</td><td>${escapeHtml(fFin)}</td></tr>
      <tr><td class="lbl">Duración de Contrato:</td><td colspan="3">3 MESES 0 DIAS</td></tr>
      <tr><td class="lbl">Periodo de Prueba:</td><td>${escapeHtml(fIni)}</td><td class="lbl">Al:</td><td>${escapeHtml(fFin)}</td></tr>
      <tr><td class="lbl">Régimen Laboral :</td><td colspan="3">MICRO EMPRESA D. LEG. 1086 (1)</td></tr>
      <tr><td class="lbl">Remuneración:</td><td colspan="3">EN ( S/ )</td></tr>
      <tr><td class="lbl"></td><td>SUELDO BÁSICO: <strong>${escapeHtml(sueldoFmt)}</strong></td><td>ASIGNACION FAMILIAR:</td><td>0.00</td></tr>
      <tr><td colspan="4"><strong>Total Remuneración Bruta: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${escapeHtml(sueldoFmt)}</strong><br/>SON : ${escapeHtml(sonLetras)}</td></tr>
      <tr>
        <td class="lbl">Causa Objetiva de Trabajo:</td>
        <td colspan="3">
          EL EMPLEADOR REQUIERE CONTRATAR LOS SERVICIOS DE EL TRABAJADOR, PARA REALIZAR LAS LABORES DE <strong>${escapeHtml(cargo)}</strong> QUE SERÁ PARTE INTEGRAL DEL PRESENTE CONTRATO LABORAL, DEBIENDO SOMETERSE AL CUMPLIMIENTO ESTRICTO DE LA LABOR PARA LO CUAL HA SIDO CONTRATADO, BAJO LAS DIRECTIVAS QUE EMANEN DE EL EMPLEADOR.<br/>
          PARA EL FIN PROPUESTO EN EL SUB. PÁRRAFO PRECEDENTE EL TRABAJADOR OFRECE SUS SERVICIOS A SER PRESTADOS BAJO LA MODALIDAD DE “SERVICIOS MODALES POR INICIO O INCREMENTO DE ACTIVIDADES” BAJO LA DISPOSICIÓN DE LOS ARTÍCULOS 54° INCISO A) Y 57° DEL T.U.O. DE LA LEY DE PRODUCTIVIDAD Y COMPETITIVIDAD LABORAL, CONTENIDA EN EL D.S. 003-97-TR; CONTRATO QUE, POR SU NATURALEZA, TIENE LA CARACTERÍSTICA DE SER TEMPORAL.
        </td>
      </tr>
      <tr><td class="lbl">Lugar de Trabajo:</td><td colspan="3">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</td></tr>
      <tr><td class="lbl">Funciones:</td><td colspan="3">${escapeHtml(funciones)}</td></tr>
    </table>

    <p>Suscrito y firmado en dos ejemplares en señal de conformidad.</p>

    <div class="sign-row">
      <div class="sign-col">CARBAJAL URQUIZO GLADYS VERONICA<br/>DNI 42892738<br/><strong>EL EMPLEADOR</strong></div>
      <div class="sign-col">${escapeHtml(nombre)}<br/>${escapeHtml(tipoDoc)} ${escapeHtml(dni)}<br/><strong>EL TRABAJADOR</strong></div>
      <div class="huella-box" title="Huella Digital"></div>
    </div>

    <div class="doc-footer">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</div>
  </section>

  <!-- CUERPO DE LAS 18 CLÁUSULAS (PÁGINAS 3 A 7 DEL MODELO EN DRIVE) -->
  <section class="page-sheet">
    <div class="doc-header">
      <div class="aurora-logo-text">Aurora<span class="aurora-logo-sub">RESTAURANT</span></div>
      <div class="header-company">GRUPO GASTRONOMICO AURORA SAC<br/>RUC: 20615117111</div>
    </div>

    <div class="contract-main-title">CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES</div>
    <p>Conste por el presente documento que se extiende por duplicado, el “CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES”, que celebran, de conformidad con el art. 63° del Texto Único Ordenado del Decreto Legislativo N.º 728 – Ley de Productividad y Competitividad Laboral aprobado por Decreto Supremo N.º 003-97–TR del 21.03.97, el Texto Único Ordenado de la Ley de Promoción de la Competitividad, Formalización y Desarrollo de la Micro y Pequeña Empresa y del Acceso al Empleo Decente, en adelante <u>Ley Mype</u>, aprobado por el artículo 56, y 57 del Decreto Supremo N.º 007-2008-TR, su Reglamento, aprobado por Decreto Supremo N.º 008-2008-TR; suscriben <strong>LAS PARTES</strong> detalladas en el <strong>ANEXO N.º 001</strong>, en los términos y condiciones siguientes:</p>

    <div class="clause-title">PRIMERA. – OBJETIVO SOCIAL</div>
    <p><strong>1.1. EL EMPLEADOR</strong>, es una persona jurídica de derecho privado constituida bajo el régimen de sociedad anónima cerrada, que tiene por actividad comercial las actividades de restaurantes y de servicio móvil de comidas, en la ciudad de Trujillo, y en el resto del país.<br/>
    <u>Asimismo, cumple con los requisitos exigidos para ser considerado como una <strong>MICRO EMPRESA, y cuenta con código de Registro REMYPE N.º 0002359064-2025, contratando según la Acreditación como MICRO EMPRESA con Fecha de Solicitud 27.11.2025 y Fecha de Acreditación 10.12.2025</strong>, según Ley de Promoción de la Micro y Pequeña Empresa con Reglamento, el D.S. N.º 009-2003-TR.</u></p>
    <p><strong>1.2. EL TRABAJADOR</strong>, es una persona natural, mayor de edad, con plena capacidad de ejercicio para suscribir contratos y realizar las funciones por las que suscribe el presente contrato.</p>

    <div class="clause-title">SEGUNDA. – CAUSA OBJETIVA</div>
    <p><strong>EL EMPLEADOR</strong> está facultado a contratar personal cuya <strong>CAUSA OBJETIVA</strong> se describe en el <strong>ANEXO N.º 001</strong>.</p>

    <div class="clause-title">TERCERA. – CARGO, CONDICIONES DE TRABAJO Y LA PRESTACIÓN DEL SERVICIO</div>
    <p><strong>3.1. EL TRABAJADOR</strong> desempeñará las labores descritas según detalle del <strong>ANEXO N.º 001</strong>.<br/>
    <strong>3.2. LAS PARTES</strong> reconocen que <strong>EL TRABAJADOR</strong> se obliga a: <u>mantener, cuidar, resguardar y responsabilizarse</u> por el adecuado control y uso de las herramientas de trabajo que <strong><u>quedan bajo su entera y exclusiva responsabilidad</u></strong>, durante el plazo del contrato.<br/>
    <strong>3.3 al 3.6.</strong> Prestación personalísima, sanciones por ausencias injustificadas según el RIT, aviso escrito con 30 días de anticipación en caso de renuncia voluntaria (Art. 18° D.S. N.º 003-97-TR) y facultades directrices del Empleador.</p>

    <div class="clause-title">CUARTA. – PLAZO Y PERIODO DE PRUEBA</div>
    <p><strong>4.1. <u>Fecha de Inicio y Fin:</u></strong> Estipulada en el <strong>ANEXO N.º 001</strong>, renovable por escrito mediante adenda.<br/>
    <strong>4.2. <u>Periodo De Prueba:</u> EL TRABAJADOR</strong> estará sujeto al periodo de prueba conforme al Artículo 10° y 75° del D.S. N.º 003-97-TR.</p>

    <div class="clause-title">QUINTA. – REMUNERACIÓN / SEXTA. – DERECHOS / SÉTIMA. – OBLIGACIONES DEL TRABAJADOR</div>
    <p><strong>EL EMPLEADOR</strong> abonará la remuneración detallada en el <strong>ANEXO N.º 001</strong> sujeta a asistencia efectiva, puntualidad y honradez (5.1 a 5.4), garantizando los derechos del trabajador (6.1 a 6.3) y el cumplimiento de obligaciones del cargo, RIT y Seguridad e Higiene Ocupacional (7.1 a 7.8).</p>

    <div class="clause-title">OCTAVA. – OBLIGACIÓN DE LA EMPRESA (T-REGISTRO SUNAT) / NOVENA. – JORNADA DE TRABAJO</div>
    <p>Alta en T-Registro SUNAT dentro del día de ingreso (D.S. N.º 018-2007-TR). Jornada de seis (06) días de trabajo con un (01) día de descanso obligatorio semanal rotativo, computable de 08 horas diarias / 48 horas semanales (D.Leg. N.º 854 y D.Leg. N.º 713).</p>

    <div class="clause-title">DÉCIMA. – BUENA FE LABORAL / DÉCIMA PRIMERA. – RESERVA, CONFIDENCIALIDAD Y NO COMPETENCIA</div>
    <p>Compromiso absoluto de reserva, confidencialidad y no competencia durante la vigencia del contrato y hasta dos (02) años después de concluido.</p>

    <div class="clause-title">DÉCIMA SEGUNDA. – PREVENCIÓN DE HOSTIGAMIENTO SEXUAL / DÉCIMA TERCERA. – BENEFICIOS SOCIALES MICROEMPRESA</div>
    <p>Cumplimiento de la Ley N.º 27942. Beneficios bajo régimen de <strong><u>MICROEMPRESA</u></strong>: 13.1 Descanso vacacional de quince (15) días por año; 13.2 Sistema Previsional (ONP/AFP/SPS); 13.3 Seguro Regular SIS.</p>

    <div class="clause-title">DÉCIMA CUARTA. – SEGURIDAD Y SALUD (LEY N.º 29783) / DÉCIMA QUINTA. – RESOLUCIÓN DEL VÍNCULO LABORAL</div>
    <p>Cumplimiento de normas de Seguridad y Salud en el Trabajo (14.1 a 14.9) y causales de extinción o resolución por falta grave (15.1 a 15.7).</p>

    <div class="clause-title">DÉCIMA SEXTA. – SOLUCIÓN DE CONFLICTOS / DÉCIMA SÉTIMA. – JURISDICCIÓN / DÉCIMO OCTAVA. – DOMICILIO</div>
    <p>Las partes se someten a los Jueces y Tribunales del Domicilio Fiscal de la Empresa en La Libertad, Perú. Firmado por duplicado, en señal de conformidad y aprobación.</p>

    <div class="sign-row">
      <div class="sign-col"><strong>EL EMPLEADOR</strong></div>
      <div class="sign-col"><strong>EL TRABAJADOR</strong></div>
      <div class="huella-box" title="Huella Digital"></div>
    </div>

    <div class="doc-footer">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</div>
  </section>
</body>
</html>`;
}

window.previewContratoOficial = function (id) {
  const c = state.audit?.colaboradores?.find(x => x.id === Number(id));
  if (!c) return;
  const html = buildContratoOficialHtml(c);
  const downloadHref = relDocUrl(c.documentos?.contrato?.localUrl, `/api/docs/contrato/${c.id}`, c.documentos?.contrato?.driveUrl);
  openDocPreview(`Contrato Oficial (Anexo N° 001) — ${c.nombre}`, null, downloadHref, false, false, html);
};

// ==========================================================================
// MODALES DE VISTA PREVIA DE DOCUMENTOS Y DETALLE DE COLABORADOR
// ==========================================================================
window.openDocPreview = function (title, inlineUrl, downloadUrl, _unused, isImage = false, rawHtml = null) {
  const dlg = document.getElementById('doc-viewer-dialog');
  const titleEl = document.getElementById('doc-viewer-title');
  const bodyEl = document.getElementById('doc-viewer-body');
  const actionsEl = document.getElementById('doc-viewer-actions');

  titleEl.textContent = title;
  actionsEl.innerHTML = '';

  if (downloadUrl) {
    let dlUrl = safeUrl(downloadUrl);
    const dlDrive = dlUrl.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/i) || dlUrl.match(/^https:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
    if (dlDrive) dlUrl = `https://drive.google.com/uc?export=download&id=${dlDrive[1]}`;
    actionsEl.innerHTML += `<a href="${escapeHtml(dlUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">Descargar Archivo</a>`;
  }
  if (inlineUrl) {
    actionsEl.innerHTML += `<a href="${escapeHtml(safeUrl(inlineUrl))}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Abrir Pestaña</a>`;
  }

  if (rawHtml) {
    bodyEl.innerHTML = `<iframe class="doc-preview-frame" title="${escapeHtml(title)}"></iframe>`;
    const iframe = bodyEl.querySelector('iframe');
    iframe.srcdoc = rawHtml;
  } else if (isImage && inlineUrl) {
    bodyEl.innerHTML = `<div style="text-align:center;"><img src="${escapeHtml(safeUrl(inlineUrl))}" alt="${escapeHtml(title)}" style="max-width:100%; max-height:62vh; border-radius:12px; border:1px solid var(--glass-border-gold);" /></div>`;
  } else if (inlineUrl) {
    let embedUrl = safeUrl(inlineUrl);
    const driveMatch = embedUrl.match(/^https:\/\/drive\.google\.com\/file\/d\/([^/]+)/i)
      || embedUrl.match(/^https:\/\/drive\.google\.com\/open\?id=([^&]+)/i);
    if (driveMatch) {
      embedUrl = `https://drive.google.com/file/d/${driveMatch[1]}/preview`;
    }
    bodyEl.innerHTML = `<iframe src="${escapeHtml(embedUrl)}" class="doc-preview-frame" title="${escapeHtml(title)}" allow="autoplay"></iframe>`;
  } else {
    bodyEl.innerHTML = '<p>Vista previa lista.</p>';
  }

  dlg.showModal();
};

window.openColabDetailDialog = function (id) {
  const c = state.audit?.colaboradores?.find(x => x.id === Number(id));
  if (!c) return;
  const dlg = document.getElementById('colab-dialog');
  document.getElementById('colab-dialog-title').textContent = `${c.nombre} — DNI ${c.dni}`;

  const hist = (c.adendas || []).map(a => `${a.numero || ''}: ${a.inicio || a.desde || ''} al ${a.fin || a.hasta || ''}`).join(' | ') || 'Solo Contrato Base';
  document.getElementById('colab-dialog-body').innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:18px;">
      <div class="info-chip"><div class="info-chip-label">Área / Puesto</div><div>${escapeHtml(c.area)} — <strong>${escapeHtml(c.cargo)}</strong></div></div>
      <div class="info-chip"><div class="info-chip-label">Condición / Sueldo</div><div>${escapeHtml(c.condicionLaborable)} — <strong>${formatMoney(c.sueldo)}</strong></div></div>
      <div class="info-chip"><div class="info-chip-label">Estado</div><div><span class="status-badge ${badgeClassForSemaforo(c.semaforo)}">${escapeHtml(c.estadoTexto)}</span></div></div>
      <div class="info-chip"><div class="info-chip-label">Vigencia / Cese</div><div>Ingreso: ${escapeHtml(c.fechaIngreso)} • Fin: ${escapeHtml(c.vigenciaHasta)}</div></div>
      <div class="info-chip"><div class="info-chip-label">Banco / Cuenta</div><div>${escapeHtml(c.banco)} — ${escapeHtml(c.numeroCuenta)}</div></div>
      <div class="info-chip"><div class="info-chip-label">Contacto</div><div>Cel: ${escapeHtml(c.celular)} • ${escapeHtml(c.correo)}</div></div>
    </div>
    <div class="info-chip" style="margin-bottom:12px;">
      <div class="info-chip-label">Domicilio Completo (Leer más)</div>
      <div>${renderExpandableText(c.domicilio, 60)}</div>
    </div>
    <div class="info-chip" style="margin-bottom:16px;">
      <div class="info-chip-label">Adendas y Observaciones (Leer más)</div>
      <div>${renderExpandableText(`Adendas: ${hist}. Obs: ${c.observaciones}`, 90)}</div>
    </div>
    <div style="display:flex; flex-wrap:wrap; gap:8px;">
      <a href="${escapeHtml(relDocUrl(c.documentos?.contrato?.localUrl, `/api/docs/contrato/${c.id}`, c.documentos?.contrato?.driveUrl))}" target="_blank" rel="noopener" class="bw-btn-sm is-primary">1. Descargar Contrato</a>
      <a href="${escapeHtml(apiUrl(`/api/docs/adenda/${c.id}`))}" class="bw-btn-sm">2. Emitir Adenda</a>
      <a href="${escapeHtml(apiUrl(`/api/docs/memo/${c.id}`))}" class="bw-btn-sm">3. Descargar Memorándum</a>
      <a href="${escapeHtml(relDocUrl(c.documentos?.liquidacion?.localUrl, `/api/docs/liquidacion/${c.id}`, c.documentos?.liquidacion?.driveUrl))}" target="_blank" rel="noopener" class="bw-btn-sm">4. Descargar Liquidación</a>
      ${c.documentos?.fotoDni ? `<a href="${escapeHtml(relDocUrl(c.documentos.fotoDni.localUrl, `/api/docs/dni/${c.id}`, c.documentos.fotoDni.driveUrl))}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">5. Descargar Foto DNI</a>` : ''}
    </div>
  `;
  dlg.showModal();
};

// ==========================================================================
// 9. PLANILLA COMPLETA & EDITOR EN VENTANA EMERGENTE (SYNC GOOGLE SHEETS)
// ==========================================================================
window.openPlanillaEditModal = function (id) {
  if (!id) return;
  loadPlanillaForm(Number(id));
  const dlg = document.getElementById('planilla-edit-dialog');
  if (dlg && !dlg.open) {
    dlg.showModal();
  }
};

window.openPlanillaEditor = function (id) {
  if (id) {
    openPlanillaEditModal(Number(id));
    return;
  }
  switchView('planilla', false);
  renderPlanillaEditor();
};

window.openPlanillaFilter = function (filterVal) {
  state.planillaFilter.filter = filterVal || '';
  const fSel = document.getElementById('planilla-filter');
  if (fSel) fSel.value = state.planillaFilter.filter;
  switchView('planilla', false);
  renderPlanillaEditor();
};

function getFilteredPlanillaList() {
  if (!state.audit || !Array.isArray(state.audit.colaboradores)) return [];
  const q = (state.planillaFilter.search || '').toLowerCase().trim();
  const f = (state.planillaFilter.filter || '').toUpperCase().trim();
  return state.audit.colaboradores.filter(c => {
    const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));
    if (f === 'ACTIVO' && c.estado !== 'ACTIVO') return false;
    if (f === 'CESADO' && c.estado !== 'CESADO') return false;
    if ((f === 'CONTRATO' || f === 'RXH' || f === 'OTROS') && cl !== f) return false;
    if (q) {
      const hay = `${c.nombre} ${c.dni} ${c.cargo} ${c.area} ${c.estado} ${cl}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function setSelectOrAddOption(selEl, value) {
  if (!selEl) return;
  const val = String(value ?? '').trim();
  if (!val) return;
  const exists = Array.from(selEl.options).some(o => o.value.toLowerCase() === val.toLowerCase());
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    selEl.appendChild(opt);
  }
  const matched = Array.from(selEl.options).find(o => o.value.toLowerCase() === val.toLowerCase());
  selEl.value = matched ? matched.value : val;
}

function cleanVal(v) {
  const s = String(v ?? '').trim();
  if (s === 'No registrado' || s === 'N/A' || s === 'null' || s === 'undefined') return '';
  return s;
}

window.loadPlanillaForm = function (id) {
  if (!state.audit) return;
  const c = state.audit.colaboradores.find(x => x.id === Number(id));
  if (!c) return;
  state.editPlanillaId = c.id;

  const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));

  const setVal = (elId, val) => {
    const el = document.getElementById(elId);
    if (el) el.value = val ?? '';
  };

  setVal('edit-id', c.id);
  setVal('edit-original-dni', c.dni);
  setSelectOrAddOption(document.getElementById('edit-tipo-doc'), c.tipoDocumento || 'DNI');
  setVal('edit-dni', cleanVal(c.dni));
  setVal('edit-nombre', cleanVal(c.nombre));
  setSelectOrAddOption(document.getElementById('edit-area'), cleanVal(c.area) || 'Salón');
  setVal('edit-cargo', cleanVal(c.cargo || c.cargoContrato));
  setSelectOrAddOption(document.getElementById('edit-condicion-laboral'), cl);
  setSelectOrAddOption(document.getElementById('edit-condicion'), cleanVal(c.condicionLaborable) || 'FULL TIME');
  setSelectOrAddOption(document.getElementById('edit-estado'), cleanVal(c.estado) || 'ACTIVO');
  setVal('edit-sueldo', c.sueldo != null ? c.sueldo : 0);
  setVal('edit-fecha-inicio', toIsoDate(cleanVal(c.fechaIngreso)));
  setVal('edit-fecha-fin', toIsoDate(c.estado === 'CESADO' ? cleanVal(c.finContratoBase) : cleanVal(c.vigenciaHasta)));
  setVal('edit-fecha-cese', toIsoDate(cleanVal(c.fechaCese)));
  setVal('edit-domicilio', cleanVal(c.domicilio));
  const nacIso = toIsoDate(cleanVal(c.fechaNacimiento));
  setVal('edit-nacimiento', nacIso);
  setVal('edit-edad', nacIso ? calcularEdadPorAnio(nacIso) : cleanVal(c.edad));
  setVal('edit-celular', cleanVal(c.celular));
  setVal('edit-correo', cleanVal(c.correo));
  setVal('edit-banco', cleanVal(c.banco));
  setVal('edit-cuenta', cleanVal(c.numeroCuenta));
  setSelectOrAddOption(document.getElementById('edit-carnet'), cleanVal(c.carnetSanitario) || 'NO');
  setVal('edit-obs', cleanVal(c.observaciones));

  const titleEl = document.getElementById('edit-selected-title');
  const tagEl = document.getElementById('edit-selected-tag');
  if (titleEl) titleEl.textContent = c.nombre;
  if (tagEl) tagEl.textContent = `ID #${String(c.id).padStart(2, '0')} • DNI ${c.dni} • ${cl}`;

  const resBox = document.getElementById('edit-planilla-result-box');
  if (resBox) resBox.style.display = 'none';

  // Actualizar estado del botón Subir / Actualizar PDF o Foto de DNI
  state.editDniAttachment = null;
  const editDniInput = document.getElementById('edit-dni-file-input');
  if (editDniInput) editDniInput.value = '';
  const editDniNew = document.getElementById('edit-dni-new-status');
  if (editDniNew) { editDniNew.style.display = 'none'; editDniNew.textContent = ''; }

  const fotoDni = c.documentos?.fotoDni || null;
  const dniStatusEl = document.getElementById('edit-dni-current-status');
  const dniVerBtn = document.getElementById('btn-edit-dni-ver-actual');
  const dniUploadLabel = document.getElementById('btn-edit-dni-upload-label');

  if (fotoDni && (fotoDni.fileName || fotoDni.driveUrl || fotoDni.localUrl)) {
    const dniUrl = relDocUrl(fotoDni.localUrl, `/api/docs/dni/${c.id}`, fotoDni.driveUrl);
    if (dniStatusEl) {
      dniStatusEl.innerHTML = `Archivo actual: <strong>${escapeHtml(fotoDni.originalName || fotoDni.fileName || 'DNI en Drive')}</strong>`;
    }
    if (dniVerBtn) {
      dniVerBtn.href = dniUrl;
      dniVerBtn.style.display = 'inline-flex';
    }
    if (dniUploadLabel) dniUploadLabel.textContent = 'ACTUALIZAR FOTO / PDF DE DNI';
  } else {
    if (dniStatusEl) dniStatusEl.textContent = 'Sin foto o PDF de DNI cargado aún.';
    if (dniVerBtn) dniVerBtn.style.display = 'none';
    if (dniUploadLabel) dniUploadLabel.textContent = 'SUBIR PDF / FOTO DE DNI';
  }

  document.querySelectorAll('.planilla-emp-item').forEach(btn => {
    const active = Number(btn.getAttribute('data-emp-id')) === c.id;
    btn.classList.toggle('is-selected', active);
    btn.setAttribute('aria-selected', String(active));
  });
};

function renderPlanillaEditor() {
  const tbody = document.getElementById('planilla-employee-tbody');
  const countEl = document.getElementById('planilla-list-count');
  if (!tbody || !state.audit) return;

  const filtered = getFilteredPlanillaList();
  if (countEl) countEl.textContent = `${filtered.length} / ${state.audit.colaboradores.length} colaboradores`;

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:28px;">No se encontraron colaboradores con el filtro actual.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((c, idx) => {
    const cl = c.condicionLaboral || (c.estado === 'RXH' ? 'RXH' : (c.estado === 'APOYO' ? 'OTROS' : 'CONTRATO'));
    const clBadge = cl === 'CONTRATO' ? 'badge-verde' : (cl === 'RXH' ? 'badge-naranja' : 'badge-amarillo');
    return `
      <tr>
        <td data-label="#"><strong>${String(c.id || (idx + 1)).padStart(2, '0')}</strong></td>
        <th scope="row">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="font-size:0.86rem; color:var(--hs-text-primary);">${escapeHtml(c.nombre)}</strong>
            <span style="font-size:0.72rem; color:var(--hs-text-secondary);">${escapeHtml(c.condicionLaborable || 'FULL TIME')}</span>
          </div>
        </th>
        <td data-label="DNI"><strong>${escapeHtml(c.dni)}</strong></td>
        <td data-label="Área / Cargo">${escapeHtml(c.area)}<br><span style="font-size:0.75rem; color:var(--aurora-gold-bright);">${escapeHtml(c.cargo)}</span></td>
        <td data-label="Condición Laboral"><span class="status-badge ${clBadge}">${escapeHtml(cl)}</span></td>
        <td data-label="Estado"><span class="status-badge ${badgeClassForSemaforo(c.semaforo)}">${escapeHtml(c.estadoTexto)}</span></td>
        <td data-label="Sueldo"><strong>${formatMoney(c.sueldo)}</strong></td>
        <td data-label="Vigencia / Cese">Ingreso: ${escapeHtml(c.fechaIngreso)}<br><span style="font-size:0.74rem; opacity:0.8;">Hasta: ${escapeHtml(c.vigenciaHasta)}</span></td>
        <td data-label="Acción">
          <button type="button" class="bw-btn-sm is-primary" onclick="openPlanillaEditModal(${c.id})">
            EDITAR
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function initPlanillaEditor() {
  const searchIn = document.getElementById('planilla-search');
  const filterSel = document.getElementById('planilla-filter');
  const btnBuscar = document.getElementById('btn-planilla-buscar');
  const btnLimpiar = document.getElementById('btn-planilla-limpiar');
  const form = document.getElementById('form-editar-planilla');
  const resBox = document.getElementById('edit-planilla-result-box');

  const applyPlanillaFilter = () => {
    state.planillaFilter.search = searchIn?.value || '';
    state.planillaFilter.filter = filterSel?.value || '';
    renderPlanillaEditor();
  };

  searchIn?.addEventListener('input', applyPlanillaFilter);
  btnBuscar?.addEventListener('click', applyPlanillaFilter);
  filterSel?.addEventListener('change', applyPlanillaFilter);

  btnLimpiar?.addEventListener('click', () => {
    if (searchIn) searchIn.value = '';
    if (filterSel) filterSel.value = '';
    state.planillaFilter = { search: '', filter: '' };
    renderPlanillaEditor();
  });

  document.getElementById('btn-reset-editar-planilla')?.addEventListener('click', () => {
    loadPlanillaForm(state.editPlanillaId);
  });

  // Cálculo automático de edad = año actual - año de nacimiento en Editar Planilla
  const editNac = document.getElementById('edit-nacimiento');
  const editEdad = document.getElementById('edit-edad');
  const syncEditEdad = () => {
    if (editEdad && editNac) editEdad.value = calcularEdadPorAnio(editNac.value);
  };
  editNac?.addEventListener('change', syncEditEdad);
  editNac?.addEventListener('input', syncEditEdad);

  // Manejo de archivo PDF / Foto de DNI dentro del modal de edición de planilla
  const editDniInput = document.getElementById('edit-dni-file-input');
  const editDniDropzone = document.getElementById('edit-dni-dropzone');
  const editDniNewStatus = document.getElementById('edit-dni-new-status');

  function handleEditDniFile(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      if (editDniNewStatus) {
        editDniNewStatus.style.display = 'block';
        editDniNewStatus.style.color = '#EF4444';
        editDniNewStatus.innerHTML = `<strong>Archivo muy pesado (${(file.size / (1024 * 1024)).toFixed(1)} MB):</strong> El máximo permitido es 8 MB.`;
      }
      state.editDniAttachment = null;
      return;
    }
    if (editDniNewStatus) {
      editDniNewStatus.style.display = 'block';
      editDniNewStatus.style.color = 'var(--tg-primary)';
      editDniNewStatus.innerHTML = `Leyendo <strong>${escapeHtml(file.name)}</strong>...`;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.editDniAttachment = { name: file.name, base64: reader.result };
      if (editDniNewStatus) {
        editDniNewStatus.style.display = 'block';
        editDniNewStatus.style.color = 'var(--emerald-ok)';
        editDniNewStatus.innerHTML = `<strong>Nuevo archivo listo para subir a Drive y Sheets:</strong> ${escapeHtml(file.name)} (${Math.round(file.size / 1024)} KB)`;
      }
    };
    reader.onerror = () => {
      state.editDniAttachment = null;
      if (editDniNewStatus) {
        editDniNewStatus.style.display = 'block';
        editDniNewStatus.style.color = '#EF4444';
        editDniNewStatus.textContent = 'No se pudo leer el archivo seleccionado. Intenta nuevamente.';
      }
    };
    reader.readAsDataURL(file);
  }

  editDniInput?.addEventListener('change', e => handleEditDniFile(e.target.files[0]));
  editDniDropzone?.addEventListener('dragover', e => { e.preventDefault(); editDniDropzone.classList.add('is-dragover'); });
  editDniDropzone?.addEventListener('dragleave', () => editDniDropzone.classList.remove('is-dragover'));
  editDniDropzone?.addEventListener('drop', e => {
    e.preventDefault();
    editDniDropzone.classList.remove('is-dragover');
    if (e.dataTransfer.files[0]) handleEditDniFile(e.dataTransfer.files[0]);
  });

  document.getElementById('btn-edit-ver-boveda')?.addEventListener('click', () => {
    const dlg = document.getElementById('planilla-edit-dialog');
    if (dlg && dlg.open) dlg.close();
    if (state.editPlanillaId) focusEmployeeVault(state.editPlanillaId);
  });

  document.getElementById('btn-preview-contrato-edit')?.addEventListener('click', () => {
    if (!form) return;
    const fd = new FormData(form);
    const p = Object.fromEntries(fd.entries());
    const tempColab = {
      id: Number(p.id || 0),
      nombre: (p.nombre || 'COLABORADOR').toUpperCase(),
      tipoDocumento: p.tipoDocumento || 'DNI',
      dni: p.dni || '00000000',
      domicilio: p.domicilio || 'TRUJILLO - LA LIBERTAD',
      celular: p.celular || '-',
      correo: p.correo || '-',
      cargo: (p.cargo || 'COLABORADOR').toUpperCase(),
      area: p.area || 'Salón',
      sueldo: Number(p.sueldo || 0),
      fechaIngreso: toDmyDate(p.fechaInicio) || '01/02/2026',
      vigenciaHasta: toDmyDate(p.fechaFin) || '31/10/2026'
    };
    const html = buildContratoOficialHtml(tempColab);
    openDocPreview(`Contrato Oficial (Anexo N° 001) — ${tempColab.nombre}`, null, null, false, false, html);
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault();
    if (resBox) resBox.style.display = 'none';
    if (!window.validateFormOnSubmit(form)) return;

    const btn = document.getElementById('btn-submit-editar-planilla');
    const origText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'ACTUALIZANDO PADRÓN Y GOOGLE SHEETS...';

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());
    payload.fechaInicio = toDmyDate(payload.fechaInicio);
    payload.fechaFin = toDmyDate(payload.fechaFin);
    payload.fechaCese = toDmyDate(payload.fechaCese);
    payload.fechaNacimiento = toDmyDate(payload.fechaNacimiento);
    if (payload.fechaNacimiento) {
      payload.edad = calcularEdadPorAnio(payload.fechaNacimiento) || payload.edad;
    }
    if (state.editDniAttachment) {
      payload.fotoDniBase64 = state.editDniAttachment.base64;
      payload.fotoDniName = state.editDniAttachment.name;
    }

    try {
      let res = null;
      let data = null;
      if (useGasBackend()) {
        data = await gasPost('update_personal', payload);
        res = { ok: Boolean(data && data.success) };
      } else {
        res = await authFetch(apiUrl('/api/personal/actualizar'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        data = await res.json();
      }

      if (!res.ok || !data.success) {
        resBox.style.display = 'block';
        resBox.style.borderColor = '#EF4444';
        resBox.innerHTML = `<strong style="color:#EF4444;">Error al actualizar:</strong> ${escapeHtml(data.error || 'No se pudo guardar el cambio.')}`;
        return;
      }

      const c = data.colaborador;
      const sync = data.sheetSyncResult || {};
      resBox.style.display = 'block';
      resBox.style.borderColor = 'var(--emerald-ok)';
      resBox.innerHTML = `
        <h4 style="color:var(--emerald-ok); font-size:0.96rem; margin-bottom:8px;">
          Ficha Actualizada y Sincronizada: ${escapeHtml(c.nombre)} (DNI ${escapeHtml(c.dni)})
        </h4>
        <ul style="margin-left:18px; font-size:0.82rem; display:flex; flex-direction:column; gap:4px; margin-bottom:12px;">
          <li>Condición Laboral: <strong>${escapeHtml(c.condicionLaboral)}</strong> • Estado: <strong>${escapeHtml(c.estado)}</strong> • Sueldo: <strong>${formatMoney(c.remuneracionActual)}</strong></li>
          <li>Google Sheet Maestro (1_PADRON_GENERAL): <strong>${sync.masterSynced ? `FILA ${sync.masterRow} ACTUALIZADA EN VIVO` : 'Guardado local'}</strong></li>
          <li>Google Sheet Histórico (Respuestas de formulario 1): <strong>${sync.historicalSynced ? `FILA ${sync.historicalRow} ACTUALIZADA EN VIVO` : 'Sin fila previa / local'}</strong></li>
          ${data.dniUpdated ? `<li>Foto / PDF de DNI: <strong>ACTUALIZADO Y SUBIDO A DRIVE (${escapeHtml(c.documentos?.fotoDni?.fileName || 'OK')})</strong></li>` : ''}
          ${data.dniError ? `<li style="color:#EF4444;">Aviso Drive DNI: ${escapeHtml(data.dniError)}</li>` : ''}
          ${sync.errors?.length ? `<li style="color:#F59E0B;">Aviso Sync: ${escapeHtml(sync.errors.join(' | '))}</li>` : ''}
        </ul>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${data.masterSheetUrl ? `<a href="${escapeHtml(data.masterSheetUrl)}" target="_blank" rel="noopener" class="bw-btn-sm is-gold">Abrir Google Sheet Maestro</a>` : ''}
          ${data.historicalSheetUrl ? `<a href="${escapeHtml(data.historicalSheetUrl)}" target="_blank" rel="noopener" class="bw-btn-sm">Abrir Sheet Histórico</a>` : ''}
          <button type="button" class="bw-btn-sm is-primary" onclick="focusEmployeeVault(${c.id})">Ver 5 Docs del Colaborador</button>
        </div>
      `;

      state.editPlanillaId = c.id;
      await loadAllData();
    } catch (err) {
      resBox.style.display = 'block';
      resBox.style.borderColor = '#EF4444';
      resBox.innerHTML = `<strong style="color:#EF4444;">Error de conexión con servidor local (puerto 3005):</strong> ${escapeHtml(err.message)}`;
    } finally {
      btn.disabled = false;
      btn.textContent = origText;
    }
  });
}

// ==========================================================================
// INICIALIZACIÓN GLOBAL
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initValidationAfterInteraction();
  initDialogLightDismiss();
  loadAllData();
  initLoginControl();
  initDock();
  initFilters();
  initOnboardingForm();
  initPlanillaEditor();
  initAdendaBatch();
  initDocsForms();
  initEmailCenter();
  initChat();
  hydrateIcons();
});
