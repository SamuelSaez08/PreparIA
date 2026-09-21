/* ============================================================
   PreparIA — ui.js
   Capa de UI: UI, Validate, Utils
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   6. UI COMPONENTS
────────────────────────────────────────────────────────── */
const UI = (() => {
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

  const renderStreakDaysFromBackend = (containerId, actividadSemanal) => {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (actividadSemanal && actividadSemanal.length) {
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

    data.forEach((val, i) => {
      const x = pad.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2;
      const barH = (val / maxVal) * chartH;
      const y = pad.top + chartH - barH;

      const gradient = ctx.createLinearGradient(0, y, 0, y + barH);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, color + '55');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.font = `bold 11px 'Plus Jakarta Sans', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(val + '%', x + barW / 2, y - 6);

      ctx.fillStyle = 'rgba(245,245,240,0.4)';
      ctx.font = `600 10px 'Plus Jakarta Sans', sans-serif`;
      const labelText = labels[i] || '';
      ctx.fillText(labelText.length > 6 ? labelText.slice(0, 6) + '…' : labelText, x + barW / 2, h - 8);
    });
  };

  const initPasswordToggles = () => {
    document.querySelectorAll('[data-toggle-pwd]').forEach(btn => {
      const targetId = btn.getAttribute('data-toggle-pwd');
      const pintar = (visible) => {
        const conIconos = typeof Icon !== 'undefined';
        btn.innerHTML = conIconos ? Icon.svg(visible ? 'eyeOff' : 'eye', 20) : (visible ? '🙈' : '👁️');
        btn.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
        btn.setAttribute('aria-pressed', String(visible));
      };
      pintar(false);
      btn.addEventListener('click', () => {
        const input = document.getElementById(targetId);
        if (!input) return;
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        pintar(visible);
      });
    });
  };

  const initModalCloseHandlers = () => {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('show');
      });
    });
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.getAttribute('data-close-modal'));
      });
    });
  };

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
    if (field) { field.classList.add('error'); field.setAttribute('aria-invalid', 'true'); if (errEl) field.setAttribute('aria-describedby', errEl.id); }
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); errEl.setAttribute('role', 'alert'); }
  };

  const clearError = (fieldId) => {
    const field = document.getElementById(fieldId);
    const errEl = document.getElementById(fieldId + '-error');
    if (field) { field.classList.remove('error'); field.removeAttribute('aria-invalid'); }
    if (errEl) { errEl.classList.remove('show'); errEl.textContent = ''; }
  };

  const clearAll = (fields) => fields.forEach(clearError);

  return { email, minLen, noEmpty, match, showError, clearError, clearAll };
})();

/* ──────────────────────────────────────────────────────────
   8. UTILS
────────────────────────────────────────────────────────── */
const Utils = {
  sanitizeHTML: (str) => {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  },

  navigate: (url) => { window.location.href = url; },

  /** "20 de sept de 2026" → "20 sept". Para columnas y ejes estrechos. */
  fechaCorta: (f) => {
    const p = String(f || '').split(' ');
    return p.length >= 3 && p[1] === 'de' ? `${p[0]} ${p[2].replace('.', '')}` : String(f || '');
  },

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

  setActiveNav: () => {
    const current = window.location.pathname.split('/').pop();
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-nav') === current);
    });
  },

  renderUserInNav: () => {
    const user = Session.getUser();
    const els = document.querySelectorAll('[data-user-name]');
    if (user) els.forEach(el => el.textContent = user.nombre || user.email);

    // Los accesos marcados con data-admin-only solo se muestran al administrador.
    const esAdmin = !!user && user.rol === 'admin';
    document.querySelectorAll('[data-admin-only]').forEach(el => { el.hidden = !esAdmin; });
  },
};
