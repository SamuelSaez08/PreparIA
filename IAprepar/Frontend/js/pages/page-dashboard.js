'use strict';

const PageDashboard = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    const user = Session.getUser();
    document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user?.nombre || 'Estudiante');
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    await this.loadBackendData();
  },

  async loadBackendData() {
    try {
      const progresoRes = await ProgresoAPI.getProgreso();
      const datos = progresoRes.datos || progresoRes;

      const stats = datos.estadisticas || datos;
      const totalIntentos = stats.total_intentos || stats.total || 0;
      const promedio      = stats.promedio_global || stats.promedio || stats.avg || 0;
      const mejor         = stats.mejor_puntaje  || stats.best || 0;
      const racha         = datos.racha_actual   || stats.racha || 0;

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

      const streakEl = document.getElementById('streak-count');
      if (streakEl) streakEl.textContent = racha;

      Streak.updateFromBackend(datos);

      const actividadSemanal = datos.actividad_semanal || [];
      if (typeof initStreakWidget === 'function') {
        initStreakWidget('streak-days', { current_streak: racha, activity_dates: actividadSemanal });
      } else {
        UI.renderStreakDaysFromBackend('streak-days', actividadSemanal);
      }

      const progresoPorMateria = datos.progreso_por_materia || datos.materias || [];
      if (progresoPorMateria.length) {
        this.renderProgressBars(progresoPorMateria);
      }

    } catch (err) {
      console.warn('ProgresoAPI.getProgreso failed, using defaults:', err);
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
      if (err.networkError) UI.showToast('Sin conexión. Verifica tu internet.', 'error');
    }

    UI.animateProgressBars();

    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 3 });
      const historial = historialRes.datos || [];
      Simulacros.updateFromBackend(historial);
      this.renderRecentSimulacros();
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
      this.renderRecentSimulacros();
    }
  },

  renderProgressBars(materias) {
    const colors       = ['var(--acid)', 'var(--sky)', 'var(--amber)', 'var(--coral)'];
    const colorClasses = ['', 'sky', 'amber', 'coral'];

    const progressSection = document.querySelector('.card.no-hover .flex.flex-col.gap-md');
    if (!progressSection || !progressSection.querySelector('.progress-bar')) return;

    progressSection.innerHTML = materias.map((m, i) => {
      const nombre = m.nombre || m.materia || `Materia ${i + 1}`;
      const pct    = Math.round(m.porcentaje || m.progreso || 0);
      const color  = colors[i % colors.length];
      const cls    = colorClasses[i % colorClasses.length];
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
