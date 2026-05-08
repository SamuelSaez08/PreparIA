'use strict';

const PageEstadisticas = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    await this.loadBackendData();
  },

  async loadBackendData() {
    let stats      = { avg: 0, best: 0, total: 0 };
    let streakData = { count: 0, longest: 0 };

    try {
      const progresoRes = await ProgresoAPI.getProgreso();
      const datos = progresoRes.datos || progresoRes;

      const backendStats = datos.estadisticas || datos;
      stats = {
        total: backendStats.total_intentos || backendStats.total || 0,
        avg:   Math.round(backendStats.promedio_global || backendStats.promedio || 0),
        best:  Math.round(backendStats.mejor_puntaje  || backendStats.best || 0),
      };
      streakData = {
        count:   datos.racha_actual || 0,
        longest: datos.racha_maxima || backendStats.racha_maxima || 0,
      };

      Streak.updateFromBackend(datos);

      const progresoPorMateria = datos.progreso_por_materia || datos.materias || [];
      if (progresoPorMateria.length) this.renderTopicBars(progresoPorMateria);

      const actividadSemanal = datos.actividad_semanal || [];
      if (actividadSemanal.length) this.renderHeatmapFromBackend(actividadSemanal);

    } catch (err) {
      console.warn('ProgresoAPI.getProgreso failed:', err);
      if (err.networkError) UI.showToast('Sin conexión. Verifica tu internet.', 'error');
      stats      = Simulacros.getStats();
      const localStreak = Streak.get();
      streakData = { count: localStreak.count, longest: localStreak.longest };
    }

    try {
      const historialRes = await SimulacrosAPI.getHistorial({ por_pagina: 20 });
      Simulacros.updateFromBackend(historialRes.datos || []);
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
    }

    const history = Simulacros.getHistory();

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

    const ringEl = document.getElementById('avg-score-ring');
    if (ringEl) ringEl.innerHTML = UI.renderScoreRing(stats.avg);

    const levelEl = document.getElementById('level-label');
    if (levelEl) {
      levelEl.textContent = Utils.scoreLabel(stats.avg);
      levelEl.style.color = Utils.scoreColor(stats.avg);
    }

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

    if (history.length) {
      const chartEmpty   = document.getElementById('chart-empty');
      const chartWrapper = document.getElementById('chart-wrapper');
      if (chartEmpty)   chartEmpty.style.display = 'none';
      if (chartWrapper) chartWrapper.style.display = 'block';

      const last8  = history.slice(0, 8).reverse();
      const labels = last8.map(h => h.date?.split(' ')[0] || '');
      const data   = last8.map(h => h.pct);
      setTimeout(() => UI.renderBarChart('chart-scores', labels, data), 100);
    }

    this.renderTable(history);
  },

  renderTopicBars(materias) {
    const container = document.getElementById('topic-bars');
    if (!container) return;

    const colors = ['var(--acid)', 'var(--sky)', 'var(--amber)', 'var(--coral)'];
    container.innerHTML = materias.map((m, i) => {
      const nombre = m.nombre || m.materia || `Materia ${i + 1}`;
      const pct    = Math.round(m.porcentaje || m.progreso || 0);
      const color  = colors[i % colors.length];
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
      const simCount   = history.filter(h => h.date?.includes(d.getDate())).length;
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
