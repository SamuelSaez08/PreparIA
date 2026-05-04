/* ============================================================
   PreparIA — app.js
   Módulo principal: Estado, utilidades y componentes reutilizables
   INTEGRADO con api.js para comunicación con el backend REST
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   1. STATE MANAGER
   Manejo centralizado del estado con LocalStorage
   (se mantiene para cache y datos locales auxiliares)
────────────────────────────────────────────────────────── */
const State = (() => {
  const KEYS = {
    USER:        'preparia_user',
    SESSION:     'preparia_session',
    STREAK:      'preparia_streak',
    SIMULACROS:  'preparia_simulacros',
    PROGRESS:    'preparia_progress',
    TREE_NODES:  'preparia_tree_nodes',
    SETTINGS:    'preparia_settings',
  };

  const get = (key) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  const set = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  };

  const remove = (key) => localStorage.removeItem(key);

  const clear = () => Object.values(KEYS).forEach(k => localStorage.removeItem(k));

  return { KEYS, get, set, remove, clear };
})();

/* ──────────────────────────────────────────────────────────
   2. AUTH MANAGER
   Gestión de sesión de usuario — ahora usa Session de api.js
────────────────────────────────────────────────────────── */
const Auth = (() => {
  const isLoggedIn = () => Session.isLoggedIn();

  const getUser = () => Session.getUser();

  const logout = async () => {
    await AuthAPI.logout();
  };

  const requireAuth = () => {
    if (!isLoggedIn()) window.location.href = 'login';
  };

  return { isLoggedIn, getUser, logout, requireAuth };
})();

/* ──────────────────────────────────────────────────────────
   3. STREAK MANAGER
   Sistema de racha de días consecutivos
   (Se mantiene para renderizado del widget, datos vienen del backend)
────────────────────────────────────────────────────────── */
const Streak = (() => {
  const todayStr = () => new Date().toISOString().split('T')[0];

  const init = () => {
    State.set(State.KEYS.STREAK, {
      count: 1,
      lastDate: todayStr(),
      history: [todayStr()],
      longest: 1,
    });
  };

  const checkAndUpdate = () => {
    let s = State.get(State.KEYS.STREAK);
    if (!s) { init(); return; }

    const today = todayStr();
    if (s.lastDate === today) return; // ya se registró hoy

    const last = new Date(s.lastDate);
    const now  = new Date(today);
    const diff = Math.round((now - last) / (1000 * 60 * 60 * 24));

    if (diff === 1) {
      s.count++;
    } else {
      s.count = 1; // se rompió la racha
    }

    s.lastDate = today;
    s.history  = [...(s.history || []).slice(-29), today]; // últimos 30 días
    s.longest  = Math.max(s.longest || 0, s.count);
    State.set(State.KEYS.STREAK, s);
  };

  const get = () => {
    const s = State.get(State.KEYS.STREAK);
    return s || { count: 0, history: [], longest: 0 };
  };

  // Genera los últimos 7 días con estado
  const getWeek = () => {
    const s = get();
    const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const str = d.toISOString().split('T')[0];
      return {
        label: days[d.getDay() === 0 ? 6 : d.getDay() - 1],
        done: (s.history || []).includes(str),
        today: str === todayStr(),
      };
    });
  };

  // Actualizar con datos del backend
  const updateFromBackend = (backendData) => {
    if (!backendData) return;
    const current = get();
    const updated = {
      count: backendData.racha_actual || backendData.dias || current.count || 0,
      lastDate: todayStr(),
      history: backendData.actividad_semanal || backendData.historial || current.history || [],
      longest: backendData.racha_maxima || backendData.mejor_racha || current.longest || 0,
    };
    State.set(State.KEYS.STREAK, updated);
  };

  return { init, checkAndUpdate, get, getWeek, updateFromBackend };
})();

/* ──────────────────────────────────────────────────────────
   4. SIMULACROS MANAGER
   Ahora es un wrapper ligero — los datos reales vienen del backend
────────────────────────────────────────────────────────── */
const Simulacros = (() => {
  const getHistory = () => State.get(State.KEYS.SIMULACROS) || [];

  const saveResult = (result) => {
    const history = getHistory();
    history.unshift({
      id: Date.now(),
      date: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }),
      score: result.score,
      total: result.total,
      pct: Math.round((result.score / result.total) * 100),
      timeUsed: result.timeUsed,
      tema: 'Ciencias Sociales',
    });
    State.set(State.KEYS.SIMULACROS, history.slice(0, 20)); // guardar últimos 20
  };

  const getStats = () => {
    const history = getHistory();
    if (!history.length) return { avg: 0, best: 0, total: 0, lastPct: 0 };
    const pcts = history.map(h => h.pct);
    return {
      avg:     Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
      best:    Math.max(...pcts),
      total:   history.length,
      lastPct: pcts[0] || 0,
    };
  };

  // Update local cache with backend data
  const updateFromBackend = (backendHistory) => {
    if (!backendHistory || !backendHistory.length) return;
    const mapped = backendHistory.map(h => ({
      id: h.id || h.id_intento,
      date: h.fecha ? new Date(h.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A',
      score: h.correctas || h.puntaje || 0,
      total: h.total_preguntas || h.total || 10,
      pct: h.porcentaje || h.puntaje || Math.round(((h.correctas || 0) / (h.total_preguntas || 10)) * 100),
      timeUsed: h.tiempo_usado || 0,
      tema: h.materia || h.nombre_simulacro || 'Ciencias Sociales',
    }));
    State.set(State.KEYS.SIMULACROS, mapped.slice(0, 20));
  };

  return { getHistory, saveResult, getStats, updateFromBackend };
})();

/* ──────────────────────────────────────────────────────────
   5. TREE MANAGER
   Gestión del árbol de nodos de Ciencias Sociales
   Ahora carga datos del backend con fallback al árbol local
────────────────────────────────────────────────────────── */
const TreeManager = (() => {
  const DEFAULT_TREE = [];

  /**
   * Transforma nodos del backend al formato del frontend
   * Backend: { id, nombre, descripcion, hijos: [], id_padre }
   * Frontend: { id, label, icon, children }
   */
  const transformBackendNode = (node) => {
    return {
      id: node.id || node.id_nodo,
      label: node.nombre || node.label || 'Sin nombre',
      icon: node.icono || node.icon || '📌',
      description: node.descripcion || '',
      children: (node.hijos || node.children || []).map(transformBackendNode),
    };
  };

  const getTree = () => {
    const saved = State.get(State.KEYS.TREE_NODES);
    return saved || DEFAULT_TREE;
  };

  const saveTree = (tree) => State.set(State.KEYS.TREE_NODES, tree);

  const setTreeFromBackend = (backendTree) => {
    const transformed = (backendTree || []).map(transformBackendNode);

    // Merge: start with default tree, then add/update with backend nodes
    const merged = JSON.parse(JSON.stringify(DEFAULT_TREE));

    // Helper: find a node in a tree by id
    const findInTree = (nodes, id) => {
      for (const n of nodes) {
        if (String(n.id) === String(id)) return n;
        if (n.children) {
          const found = findInTree(n.children, id);
          if (found) return found;
        }
      }
      return null;
    };

    // Add backend nodes that don't exist in the default tree as top-level items
    for (const bNode of transformed) {
      const existing = findInTree(merged, bNode.id);
      if (existing) {
        // Update existing node with backend data
        existing.label = bNode.label || existing.label;
        existing.description = bNode.description || existing.description;
        if (bNode.icon && bNode.icon !== '📌') existing.icon = bNode.icon;
        // Merge children recursively
        if (bNode.children && bNode.children.length) {
          for (const child of bNode.children) {
            const existingChild = findInTree(existing.children || [], child.id);
            if (!existingChild) {
              existing.children = existing.children || [];
              existing.children.push(child);
            }
          }
        }
      } else {
        merged.push(bNode);
      }
    }

    saveTree(merged);
    return merged;
  };

  const addNode = (parentId, label, icon = '📌', description = '') => {
    const tree = getTree();
    const newNode = {
      id: 'node_' + Date.now(),
      label,
      icon,
      description,
      children: [],
      custom: true,
    };

    const insert = (nodes) => {
      for (const n of nodes) {
        if (String(n.id) === String(parentId)) {
          n.children = n.children || [];
          n.children.push(newNode);
          return true;
        }
        if (n.children && insert(n.children)) return true;
      }
      return false;
    };

    insert(tree);
    saveTree(tree);
    return newNode;
  };

  const deleteNode = (nodeId) => {
    const tree = getTree();

    const remove = (nodes) => {
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].id === nodeId) {
          nodes.splice(i, 1);
          return true;
        }
        if (nodes[i].children && remove(nodes[i].children)) return true;
      }
      return false;
    };

    remove(tree);
    saveTree(tree);
  };

  const getNodeById = (nodeId) => {
    const tree = getTree();
    const find = (nodes) => {
      for (const n of nodes) {
        if (String(n.id) === String(nodeId)) return n;
        if (n.children) {
          const found = find(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return find(tree);
  };

  return { getTree, saveTree, setTreeFromBackend, addNode, deleteNode, getNodeById, DEFAULT_TREE };
})();

/* ──────────────────────────────────────────────────────────
   6. UI COMPONENTS
   Componentes de interfaz reutilizables
────────────────────────────────────────────────────────── */
const UI = (() => {

  // Toast notifications
  let toastTimer = null;
  const showToast = (msg, type = 'success') => {
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    clearTimeout(toastTimer);
    requestAnimationFrame(() => {
      toast.classList.add('show');
      toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
    });
  };

  // Modal
  const openModal = (id) => {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.add('show');
  };
  const closeModal = (id) => {
    const overlay = document.getElementById(id);
    if (overlay) overlay.classList.remove('show');
  };
  const closeAllModals = () => {
    document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show'));
  };

  // Render streak days widget
  const renderStreakDays = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    const week = Streak.getWeek();
    el.innerHTML = week.map(d => `
      <div class="streak-day ${d.done ? 'done' : ''} ${d.today && !d.done ? 'today' : ''}">
        ${Utils.sanitizeHTML(d.label)}
      </div>
    `).join('');
  };

  // Render streak days with backend data
  const renderStreakDaysFromBackend = (containerId, actividadSemanal) => {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (actividadSemanal && actividadSemanal.length) {
      // Use backend data
      const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
      const todayStr = new Date().toISOString().split('T')[0];
      const today = new Date();

      el.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        const str = d.toISOString().split('T')[0];
        const label = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
        const done = actividadSemanal.includes(str);
        const isToday = str === todayStr;
        return `
          <div class="streak-day ${done ? 'done' : ''} ${isToday && !done ? 'today' : ''}">
            ${Utils.sanitizeHTML(label)}
          </div>
        `;
      }).join('');
    } else {
      renderStreakDays(containerId);
    }
  };

  // Render score ring (SVG)
  const renderScoreRing = (pct, label = '') => {
    const r = 50, cx = 60, cy = 60;
    const circumference = 2 * Math.PI * r;
    const dashOffset = circumference - (pct / 100) * circumference;
    const color = pct >= 70 ? '#BFFF00' : pct >= 50 ? '#FFD93D' : '#FF6B6B';
    return `
      <div class="score-ring">
        <svg viewBox="0 0 120 120" width="120" height="120">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(245,245,240,0.1)" stroke-width="10"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
            stroke-dasharray="${circumference}" stroke-dashoffset="${dashOffset}"
            stroke-linecap="round" style="transition: stroke-dashoffset 1s ease"/>
        </svg>
        <div class="score-text">${pct}<small>%</small></div>
      </div>
    `;
  };

  // Render bar chart on canvas
  const renderBarChart = (canvasId, labels, data, color = '#BFFF00') => {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight || 200;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const maxVal = Math.max(...data, 100);
    const pad = { top: 20, right: 16, bottom: 48, left: 36 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;
    const barW = Math.max(8, (chartW / data.length) - 10);

    // Background grid
    ctx.strokeStyle = 'rgba(245,245,240,0.07)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(w - pad.right, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(245,245,240,0.3)';
      ctx.font = `bold 10px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal - (maxVal / 4) * i) + '%', pad.left - 6, y + 4);
    }

    // Bars
    data.forEach((val, i) => {
      const x = pad.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
      const barH = (val / maxVal) * chartH;
      const y = pad.top + chartH - barH;

      // Bar glow
      const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '55');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      // Value label
      ctx.fillStyle = color;
      ctx.font = `bold 11px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(val + '%', x + barW / 2, y - 6);

      // X label
      ctx.fillStyle = 'rgba(245,245,240,0.4)';
      ctx.font = `600 10px 'Plus Jakarta Sans', sans-serif`;
      const labelText = labels[i] || '';
      ctx.fillText(labelText.length > 6 ? labelText.slice(0, 6) + '…' : labelText, x + barW / 2, h - 8);
    });
  };

  // Password visibility toggle
  const initPasswordToggles = () => {
    document.querySelectorAll('[data-toggle-pwd]').forEach(btn => {
      const targetId = btn.getAttribute('data-toggle-pwd');
      btn.addEventListener('click', () => {
        const input = document.getElementById(targetId);
        if (!input) return;
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.textContent = isText ? '👁️' : '🙈';
      });
    });
  };

  // Setup modal close on overlay click
  const initModalCloseHandlers = () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-close-modal');
        closeModal(id);
      });
    });
  };

  // Animate progress bars on load
  const animateProgressBars = () => {
    const bars = document.querySelectorAll('.progress-fill[data-pct]');
    setTimeout(() => {
      bars.forEach(b => b.style.width = b.getAttribute('data-pct') + '%');
    }, 300);
  };

  return {
    showToast, openModal, closeModal, closeAllModals,
    renderStreakDays, renderStreakDaysFromBackend, renderScoreRing, renderBarChart,
    initPasswordToggles, initModalCloseHandlers, animateProgressBars,
  };
})();

/* ──────────────────────────────────────────────────────────
   7. VALIDATION HELPERS
────────────────────────────────────────────────────────── */
const Validate = (() => {
  const email = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const minLen = (v, n) => v.trim().length >= n;
  const noEmpty = (v) => v.trim().length > 0;
  const match = (a, b) => a === b;

  const showError = (fieldId, msg) => {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (field) field.classList.add('error');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  };

  const clearError = (fieldId) => {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (field) field.classList.remove('error');
    if (errEl) errEl.classList.remove('show');
  };

  const clearAll = (fields) => fields.forEach(clearError);

  return { email, minLen, noEmpty, match, showError, clearError, clearAll };
})();

/* ──────────────────────────────────────────────────────────
   8. ROUTER / UTILS
────────────────────────────────────────────────────────── */
const Utils = {
  sanitizeHTML: (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  },

  navigate: (url) => { window.location.href = url; },

  formatTime: (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  },

  scoreColor: (pct) => {
    if (pct >= 70) return 'var(--acid)';
    if (pct >= 50) return 'var(--amber)';
    return 'var(--coral)';
  },

  scoreLabel: (pct) => {
    if (pct >= 80) return 'Excelente 🏆';
    if (pct >= 70) return 'Muy bueno 🌟';
    if (pct >= 60) return 'Bien 👍';
    if (pct >= 50) return 'Regular 📚';
    return 'Necesitas repasar 💪';
  },

  // Highlight active nav link
  setActiveNav: () => {
    const current = window.location.pathname.split('/').pop();
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === current);
    });
  },

  // Update user display in navbar
  renderUserInNav: () => {
    const user = Session.getUser();
    const els = document.querySelectorAll('[data-user-name]');
    if (user) els.forEach(el => el.textContent = user.nombre || user.email);
  },
};

/* ──────────────────────────────────────────────────────────
   9. PAGE INITIALIZERS
   Cada página llama su init correspondiente
────────────────────────────────────────────────────────── */

// ── INDEX ──────────────────────────────────────────────────
const PageIndex = {
  init() {
    // Redirect if already logged in
    if (Session.isLoggedIn()) {
      const banner = document.getElementById('logged-in-banner');
      if (banner) banner.style.display = 'flex';
    }
  }
};

// ── LOGIN ──────────────────────────────────────────────────
const PageLogin = {
  init() {
    UI.initPasswordToggles();
    const form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      Validate.clearAll(['email', 'password']);

      let ok = true;
      if (!Validate.email(email)) { Validate.showError('email', 'Ingresa un correo válido.'); ok = false; }
      if (!Validate.minLen(password, 6)) { Validate.showError('password', 'Mínimo 6 caracteres.'); ok = false; }
      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Ingresando…';
      btn.disabled = true;

      try {
        await AuthAPI.login(email, password);
        UI.showToast('¡Bienvenido de vuelta!');
        setTimeout(() => Utils.navigate('dashboard'), 800);
      } catch (err) {
        const msg = err.mensaje || 'Error al iniciar sesión.';
        if (err.networkError) {
          UI.showToast('Sin conexión. Verifica tu internet.', 'error');
        } else {
          UI.showToast(msg, 'error');
          // Show error on the most relevant field
          if (msg.toLowerCase().includes('correo') || msg.toLowerCase().includes('email') || msg.toLowerCase().includes('usuario')) {
            Validate.showError('email', msg);
          } else if (msg.toLowerCase().includes('contraseña') || msg.toLowerCase().includes('password')) {
            Validate.showError('password', msg);
          } else {
            Validate.showError('email', msg);
          }
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    // Demo login
    const demoBtn = document.getElementById('demo-login');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        document.getElementById('email').value = 'demo@preparia.co';
        document.getElementById('password').value = 'Demo2025!';
        form.dispatchEvent(new Event('submit'));
      });
    }
  }
};

// ── REGISTRO ───────────────────────────────────────────────
const PageRegistro = {
  init() {
    UI.initPasswordToggles();
    const form = document.getElementById('registro-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = ['nombre', 'email', 'grado', 'password', 'confirm'];
      Validate.clearAll(fields);

      const v = {
        nombre:   document.getElementById('nombre').value,
        email:    document.getElementById('email').value,
        grado:    document.getElementById('grado').value,
        password: document.getElementById('password').value,
        confirm:  document.getElementById('confirm').value,
      };

      let ok = true;
      if (!Validate.minLen(v.nombre, 2))    { Validate.showError('nombre', 'Ingresa tu nombre completo.'); ok = false; }
      if (!Validate.email(v.email))          { Validate.showError('email', 'Correo electrónico inválido.'); ok = false; }
      if (!Validate.noEmpty(v.grado))        { Validate.showError('grado', 'Selecciona tu grado.'); ok = false; }
      if (!Validate.minLen(v.password, 6))   { Validate.showError('password', 'Mínimo 6 caracteres.'); ok = false; }
      if (!Validate.match(v.password, v.confirm)) { Validate.showError('confirm', 'Las contraseñas no coinciden.'); ok = false; }
      if (!ok) return;

      const btn = form.querySelector('[type=submit]');
      const originalText = btn.textContent;
      btn.textContent = 'Creando cuenta…';
      btn.disabled = true;

      try {
        // Split nombre into nombre and apellido
        const parts = v.nombre.trim().split(/\s+/);
        const nombre = parts[0];
        const apellido = parts.length > 1 ? parts.slice(1).join(' ') : '';

        await AuthAPI.register(nombre, apellido, v.email, v.password, v.grado);
        UI.showToast('¡Cuenta creada! Iniciando…');
        setTimeout(() => Utils.navigate('dashboard'), 900);
      } catch (err) {
        const msg = err.mensaje || 'Error al crear la cuenta.';
        if (err.networkError) {
          UI.showToast('Sin conexión. Verifica tu internet.', 'error');
        } else if (err.status === 409) {
          Validate.showError('email', 'Este correo ya está registrado.');
          UI.showToast('Este correo ya está registrado.', 'error');
        } else {
          UI.showToast(msg, 'error');
          Validate.showError('email', msg);
        }
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });

    // Strength indicator
    const pwdInput = document.getElementById('password');
    const strengthBar = document.getElementById('pwd-strength');
    if (pwdInput && strengthBar) {
      pwdInput.addEventListener('input', () => {
        const v = pwdInput.value;
        let score = 0;
        if (v.length >= 6) score++;
        if (v.length >= 10) score++;
        if (/[A-Z]/.test(v)) score++;
        if (/[0-9]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct = (score / 5) * 100;
        const color = score <= 1 ? 'var(--coral)' : score <= 3 ? 'var(--amber)' : 'var(--acid)';
        strengthBar.style.width = pct + '%';
        strengthBar.style.background = color;
      });
    }
  }
};

// ── DASHBOARD ──────────────────────────────────────────────
const PageDashboard = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    const user = Session.getUser();

    // Nombre usuario
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user?.nombre || 'Estudiante');

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    // Load data from backend
    await this.loadBackendData();
  },

  async loadBackendData() {
    // ── Get progress data ──
    try {
      const progresoRes = await ProgresoAPI.getProgreso();
      const datos = progresoRes.datos || progresoRes;

      // Stats cards
      const stats = datos.estadisticas || datos;
      const totalIntentos = stats.total_intentos || stats.total || 0;
      const promedio = stats.promedio_global || stats.promedio || stats.avg || 0;
      const mejor = stats.mejor_puntaje || stats.best || 0;
      const racha = datos.racha_actual || stats.racha || 0;

      const statEls = {
        'stat-simulacros': totalIntentos,
        'stat-promedio':   Math.round(promedio) + '%',
        'stat-mejor':      Math.round(mejor) + '%',
        'stat-racha':      racha,
      };
      Object.entries(statEls).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      });

      // Streak
      const streakEl = document.getElementById('streak-count');
      if (streakEl) streakEl.textContent = racha;

      // Update local streak from backend
      Streak.updateFromBackend(datos);

      // Render streak days with backend data
      const actividadSemanal = datos.actividad_semanal || [];
      if (typeof initStreakWidget === 'function') {
        initStreakWidget('streak-days', { current_streak: racha, activity_dates: actividadSemanal });
      } else {
        UI.renderStreakDaysFromBackend('streak-days', actividadSemanal);
      }

      // Progress bars per materia
      const progresoPorMateria = datos.progreso_por_materia || datos.materias || [];
      if (progresoPorMateria.length) {
        this.renderProgressBars(progresoPorMateria);
      }

    } catch (err) {
      console.warn('ProgresoAPI.getProgreso failed, using defaults:', err);
      // Show defaults (zeros)
      const statEls = {
        'stat-simulacros': 0,
        'stat-promedio':   '0%',
        'stat-mejor':      '—',
        'stat-racha':      0,
      };
      Object.entries(statEls).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
      });
      const streakEl = document.getElementById('streak-count');
      if (streakEl) streakEl.textContent = 0;
      UI.renderStreakDays('streak-days');

      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      }
    }

    // Animate progress bars
    UI.animateProgressBars();

    // ── Get recent simulacros ──
    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 3 });
      const historial = historialRes.datos || [];
      Simulacros.updateFromBackend(historial);
      this.renderRecentSimulacros();
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
      this.renderRecentSimulacros(); // Will show empty state
    }
  },

  renderProgressBars(materias) {
    const container = document.querySelector('.flex.flex-col.gap-md');
    if (!container) return;
    // Only update if we have real data
    const colors = ['var(--acid)', 'var(--sky)', 'var(--amber)', 'var(--coral)'];
    const colorClasses = ['', 'sky', 'amber', 'coral'];

    // Find the progress section (it has progress-bar children)
    const progressSection = document.querySelector('.card.no-hover .flex.flex-col.gap-md');
    if (!progressSection || !progressSection.querySelector('.progress-bar')) return;

    progressSection.innerHTML = materias.map((m, i) => {
      const nombre = m.nombre || m.materia || `Materia ${i + 1}`;
      const pct = Math.round(m.porcentaje || m.progreso || 0);
      const color = colors[i % colors.length];
      const cls = colorClasses[i % colorClasses.length];
      return `
        <div>
          <div class="flex justify-between mb-sm">
            <span style="font-size:0.88rem;font-weight:600">${Utils.sanitizeHTML(nombre)}</span>
            <span style="font-size:0.88rem;font-weight:700;color:${color}">${pct}%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill ${cls}" data-pct="${pct}" style="width:0%"></div></div>
        </div>
      `;
    }).join('');

    // Animate after render
    setTimeout(() => UI.animateProgressBars(), 100);
  },

  renderRecentSimulacros() {
    const container = document.getElementById('recent-simulacros');
    if (!container) return;
    const history = Simulacros.getHistory().slice(0, 3);
    if (!history.length) {
      container.innerHTML = `
        <div class="text-center" style="padding:40px 0; color:rgba(245,245,240,0.3)">
          <div style="font-size:2.5rem;margin-bottom:12px">📝</div>
          <p>Aún no tienes simulacros. ¡Empieza el primero!</p>
        </div>`;
      return;
    }
    container.innerHTML = history.map(h => `
      <div class="flex items-center justify-between" style="padding:14px 0; border-bottom:1px solid rgba(245,245,240,0.07)">
        <div>
          <div style="font-weight:700; font-size:0.9rem">${Utils.sanitizeHTML(h.tema)}</div>
          <div class="muted">${Utils.sanitizeHTML(h.date)}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.2rem; font-weight:800; color:${Utils.scoreColor(h.pct)}">${h.pct}%</div>
          <div class="muted">${h.score}/${h.total}</div>
        </div>
      </div>
    `).join('');
  }
};

// ── SIMULACROS ─────────────────────────────────────────────
const PageSimulacros = {
  state: {
    questions: [],
    current: 0,
    answers: {},
    timer: null,
    timeLeft: 0,
    finished: false,
    startTime: null,
    intentoId: null,
    simulacroId: null,
    simulacrosList: [],
  },

  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    // document.getElementById('start-btn')?.addEventListener('click', () => this.startSimulacro()); // Removed
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    // Load materias for IA modal (only Ciencias Sociales available for now)
    const selectMateria = document.getElementById('ia-materia');
    if (selectMateria) {
      selectMateria.innerHTML = '<option value="1">Ciencias Sociales</option>';
    }

    // Load history and available simulacros from backend
    await this.loadData();
  },

  async generateIAFast() {
    // Open modal directly in loading state
    UI.openModal('ia-modal');
    document.getElementById('ia-form').classList.add('hidden');
    document.getElementById('ia-loading').classList.remove('hidden');

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia: 1, // Ciencias Sociales
        id_nivel: 3, 
        dificultad: 'mixta', 
        mezclar_dificultad: true,
        cantidad: 10,
        titulo: `Simulacro con IA - ${new Date().toLocaleDateString()}`
      });
      
      UI.showToast(`✅ Simulacro generado con ${res.datos.total_preguntas} preguntas! Arrancando...`);
      UI.closeModal('ia-modal');
      
      // Select the newly generated simulacro
      this.state.simulacroId = res.datos.id_simulacro;
      
      // Start it automatically!
      await this.startSimulacro();

      // Reload simulacros list in background
      this.loadData();
    } catch (err) {
      UI.showToast(err.mensaje || 'Error al generar simulacro', 'error');
      UI.closeModal('ia-modal');
    }
  },

  async generateIA() {
    const materiaId = document.getElementById('ia-materia').value;
    const dificultad = document.getElementById('ia-dificultad').value;
    const cantidad = document.getElementById('ia-cantidad').value;
    const contexto = document.getElementById('ia-contexto').value;

    const form = document.getElementById('ia-form');
    const loading = document.getElementById('ia-loading');
    
    if (!materiaId || !cantidad) {
      UI.showToast('Completa todos los campos obligatorios', 'error');
      return;
    }

    form.classList.add('hidden');
    loading.classList.remove('hidden');

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia: parseInt(materiaId),
        id_nivel: 3, // Nivel por defecto (puede ser dinámico si agregamos un select de nivel)
        dificultad: dificultad, // Wait, backend takes mezclar_dificultad boolean based on my plan, not just string, but I can send them. Wait, backend logic takes mezclar_dificultad. Let's map it.
        mezclar_dificultad: dificultad === 'mixta',
        cantidad: parseInt(cantidad),
        titulo: `Simulacro con IA - ${new Date().toLocaleDateString()}`
      });
      
      UI.showToast(`✅ Simulacro generado con ${res.datos.total_preguntas} preguntas!`);
      UI.closeModal('ia-modal');
      
      // Reset form
      form.classList.remove('hidden');
      loading.classList.add('hidden');
      document.getElementById('ia-contexto').value = '';

      // Reload simulacros
      await this.loadData();
    } catch (err) {
      UI.showToast(err.mensaje || 'Error al generar simulacro', 'error');
      form.classList.remove('hidden');
      loading.classList.add('hidden');
    }
  },

  async loadData() {
    // Load history
    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 5 });
      const historial = historialRes.datos || [];
      Simulacros.updateFromBackend(historial);
    } catch (err) {
      console.warn('Could not load history:', err);
    }
    this.renderHistory();

    // Load available simulacros
    try {
      const simRes = await SimulacrosAPI.getSimulacros({ materia: 1 });
      const simulacros = simRes.datos || [];
      this.state.simulacrosList = simulacros;

      if (simulacros.length > 0) {
        this.state.simulacroId = simulacros[0].id || simulacros[0].id_simulacro;
      }
    } catch (err) {
      console.warn('Could not load simulacros:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      }
    }
  },

  async startSimulacro() {
    const btn = document.getElementById('start-btn');
    const s = this.state;

    // If no simulacro ID, show message
    if (!s.simulacroId) {
      UI.showToast('No hay simulacros disponibles. Contacta al administrador.', 'error');
      return;
    }

    // Disable button if it exists
    let originalText;
    if (btn) {
      originalText = btn.textContent;
      btn.textContent = 'Cargando simulacro…';
      btn.disabled = true;
    }

    try {
      const res = await SimulacrosAPI.iniciarIntento(s.simulacroId);
      const datos = res.datos || res;

      s.intentoId = datos.intento?.id || datos.intento?.id_intento || datos.id_intento || datos.id;
      s.questions = (datos.preguntas || []).map(p => ({
        id: p.id || p.id_pregunta,
        tema: p.tema || p.categoria || 'General',
        texto_base: p.texto_base ?? p.contexto ?? '',
        text: p.enunciado || p.texto || p.text,
        options: (p.opciones || p.options || []).map(o => ({
          id: o.id || o.id_opcion,
          text: o.texto || o.text || o.contenido,
          letra: o.letra
        })),
        correct: null, // We don't know the correct answer until finalized
        explanation: p.explicacion || '',
      }));
      s.current = 0;
      s.answers = {};
      s.finished = false;
      s.timeLeft = (datos.simulacro?.duracion_minutos || 20) * 60;
      s.startTime = Date.now();

      document.getElementById('simulacro-start')?.classList.add('hidden');
      document.getElementById('simulacro-quiz')?.classList.remove('hidden');

      this.renderQuestion();
      this.startTimer();
    } catch (err) {
      console.error('Error starting simulacro:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      } else {
        UI.showToast(err.mensaje || 'Error al iniciar el simulacro.', 'error');
      }
      btn.textContent = originalText;
      btn.disabled = false;
    }
  },

  renderQuestion() {
    const s = this.state;
    const q = s.questions[s.current];
    if (!q) return;

    const container = document.getElementById('question-container');
    const total = s.questions.length;

    // Progress
    document.getElementById('q-progress').textContent = `${s.current + 1} / ${total}`;
    const bar = document.getElementById('q-progress-bar');
    if (bar) bar.style.width = ((s.current + 1) / total * 100) + '%';

    container.innerHTML = `
      <div class="question-card fade-in-up">
        <div class="question-number">Pregunta ${s.current + 1} · ${Utils.sanitizeHTML(q.tema)}</div>
        ${q.texto_base ? `<div class="question-context">${Utils.sanitizeHTML(q.texto_base)}</div>` : ''}
        <div class="question-text">${q.text}</div>
        <div class="options-list" id="options-list">
          ${q.options.map((opt, i) => `
            <div class="option-item ${s.answers[q.id] === i ? 'selected' : ''}"
                 data-index="${i}" onclick="PageSimulacros.selectAnswer(${i})">
              <div class="option-letter">${String.fromCharCode(65 + i)}</div>
              <div>${typeof opt === 'string' ? opt : opt.text}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Nav buttons
    document.getElementById('btn-prev').disabled = s.current === 0;
    document.getElementById('btn-next').textContent = s.current === total - 1 ? 'Finalizar 🏁' : 'Siguiente →';
  },

  selectAnswer(index) {
    const s = this.state;
    const q = s.questions[s.current];
    s.answers[q.id] = index;

    document.querySelectorAll('.option-item').forEach((el, i) => {
      el.classList.toggle('selected', i === index);
    });

    // Optimistic UI: send answer to backend (don't wait)
    if (s.intentoId) {
      const opcion = q.options[index];
      const idOpcion = typeof opcion === 'object' ? opcion.id : index;
      SimulacrosAPI.responderPregunta(s.intentoId, q.id, idOpcion).catch(err => {
        console.warn('Error sending answer:', err);
      });
    }
  },

  prevQuestion() {
    if (this.state.current > 0) {
      this.state.current--;
      this.renderQuestion();
    }
  },

  nextQuestion() {
    const s = this.state;
    if (s.current < s.questions.length - 1) {
      s.current++;
      this.renderQuestion();
    } else {
      this.finishSimulacro();
    }
  },

  startTimer() {
    const s = this.state;
    const display = document.getElementById('timer');
    s.timer = setInterval(() => {
      s.timeLeft--;
      if (display) {
        display.textContent = Utils.formatTime(s.timeLeft);
        display.className = 'timer-display';
        if (s.timeLeft <= 120) display.classList.add('warning');
        if (s.timeLeft <= 30)  display.classList.add('danger');
      }
      if (s.timeLeft <= 0) this.finishSimulacro();
    }, 1000);
  },

  async finishSimulacro() {
    const s = this.state;
    if (s.finished) return;
    s.finished = true;
    clearInterval(s.timer);

    const timeUsed = Math.round((Date.now() - s.startTime) / 1000);

    // Call backend to finalize
    try {
      const res = await SimulacrosAPI.finalizarIntento(s.intentoId);
      const datos = res.datos || res;

      const puntaje = datos.puntaje || datos.porcentaje || 0;
      const correctas = datos.correctas || datos.aciertos || 0;
      const total = datos.total_preguntas || datos.total || s.questions.length;
      const pct = datos.porcentaje || Math.round((correctas / total) * 100);
      const retroalimentacion = datos.retroalimentacion || datos.revisiones || datos.respuestas || [];

      // Save result locally
      Simulacros.saveResult({ score: correctas, total, timeUsed, pct });

      // Fire points toast if the module is loaded
      if (typeof showPointsToast === 'function' && datos.gamificacion) {
        showPointsToast(datos.gamificacion);
      }

      // Show results
      document.getElementById('simulacro-quiz')?.classList.add('hidden');
      const resultEl = document.getElementById('simulacro-result');
      resultEl?.classList.remove('hidden');

      document.getElementById('result-score-ring').innerHTML = UI.renderScoreRing(pct);
      document.getElementById('result-score-text').innerHTML = `
        <div style="font-size:1.4rem;font-weight:800">${correctas} / ${total} correctas</div>
        <div class="mt-sm" style="color:${Utils.scoreColor(pct)};font-weight:700">${Utils.scoreLabel(pct)}</div>
        <div class="muted mt-sm">Tiempo: ${Utils.formatTime(timeUsed)}</div>
      `;

      // Render review with backend retroalimentacion
      this.renderReview(retroalimentacion);

    } catch (err) {
      console.error('Error finalizing simulacro:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      } else {
        UI.showToast(err.mensaje || 'Error al finalizar el simulacro.', 'error');
      }

      // Calculate locally as fallback
      let correct = 0;
      s.questions.forEach(q => {
        if (s.answers[q.id] === q.correct) correct++;
      });
      const pct = Math.round((correct / s.questions.length) * 100);

      Simulacros.saveResult({ score: correct, total: s.questions.length, timeUsed, pct });

      document.getElementById('simulacro-quiz')?.classList.add('hidden');
      const resultEl = document.getElementById('simulacro-result');
      resultEl?.classList.remove('hidden');

      document.getElementById('result-score-ring').innerHTML = UI.renderScoreRing(pct);
      document.getElementById('result-score-text').innerHTML = `
        <div style="font-size:1.4rem;font-weight:800">${correct} / ${s.questions.length} correctas</div>
        <div class="mt-sm" style="color:${Utils.scoreColor(pct)};font-weight:700">${Utils.scoreLabel(pct)}</div>
        <div class="muted mt-sm">Tiempo: ${Utils.formatTime(timeUsed)}</div>
      `;

      this.renderReview([]);
    }
  },

  renderReview(retroalimentacion = []) {
    const s = this.state;
    const container = document.getElementById('review-container');
    if (!container) return;

    if (retroalimentacion.length) {
      // Render from backend retroalimentacion
      container.innerHTML = retroalimentacion.map((r, qi) => {
        const pregunta = r.enunciado || r.pregunta || r.texto || `Pregunta ${qi + 1}`;
        const isCorrect = r.es_correcta || r.correcta || false;
        const opciones = r.opciones || [];
        const explicacion = r.explicacion || r.retroalimentacion || '';
        const textoBase = r.texto_base ?? r.contexto ?? '';

        return `
          <div class="question-card no-hover" style="margin-bottom:16px">
            <div class="question-number">Pregunta ${qi + 1} · ${isCorrect ? '✅ Correcta' : '❌ Incorrecta'}</div>
            ${textoBase ? `<div class="question-context">${Utils.sanitizeHTML(textoBase)}</div>` : ''}
            <div class="question-text">${pregunta}</div>
            ${opciones.length ? `
              <div class="options-list">
                ${opciones.map((opt, i) => {
                  const esCorrecta = opt.es_correcta || false;
                  const fueSeleccionada = opt.seleccionada || false;
                  return `
                    <div class="option-item ${esCorrecta ? 'correct' : ''} ${fueSeleccionada && !esCorrecta ? 'wrong' : ''}">
                      <div class="option-letter">${String.fromCharCode(65 + i)}</div>
                      <div>${opt.texto || opt.text || opt.contenido}</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}
            ${!isCorrect && explicacion ? `<div class="alert alert-info mt-md">💡 ${explicacion}</div>` : ''}
          </div>
        `;
      }).join('');
    } else {
      // Fallback: render from local state (limited info)
      container.innerHTML = s.questions.map((q, qi) => {
        const userAns = s.answers[q.id];
        return `
          <div class="question-card no-hover" style="margin-bottom:16px">
            <div class="question-number">Pregunta ${qi + 1} · ${Utils.sanitizeHTML(q.tema)}</div>
            ${q.texto_base ? `<div class="question-context">${Utils.sanitizeHTML(q.texto_base)}</div>` : ''}
            <div class="question-text">${q.text}</div>
            <div class="options-list">
              ${q.options.map((opt, i) => {
                const text = typeof opt === 'string' ? opt : opt.text;
                return `
                  <div class="option-item ${i === userAns ? 'selected' : ''}">
                    <div class="option-letter">${String.fromCharCode(65 + i)}</div>
                    <div>${text}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    }
  },

  renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    const history = Simulacros.getHistory();
    if (!history.length) {
      container.innerHTML = '<p style="color:rgba(245,245,240,0.3);text-align:center;padding:20px 0">Aún no hay simulacros registrados.</p>';
      return;
    }
    container.innerHTML = history.slice(0, 5).map(h => `
      <div class="flex items-center justify-between" style="padding:12px 0;border-bottom:1px solid rgba(245,245,240,0.07)">
        <div>
          <div style="font-weight:600;font-size:0.88rem">${h.date}</div>
          <div class="muted">${h.score}/${h.total} correctas</div>
        </div>
        <div style="font-size:1.3rem;font-weight:800;color:${Utils.scoreColor(h.pct)}">${h.pct}%</div>
      </div>
    `).join('');
  },

  retake() {
    document.getElementById('simulacro-result')?.classList.add('hidden');
    document.getElementById('simulacro-start')?.classList.remove('hidden');
    document.getElementById('simulacro-start').classList.remove('hidden');

    // Reset state
    const s = this.state;
    s.intentoId = null;
    s.questions = [];
    s.current = 0;
    s.answers = {};
    s.finished = false;

    // Re-enable start button
    const btn = document.getElementById('start-btn');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Iniciar simulacro';
    }
  }
};

// ── ESTADÍSTICAS ───────────────────────────────────────────
const PageEstadisticas = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    // Load data from backend
    await this.loadBackendData();
  },

  async loadBackendData() {
    let stats = { avg: 0, best: 0, total: 0, lastPct: 0 };
    let historyData = [];
    let streakData = { count: 0, longest: 0 };

    // ── Get progress ──
    try {
      const progresoRes = await ProgresoAPI.getProgreso();
      const datos = progresoRes.datos || progresoRes;

      const backendStats = datos.estadisticas || datos;
      stats = {
        total: backendStats.total_intentos || backendStats.total || 0,
        avg:   Math.round(backendStats.promedio_global || backendStats.promedio || 0),
        best:  Math.round(backendStats.mejor_puntaje || backendStats.best || 0),
      };
      streakData = {
        count: datos.racha_actual || 0,
        longest: datos.racha_maxima || backendStats.racha_maxima || 0,
      };

      // Update Streak from backend data
      Streak.updateFromBackend(datos);

      // Render topic bars if data available
      const progresoPorMateria = datos.progreso_por_materia || datos.materias || [];
      if (progresoPorMateria.length) {
        this.renderTopicBars(progresoPorMateria);
      }

      // Render heatmap from backend
      const actividadSemanal = datos.actividad_semanal || [];
      if (actividadSemanal.length) {
        this.renderHeatmapFromBackend(actividadSemanal);
      }

    } catch (err) {
      console.warn('ProgresoAPI.getProgreso failed:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      }
      // Use local data as fallback
      stats = Simulacros.getStats();
      const localStreak = Streak.get();
      streakData = { count: localStreak.count, longest: localStreak.longest };
    }

    // ── Get historial ──
    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 20 });
      historyData = historialRes.datos || [];
      Simulacros.updateFromBackend(historyData);
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
    }

    // Use local history (updated or fallback)
    const history = Simulacros.getHistory();

    // Summary stats
    const els = {
      'stats-total':    stats.total,
      'stats-promedio': stats.avg + '%',
      'stats-mejor':    stats.best + '%',
      'stats-racha':    streakData.longest || streakData.count,
    };
    Object.entries(els).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });

    // Score ring promedio
    const ringEl = document.getElementById('avg-score-ring');
    if (ringEl) ringEl.innerHTML = UI.renderScoreRing(stats.avg);

    // Level label
    const levelEl = document.getElementById('level-label');
    if (levelEl) {
      levelEl.textContent = Utils.scoreLabel(stats.avg);
      levelEl.style.color = Utils.scoreColor(stats.avg);
    }

    // Improve tip
    const tipEl = document.getElementById('improve-tip');
    if (tipEl && history.length) {
      const tips = [
        'Repasa Historia de Colombia',
        'Practica preguntas de Geografía',
        'Estudia la Constitución de 1991',
        'Refuerza conceptos económicos',
      ];
      tipEl.textContent = tips[Math.floor(Math.random() * tips.length)];
    }

    // Charts
    if (history.length) {
      const chartEmpty = document.getElementById('chart-empty');
      const chartWrapper = document.getElementById('chart-wrapper');
      if (chartEmpty) chartEmpty.style.display = 'none';
      if (chartWrapper) chartWrapper.style.display = 'block';

      const last8 = history.slice(0, 8).reverse();
      const labels = last8.map(h => h.date?.split(' ')[0] || '');
      const data   = last8.map(h => h.pct);
      setTimeout(() => UI.renderBarChart('chart-scores', labels, data), 100);
    }

    // Table
    this.renderTable(history);
  },

  renderTopicBars(materias) {
    const container = document.getElementById('topic-bars');
    if (!container) return;

    const colors = ['var(--acid)', 'var(--sky)', 'var(--amber)', 'var(--coral)'];
    container.innerHTML = materias.map((m, i) => {
      const nombre = m.nombre || m.materia || `Materia ${i + 1}`;
      const pct = Math.round(m.porcentaje || m.progreso || 0);
      const color = colors[i % colors.length];
      return `
        <div class="topic-bar">
          <div class="topic-name">${nombre}</div>
          <div class="topic-track">
            <div class="topic-fill" style="width:${pct}%;background:${color}"></div>
          </div>
          <div class="topic-pct" style="color:${color}">${pct}%</div>
        </div>
      `;
    }).join('');
  },

  renderHeatmapFromBackend(actividad) {
    const heatmap = document.getElementById('heatmap');
    if (!heatmap) return;
    heatmap.innerHTML = '';

    const history = Simulacros.getHistory();
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split('T')[0];
      const inActivity = actividad.includes(str);
      const simCount = history.filter(h => h.date?.includes(d.getDate())).length;
      let level = 0;
      if (inActivity) level = simCount >= 2 ? 3 : simCount === 1 ? 2 : 1;
      const cell = document.createElement('div');
      cell.className = `heat-cell level-${level}`;
      cell.title = `${str}: ${inActivity ? 'Activo' : 'Inactivo'}`;
      heatmap.appendChild(cell);
    }
  },

  renderTable(history) {
    const tbody = document.getElementById('stats-tbody');
    if (!tbody) return;
    if (!history.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:rgba(245,245,240,0.3);padding:32px">Sin datos aún.</td></tr>`;
      return;
    }
    tbody.innerHTML = history.map((h, i) => `
      <tr>
        <td><span class="badge badge-outline">#${history.length - i}</span></td>
        <td>${h.date}</td>
        <td>${h.score} / ${h.total}</td>
        <td style="color:${Utils.scoreColor(h.pct)};font-weight:800">${h.pct}%</td>
        <td>${Utils.scoreLabel(h.pct)}</td>
      </tr>
    `).join('');
  }
};

// ── CIENCIAS SOCIALES (Tree) ───────────────────────────────
const PageCienciasSociales = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());
    document.getElementById('save-node-btn')?.addEventListener('click', () => this.addNewNode());
    document.getElementById('reset-tree-btn')?.addEventListener('click', () => {
      if (confirm('¿Reiniciar el árbol al estado original? Se perderán los nodos personalizados.')) {
        State.remove(State.KEYS.TREE_NODES);
        this.loadTree();
        UI.showToast('Árbol reiniciado.');
      }
    });

    const user = Auth.getUser();
    this.isAdmin = user && user.rol === 'admin';
    console.log('[DEBUG] User object:', user, '| isAdmin:', this.isAdmin);

    // Mostrar botón de agregar nodo global solo a admin
    const addNodeCard = document.getElementById('add-node-card');
    if (addNodeCard && this.isAdmin) {
      addNodeCard.style.display = 'flex';
    }

    // Clear any stale cached tree so the merge logic starts fresh
    State.remove(State.KEYS.TREE_NODES);

    // Load tree from backend
    await this.loadTree();
  },

  async loadTree() {
    try {
      const res = await NodosAPI.getArbol(1); // materia id=1 = Ciencias Sociales
      const datos = res.datos || res;
      const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);

      TreeManager.setTreeFromBackend(backendTree);
    } catch (err) {
      console.warn('NodosAPI.getArbol failed, using local tree:', err);
      if (err.networkError) {
        UI.showToast('Sin conexión. Mostrando datos locales.', 'error');
      }
      // Will use the default or cached tree
    }

    this.renderTree();
  },

  renderTree() {
    const container = document.getElementById('tree-container');
    if (!container) return;
    const tree = TreeManager.getTree();

    if (!tree || !tree.length) {
      container.innerHTML = `
        <div class="text-center" style="padding:60px 20px;color:rgba(245,245,240,0.3)">
          <div style="font-size:3rem;margin-bottom:12px">🌱</div>
          <p>El árbol de contenidos está vacío.</p>
          <button onclick="PageCienciasSociales.loadTree()" class="btn btn-ghost btn-sm mt-md">🔄 Recargar</button>
        </div>`;
      return;
    }

    container.innerHTML = tree.map(node => this.renderNode(node, 0)).join('');

    // Attach delegated dblclick for inline editing (admin only)
    this.setupInlineEditListeners();
  },

  renderNode(node, level) {
    const hasChildren = node.children && node.children.length > 0;
    const levelClass = `level-${Math.min(level, 3)}`;
    const leafClass  = !hasChildren ? 'tree-leaf' : '';

    const addChildBtn = this.isAdmin
      ? `<button class="tree-add-child-btn" onclick="event.stopPropagation(); PageCienciasSociales.addChildInline('${node.id}')" title="Agregar subtema">+</button>`
      : '';

    return `
      <div class="tree-node ${levelClass} ${leafClass}" id="node-${node.id}" data-node-id="${node.id}">
        <div class="tree-node-header ${hasChildren ? '' : ''}" onclick="${hasChildren ? `PageCienciasSociales.toggleNode('${node.id}')` : `PageCienciasSociales.showNodeContent('${node.id}')`}">
          ${hasChildren ? '<div class="tree-toggle">▶</div>' : '<div style="width:22px"></div>'}
          <span style="font-size:1.1rem">${Utils.sanitizeHTML(node.icon || '📌')}</span>
          <span class="tree-node-label" data-node-id="${node.id}">${Utils.sanitizeHTML(node.label)}</span>
          ${node.custom ? '<span class="badge badge-sky" style="margin-left:auto;font-size:0.65rem">Custom</span>' : ''}
          ${hasChildren ? `<span class="badge badge-outline tree-node-badge">${node.children.length}</span>` : ''}
          ${addChildBtn}
          ${this.isAdmin ? `<button class="btn btn-ghost btn-sm" style="color: var(--coral); margin-left: 8px; padding: 0 4px;" onclick="event.stopPropagation(); PageCienciasSociales.deleteNodeById('${node.id}')" title="Eliminar nodo">🗑️</button>` : ''}
        </div>
        ${hasChildren ? `
          <div class="tree-node-children" id="children-${node.id}">
            ${node.children.map(child => this.renderNode(child, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  },


  toggleNode(nodeId) {
    // Track selected node and update visual indicator
    document.querySelectorAll('.tree-node-header.node-selected')
      .forEach(el => el.classList.remove('node-selected'));
    this.selectedNodeId = nodeId;

    const header   = document.querySelector(`#node-${nodeId} > .tree-node-header`);
    const children = document.getElementById(`children-${nodeId}`);
    if (!children) return;
    const isOpen = children.classList.toggle('open');
    header?.classList.toggle('open', isOpen);
    if (header) header.classList.add('node-selected');
  },

  showNodeContent(nodeId) {
    // Navegar a la página dedicada de contenido del nodo
    window.location.href = `nodo.html?id=${encodeURIComponent(nodeId)}`;
  },

  expandAll() {
    document.querySelectorAll('.tree-node-children').forEach(el => el.classList.add('open'));
    document.querySelectorAll('.tree-node-header').forEach(el => el.classList.add('open'));
  },

  collapseAll() {
    document.querySelectorAll('.tree-node-children').forEach(el => el.classList.remove('open'));
    document.querySelectorAll('.tree-node-header').forEach(el => el.classList.remove('open'));
  },

  selectedNodeId: null,

  /* ── Finds the parent ID of a given node in the tree ──── */
  _findParentId(nodeId) {
    const tree = TreeManager.getTree();
    const find = (nodes, parentId) => {
      for (const n of nodes) {
        if (String(n.id) === String(nodeId)) return parentId;
        if (n.children) {
          const r = find(n.children, n.id);
          if (r !== undefined) return r;
        }
      }
      return undefined;
    };
    return find(tree, null); // null = node is at root level
  },

  /* ── Shows the node-type chooser dropdown near the trigger ── */
  showNodeTypeSelector() {
    const dropdown = document.getElementById('node-type-selector');
    if (!dropdown) return;

    // Toggle off if already visible
    if (dropdown.style.display === 'block') {
      dropdown.style.display = 'none';
      dropdown.classList.remove('visible');
      return;
    }

    // Position relative to the card button
    const trigger = document.getElementById('add-node-card');
    if (trigger) {
      const rect     = trigger.getBoundingClientRect();
      const dropH    = 152;
      const dropW    = 240;
      const spaceAbove = rect.top;

      var topPos = spaceAbove >= dropH + 16 ? rect.top - dropH - 8 : rect.bottom + 8;
      var leftPos = Math.min(rect.left, window.innerWidth - dropW - 8);

      dropdown.style.position = 'fixed';
      dropdown.style.top    = Math.max(8, topPos) + 'px';
      dropdown.style.left   = Math.max(8, leftPos) + 'px';
      dropdown.style.right  = 'auto';
      dropdown.style.bottom = 'auto';
    }

    // Show — set display first, then add class for animation
    dropdown.style.display = 'block';
    dropdown.classList.add('visible');

    var dropdown2 = dropdown; // closure reference

    function closeDropdown(e) {
      var card = document.getElementById('add-node-card');
      if (!dropdown2.contains(e.target) && (!card || !card.contains(e.target))) {
        dropdown2.style.display = 'none';
        dropdown2.classList.remove('visible');
        document.removeEventListener('click', closeDropdown, true);
        document.removeEventListener('keydown', onEsc);
      }
    }

    function onEsc(e) {
      if (e.key === 'Escape') {
        dropdown2.style.display = 'none';
        dropdown2.classList.remove('visible');
        document.removeEventListener('click', closeDropdown, true);
        document.removeEventListener('keydown', onEsc);
      }
    }

    setTimeout(function() {
      document.addEventListener('click', closeDropdown, true);
      document.addEventListener('keydown', onEsc);
    }, 0);
  },

  /* ── Routes to the correct modal flow based on node type ── */
  handleNodeTypeChoice(type) {
    const dropdown = document.getElementById('node-type-selector');
    if (dropdown) {
      dropdown.classList.remove('visible');
      dropdown.style.display = 'none';
    }

    if (type === 'hijo') {
      if (this.selectedNodeId) {
        this.openAddModal(this.selectedNodeId, 'hijo');
      } else {
        const tree = TreeManager.getTree();
        this.openAddModal(tree.length > 0 ? tree[0].id : null, 'hijo');
      }
    } else { // 'padre'
      if (this.selectedNodeId) {
        const parentId = this._findParentId(this.selectedNodeId);
        const grandparentId = parentId ? this._findParentId(parentId) : null;
        this.openAddModal(grandparentId, 'padre');
      } else {
        this.openAddModal(null, 'padre');
      }
    }
  },

  openAddModal(parentId, tipo = 'hijo') {
    document.getElementById('new-node-parent').value = (parentId !== null && parentId !== undefined) ? parentId : '';
    document.getElementById('new-node-label').value = '';

    const categoryGroup = document.getElementById('parent-category-group');
    const categoryLabel = document.getElementById('parent-category-label');
    const modalTitle    = document.querySelector('#add-node-modal .modal-header h3');

    if (tipo === 'padre') {
      if (modalTitle) modalTitle.textContent = '🌳 Nuevo nodo padre';
      if (categoryGroup) categoryGroup.style.display = 'none';
    } else {
      if (modalTitle) modalTitle.textContent = '➕ Agregar nodo';
      if (categoryGroup) categoryGroup.style.display = '';
      if (categoryLabel) categoryLabel.textContent = 'Categoría principal';

      const tree = TreeManager.getTree();
      const selector = document.getElementById('parent-category-selector');
      if (selector) {
        const activeId = (parentId !== null && parentId !== undefined) ? String(parentId) : '';
        selector.innerHTML = tree.map(function(node, i) {
          var isSelected = (activeId && activeId === String(node.id)) || (!activeId && i === 0);
          return '<button type="button" class="icon-btn ' + (isSelected ? 'selected' : '') + '" title="' + node.label + '"' +
            ' onclick="document.getElementById(\'new-node-parent\').value=\'' + node.id + '\';' +
            'document.querySelectorAll(\'#parent-category-selector .icon-btn\').forEach(function(b){b.classList.remove(\'selected\')});' +
            'this.classList.add(\'selected\')">' +
            (node.icon || '📌') +
            '</button>';
        }).join('');
        if (!activeId && tree.length > 0) {
          document.getElementById('new-node-parent').value = tree[0].id;
        }
      }
    }

    const contentEl = document.getElementById('new-node-content');
    if (contentEl) contentEl.value = '';

    UI.openModal('add-node-modal');
    setTimeout(() => document.getElementById('new-node-label')?.focus(), 300);
  },

  async addNewNode() {
    const parentId = document.getElementById('new-node-parent').value;
    const label    = document.getElementById('new-node-label').value.trim();
    const icon     = '📌'; // Default icon for new custom nodes
    const contentEl = document.getElementById('new-node-content');
    const content   = contentEl ? contentEl.value.trim() : '';

    if (!label) { UI.showToast('Escribe un nombre para el nodo.', 'error'); return; }

    const btn = document.getElementById('save-node-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando...';
    }

    try {
      await NodosAPI.crearNodo({
        id_padre: parentId,
        nombre: label,
        icono: icon,
        contenido: content
      });

      UI.showToast(`Nodo "${label}" guardado en la base de datos exitosamente.`, 'success');
      UI.closeModal('add-node-modal');
      
      // Recargar el árbol desde el servidor
      await this.loadTree();
    } catch (error) {
      console.error('Error al crear el nodo:', error);
      UI.showToast(error.message || 'Error al guardar el nodo.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Agregar ✓';
      }
    }
  },

  async deleteNodeById(nodeId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este nodo y todo su contenido?')) return;

    try {
      // Verificar si es un ID numérico (del backend) o un string (del árbol local/default)
      if (!isNaN(parseInt(nodeId)) && !String(nodeId).match(/^[a-zA-Z]/)) {
        await NodosAPI.eliminarNodo(nodeId);
      } else {
        TreeManager.deleteNode(nodeId);
      }
      
      UI.showToast('Nodo eliminado correctamente.', 'success');
      
      // Intentar recargar el árbol del backend, si falla usará el local actualizado
      await this.loadTree();
      
      // Forzar renderizado local por si acaso el backend está offline y loadTree falla silenciosamente
      this.renderTree();
    } catch (err) {
      console.error('Error al eliminar nodo:', err);
      UI.showToast(err.mensaje || 'Error al eliminar el nodo.', 'error');
    }
  },

  /* ── Inline Edit: doble clic para renombrar nodo ─────── */
  startInlineEdit(nodeId) {
    if (!this.isAdmin) return;

    const nodeEl = document.getElementById(`node-${nodeId}`);
    if (!nodeEl) return;
    const labelSpan = nodeEl.querySelector(`:scope > .tree-node-header .tree-node-label[data-node-id="${nodeId}"]`);
    if (!labelSpan) return;

    // Avoid double-activation
    if (labelSpan.querySelector('.tree-inline-input')) return;

    const originalText = labelSpan.textContent.trim();
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.value = originalText;
    input.setAttribute('data-original', originalText);

    // Replace label content with input
    labelSpan.textContent = '';
    labelSpan.appendChild(input);
    input.focus();
    input.select();

    let saved = false;

    const save = async () => {
      if (saved) return;
      saved = true;

      const newName = input.value.trim();

      // Restore label span
      if (labelSpan.contains(input)) {
        labelSpan.removeChild(input);
      }

      // If empty or unchanged, restore original
      if (!newName || newName === originalText) {
        labelSpan.textContent = originalText;
        return;
      }

      // Update DOM immediately
      labelSpan.textContent = newName;

      // Persist to backend if it's a backend node
      if (!isNaN(parseInt(nodeId)) && !String(nodeId).match(/^[a-zA-Z]/)) {
        try {
          await NodosAPI.actualizarNombre(nodeId, newName);
          UI.showToast(`Nodo renombrado a "${newName}"`, 'success');
        } catch (err) {
          console.error('Error al renombrar nodo:', err);
          labelSpan.textContent = originalText;
          UI.showToast(err.mensaje || 'Error al renombrar el nodo.', 'error');
        }
      } else {
        // Update local tree
        const node = TreeManager.getNodeById(nodeId);
        if (node) {
          node.label = newName;
          TreeManager.saveTree(TreeManager.getTree());
        }
        UI.showToast(`Nodo renombrado a "${newName}"`, 'success');
      }
    };

    const cancel = () => {
      if (saved) return;
      saved = true;
      if (labelSpan.contains(input)) {
        labelSpan.removeChild(input);
      }
      labelSpan.textContent = originalText;
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    });

    input.addEventListener('blur', () => {
      // Small delay to allow Escape keydown to fire first
      setTimeout(() => save(), 80);
    });

    // Prevent the click from toggling/navigating
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  },

  /* ── Add Child Inline: botón "+" crea nodo hijo ──────── */
  async addChildInline(parentId) {
    if (!this.isAdmin) return;

    // Ensure the parent node's children container exists and is open
    let childrenContainer = document.getElementById(`children-${parentId}`);
    const parentNodeEl = document.getElementById(`node-${parentId}`);
    if (!parentNodeEl) return;

    if (!childrenContainer) {
      // Create children container if parent was a leaf
      childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-node-children open';
      childrenContainer.id = `children-${parentId}`;
      parentNodeEl.appendChild(childrenContainer);
    }

    // Ensure it's open
    childrenContainer.classList.add('open');
    const header = parentNodeEl.querySelector(':scope > .tree-node-header');
    if (header) header.classList.add('open');

    // Create temporary node DOM
    const tempId = 'temp_' + Date.now();
    const tempDiv = document.createElement('div');
    tempDiv.className = 'tree-node tree-leaf temp-node';
    tempDiv.id = `node-${tempId}`;
    tempDiv.setAttribute('data-node-id', tempId);

    // Determine child level
    const parentLevel = parseInt((parentNodeEl.className.match(/level-(\d)/) || [0, 0])[1]);
    const childLevel = Math.min(parentLevel + 1, 3);
    tempDiv.classList.add(`level-${childLevel}`);

    tempDiv.innerHTML = `
      <div class="tree-node-header">
        <div style="width:22px"></div>
        <span style="font-size:1.1rem">📌</span>
        <span class="tree-node-label" data-node-id="${tempId}">Nuevo tema</span>
      </div>
    `;

    childrenContainer.appendChild(tempDiv);
    tempDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Enter inline edit mode on the temp node
    const labelSpan = tempDiv.querySelector('.tree-node-label');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tree-inline-input';
    input.value = 'Nuevo tema';
    input.setAttribute('data-original', '');

    labelSpan.textContent = '';
    labelSpan.appendChild(input);
    input.focus();
    input.select();

    let resolved = false;

    const confirmCreate = async () => {
      if (resolved) return;
      resolved = true;

      const newName = input.value.trim();

      // If empty or still default — cancel
      if (!newName) {
        tempDiv.remove();
        return;
      }

      // Update DOM with the name
      if (labelSpan.contains(input)) {
        labelSpan.removeChild(input);
      }
      labelSpan.textContent = newName;

      // POST to backend
      try {
        const res = await NodosAPI.crearNodo({
          id_padre: parentId,
          nombre: newName,
          icono: '📌'
        });

        const serverId = res.datos?.id;
        if (serverId) {
          // Update temp node with real server ID
          tempDiv.id = `node-${serverId}`;
          tempDiv.setAttribute('data-node-id', serverId);
          labelSpan.setAttribute('data-node-id', serverId);

          // Make it clickable to navigate
          const headerEl = tempDiv.querySelector('.tree-node-header');
          if (headerEl) {
            headerEl.setAttribute('onclick', `PageCienciasSociales.showNodeContent('${serverId}')`);
          }
        }

        UI.showToast(`Nodo "${newName}" creado exitosamente.`, 'success');

        // Update parent badge count
        const parentBadge = parentNodeEl.querySelector(':scope > .tree-node-header .tree-node-badge');
        if (parentBadge) {
          const currentCount = parseInt(parentBadge.textContent) || 0;
          parentBadge.textContent = currentCount + 1;
        }

        // Reload tree in background to sync state
        setTimeout(() => this.loadTree(), 500);

      } catch (err) {
        console.error('Error al crear nodo hijo:', err);
        UI.showToast(err.mensaje || 'Error al crear el nodo.', 'error');
        tempDiv.remove();
      }
    };

    const cancelCreate = () => {
      if (resolved) return;
      resolved = true;
      tempDiv.remove();
    };

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCreate();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelCreate();
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!resolved) {
          const val = input.value.trim();
          if (!val) {
            cancelCreate();
          } else {
            confirmCreate();
          }
        }
      }, 80);
    });

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
  },

  /* ── Delegated dblclick listener for inline edit ──────── */
  setupInlineEditListeners() {
    if (!this.isAdmin) return;

    const container = document.getElementById('tree-container');
    if (!container || container._inlineEditBound) return;
    container._inlineEditBound = true;

    container.addEventListener('dblclick', (e) => {
      const label = e.target.closest('.tree-node-label');
      if (!label) return;

      e.preventDefault();
      e.stopPropagation();

      const nodeId = label.getAttribute('data-node-id');
      if (nodeId) {
        this.startInlineEdit(nodeId);
      }
    });
  },
};

// ── NODO (Content Page) ────────────────────────────────────
const PageNodo = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    // Get node ID from URL
    const params = new URLSearchParams(window.location.search);
    const nodeId = params.get('id');

    if (!nodeId) {
      this.showError('No se especificó un nodo.');
      return;
    }

    // Clear any stale cached tree so the merge logic starts fresh
    State.remove(State.KEYS.TREE_NODES);

    // Load tree first to have local data
    try {
      const res = await NodosAPI.getArbol(1);
      const datos = res.datos || res;
      const backendTree = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
      TreeManager.setTreeFromBackend(backendTree);
    } catch (err) {
      console.warn('Could not load tree from backend:', err);
    }

    const node = TreeManager.getNodeById(nodeId);
    if (!node) {
      this.showError('No se encontró el nodo solicitado.');
      return;
    }

    // Render header info
    this.renderHeader(node, nodeId);

    // Load content
    await this.loadContent(node, nodeId);

    // Render children if any
    this.renderChildren(node);

    // Render Navigation
    this.renderNavigation(nodeId);
  },

  renderHeader(node, nodeId) {
    const iconEl = document.getElementById('node-icon');
    const titleEl = document.getElementById('node-title');
    const breadcrumbEl = document.getElementById('breadcrumb-current');
    const metaEl = document.getElementById('node-meta');

    if (iconEl) iconEl.textContent = node.icon || '📌';
    if (titleEl) titleEl.textContent = node.label;
    if (breadcrumbEl) breadcrumbEl.textContent = node.label;

    // Build breadcrumb path
    const path = this.findPath(nodeId);
    if (path.length > 1) {
      const breadcrumbContainer = document.getElementById('node-breadcrumb');
      if (breadcrumbContainer) {
        breadcrumbContainer.innerHTML = `
          <a href="dashboard.html" class="crumb">Inicio</a>
          <span class="crumb-sep">→</span>
          <a href="ciencias-sociales.html" class="crumb">Ciencias Sociales</a>
          ${path.slice(0, -1).map(p => `
            <span class="crumb-sep">→</span>
            <a href="nodo.html?id=${encodeURIComponent(p.id)}" class="crumb">${p.label}</a>
          `).join('')}
          <span class="crumb-sep">→</span>
          <span class="crumb active">${node.label}</span>
        `;
      }
    }

    // Meta chips
    if (metaEl) {
      const chips = [];
      const hasChildren = node.children && node.children.length > 0;
      if (hasChildren) {
        chips.push(`<span class="node-meta-chip">📂 ${node.children.length} subtema${node.children.length > 1 ? 's' : ''}</span>`);
      } else {
        chips.push(`<span class="node-meta-chip">📄 Tema de estudio</span>`);
      }
      if (node.custom) {
        chips.push(`<span class="node-meta-chip custom">✨ Nodo personalizado</span>`);
      }
      metaEl.innerHTML = chips.join('');
    }

    // Update page title
    document.title = `PreparIA — ${node.label}`;
  },

  findPath(nodeId) {
    const tree = TreeManager.getTree();
    const path = [];
    const search = (nodes, trail) => {
      for (const n of nodes) {
        const currentTrail = [...trail, { id: n.id, label: n.label, icon: n.icon }];
        if (String(n.id) === String(nodeId)) {
          path.push(...currentTrail);
          return true;
        }
        if (n.children && search(n.children, currentTrail)) return true;
      }
      return false;
    };
    search(tree, []);
    return path;
  },

  async loadContent(node, nodeId) {
    const contentArea = document.getElementById('node-content-area');
    if (!contentArea) return;

    try {
      if (typeof node.id === 'number' || !isNaN(parseInt(nodeId))) {
        const res = await NodosAPI.getMaterial(nodeId);
        const materiales = res.datos || [];

        if (materiales.length > 0) {
          contentArea.innerHTML = materiales.map(m => `
            <div class="node-content-card">
              ${m.titulo ? `<h4>${m.titulo}</h4>` : ''}
              <div class="node-content-text">${this.formatContent(m.contenido)}</div>
            </div>
          `).join('');
        } else if (node.description) {
          contentArea.innerHTML = `
            <div class="node-content-card">
              <div class="node-content-text">${this.formatContent(node.description)}</div>
            </div>`;
        } else {
          contentArea.innerHTML = `
            <div class="node-empty">
              <div class="empty-icon">📭</div>
              <p style="font-weight:600;font-size:1.05rem;margin-bottom:8px;">Sin contenido disponible</p>
              <p style="font-size:0.9rem">Este nodo aún no tiene material de estudio asignado.</p>
            </div>`;
        }
      } else {
        // Nodos frontend / custom
        if (node.description) {
          contentArea.innerHTML = `
            <div class="node-content-card">
              <div class="node-content-text">${this.formatContent(node.description)}</div>
            </div>`;
        } else {
          contentArea.innerHTML = `
            <div class="node-empty">
              <div class="empty-icon">📭</div>
              <p style="font-weight:600;font-size:1.05rem;margin-bottom:8px;">Sin contenido disponible</p>
              <p style="font-size:0.9rem">Este es un nodo del árbol sin material asignado.</p>
            </div>`;
        }
      }
    } catch (err) {
      console.error('Error loading node content:', err);
      contentArea.innerHTML = `
        <div class="node-empty">
          <div class="empty-icon">⚠️</div>
          <p style="font-weight:600;font-size:1.05rem;color:var(--coral);margin-bottom:8px;">Error al cargar el contenido</p>
          <p style="font-size:0.9rem">${err.mensaje || 'No se pudo conectar con el servidor.'}</p>
          <button onclick="location.reload()" class="btn btn-ghost btn-sm" style="margin-top:16px">🔄 Reintentar</button>
        </div>`;
    }
  },

  formatContent(text) {
    if (!text) return '';
    // Split by double newlines into paragraphs, preserve single newlines as <br>
    return text
      .split(/\n\n+/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  },

  renderChildren(node) {
    if (!node.children || !node.children.length) return;

    const section = document.getElementById('node-children-section');
    const list = document.getElementById('node-children-list');
    if (!section || !list) return;

    section.style.display = 'block';
    list.innerHTML = node.children.map(child => {
      const hasGrandchildren = child.children && child.children.length > 0;
      return `
        <a href="nodo.html?id=${encodeURIComponent(child.id)}" class="node-child-item">
          <div class="node-child-icon">${child.icon || '📌'}</div>
          <div>
            <div class="node-child-label">${child.label}</div>
            ${hasGrandchildren ? `<div class="muted" style="font-size:0.78rem;margin-top:2px">${child.children.length} subtema${child.children.length > 1 ? 's' : ''}</div>` : ''}
            ${child.custom ? '<span class="badge badge-sky" style="font-size:0.6rem;margin-top:4px">Custom</span>' : ''}
          </div>
          <div class="node-child-arrow">→</div>
        </a>
      `;
    }).join('');
  },

  showError(message) {
    const contentArea = document.getElementById('node-content-area');
    const heroEl = document.getElementById('node-hero');
    if (heroEl) heroEl.style.display = 'none';
    if (contentArea) {
      contentArea.innerHTML = `
        <div class="node-empty">
          <div class="empty-icon">😕</div>
          <p style="font-weight:600;font-size:1.05rem;margin-bottom:8px;">${message}</p>
          <a href="ciencias-sociales.html" class="btn btn-ghost btn-sm" style="margin-top:16px">← Volver al árbol</a>
        </div>`;
    }
  },

  getFlattenedTree() {
    const tree = TreeManager.getTree();
    const flat = [];
    const traverse = (nodes) => {
      for (const n of nodes) {
        flat.push(n);
        if (n.children && n.children.length > 0) {
          traverse(n.children);
        }
      }
    };
    traverse(tree);
    return flat;
  },

  renderNavigation(nodeId) {
    const flat = this.getFlattenedTree();
    const idx = flat.findIndex(n => String(n.id) === String(nodeId));
    
    const navContainer = document.getElementById('node-navigation');
    const btnPrev = document.getElementById('btn-prev-node');
    const btnNext = document.getElementById('btn-next-node');
    
    if (!navContainer || idx === -1) return;
    
    // We remove the display: none set inline in HTML, but we need to reset it to flex
    navContainer.style.display = 'flex';
    
    if (idx > 0) {
      const prev = flat[idx - 1];
      btnPrev.style.visibility = 'visible';
      btnPrev.innerHTML = `← ${prev.label}`;
      btnPrev.onclick = () => window.location.href = `nodo.html?id=${encodeURIComponent(prev.id)}`;
    } else {
      btnPrev.style.visibility = 'hidden';
    }
    
    if (idx < flat.length - 1) {
      const next = flat[idx + 1];
      btnNext.style.visibility = 'visible';
      btnNext.innerHTML = `${next.label} →`;
      btnNext.onclick = () => window.location.href = `nodo.html?id=${encodeURIComponent(next.id)}`;
    } else {
      btnNext.style.visibility = 'hidden';
    }
  },
};

/* ──────────────────────────────────────────────────────────
   10. AUTO-INIT
   Detecta la página actual y ejecuta el init correspondiente
────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Get page name, handling both with and without .html extension
  let page = window.location.pathname.split('/').pop() || '';
  page = page.replace('.html', '').replace(/\?.*$/, '').trim();

  const PAGES = {
    'index':             PageIndex,
    '':                  PageIndex,
    'login':             PageLogin,
    'registro':          PageRegistro,
    'dashboard':         PageDashboard,
    'simulacros':        PageSimulacros,
    'estadisticas':      PageEstadisticas,
    'ciencias-sociales': PageCienciasSociales,
    'nodo':              PageNodo,
    'ranking':           { init() { /* RankingPage.init() is called by ranking.js */ } },
  };

  const handler = PAGES[page];
  if (handler) {
    handler.init();
  }
});
