'use strict';

/* ============================================================
   PreparIA — Estadísticas (rediseño clay v2)

   Cambios de fondo respecto a la versión anterior:
   · "Qué mejorar" era un consejo al azar entre cuatro fijos. Ahora
     "Dónde enfocarte" sale del tema practicado con menor dominio.
   · Las barras por tema estaban escritas en el HTML. Ahora son las
     unidades reales de la ruta, con el progreso de esta cuenta.
   · La gráfica pasa de <canvas> a HTML: cada barra se puede
     recorrer con teclado y anuncia su fecha y puntaje.
   · El botón "Borrar historial" solo vaciaba una copia local; al
     recargar, el servidor la devolvía igual. Se quitó para no
     prometer algo que no ocurre.
   ============================================================ */

const PageEstadisticas = {
  META: 70,

  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    await Promise.allSettled([this.cargarResumenYHistorial(), this.cargarRuta()]);
  },

  async cargarResumenYHistorial() {
    let stats = { total: 0, avg: 0, best: 0 };
    let racha = 0;

    try {
      const res = await ProgresoAPI.getProgreso();
      const datos = res.datos || res;
      const b = datos.estadisticas || datos;
      stats = {
        total: b.total_intentos || 0,
        avg: Math.round(b.promedio_global || 0),
        best: Math.round(b.mejor_puntaje || 0),
      };
      racha = datos.racha_actual || 0;
      Streak.updateFromBackend(datos);
      if (typeof Shell !== 'undefined') Shell.setRacha(racha);
    } catch (err) {
      stats = Simulacros.getStats();
      racha = Streak.get().count || 0;
      if (err.networkError) UI.showToast('Sin conexión. Verifica tu internet.', 'error');
    }

    try {
      const res = await SimulacrosAPI.getHistorial({ por_pagina: 20 });
      Simulacros.updateFromBackend(res.datos || []);
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
    }
    const historial = Simulacros.getHistory();

    // La racha más larga se guarda en el navegador: si no hay registro,
    // la actual es el mejor dato disponible.
    const larga = Math.max(Streak.get().longest || 0, racha);
    const mejorIntento = historial.find((h) => h.pct === stats.best);

    this.set('stats-total', stats.total);
    this.set('stats-total-sub', historial.length ? `El último, el ${Utils.fechaCorta(historial[0].date)}` : 'Aún no has hecho ninguno');
    this.set('stats-promedio', stats.total ? `${stats.avg}%` : '—');
    this.set('stats-promedio-sub', !stats.total ? `Meta recomendada: ${this.META}%`
      : stats.avg >= this.META ? `Sobre la meta de ${this.META}%` : `A ${this.META - stats.avg} puntos de la meta`);
    this.set('stats-mejor', stats.total ? `${stats.best}%` : '—');
    this.set('stats-mejor-sub', mejorIntento ? `El ${Utils.fechaCorta(mejorIntento.date)}` : ' ');
    this.set('stats-racha', `${larga} ${larga === 1 ? 'día' : 'días'}`);
    this.set('stats-racha-sub', `La actual es de ${racha}`);

    this.pintarGrafica(historial);
    this.pintarTabla(historial);
  },

  /* ── Gráfica de barras en HTML ──────────────────────────────
     Una sola serie, así que no lleva leyenda: el título la nombra.
     Etiqueta directa solo en el mejor y en el último intento; el
     resto aparece al pasar el cursor o el foco del teclado. */
  pintarGrafica(historial) {
    const cont = document.getElementById('chart-scores');
    if (!cont) return;
    const datos = historial.slice(0, 10).reverse();
    if (!datos.length) return;

    const corto = Utils.fechaCorta;
    const ultimo = datos.length - 1;
    const mejor = datos.reduce((bi, d, i) => (d.pct > datos[bi].pct ? i : bi), 0);

    cont.innerHTML = `
      <div class="chart2">
        <div class="chart2-y" aria-hidden="true">
          <span style="top:0">100</span><span style="top:50%">50</span><span style="top:100%">0</span>
        </div>
        <div class="chart2-plot">
          <div class="chart2-grid" style="top:0"></div>
          <div class="chart2-grid" style="top:50%"></div>
          <div class="chart2-grid" style="top:100%;border-color:#2A2A50"></div>
          <div class="chart2-goal" style="bottom:${this.META}%"></div>
          <div class="chart2-bars" role="list" aria-label="Puntaje por simulacro, del más antiguo al más reciente">
            ${datos.map((d, i) => {
              const v = Math.max(0, Math.min(100, d.pct || 0));
              return `
              <div class="chart2-col" role="listitem" tabindex="0" aria-label="${Utils.sanitizeHTML(d.date)}: ${v}%, ${d.score} de ${d.total}">
                <div class="chart2-bar" style="height:0" data-h="${v}"></div>
                ${i === mejor || i === ultimo ? `<span class="chart2-val" style="bottom:calc(${v}% + 6px)">${v}%</span>` : ''}
                <div class="chart2-tip" role="tooltip" style="bottom:calc(${v}% + 10px)"><small>${Utils.sanitizeHTML(d.date)}</small><strong>${v}% · ${d.score}/${d.total}</strong></div>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
      <div class="chart2" style="margin-top:8px" aria-hidden="true">
        <span></span>
        <div class="chart2-x">${datos.map((d) => `<span>${Utils.sanitizeHTML(corto(d.date))}</span>`).join('')}</div>
      </div>`;

    requestAnimationFrame(() => requestAnimationFrame(() => {
      cont.querySelectorAll('.chart2-bar[data-h]').forEach((b) => { b.style.height = `${b.dataset.h}%`; });
    }));
  },

  pintarTabla(historial) {
    const tbody = document.getElementById('stats-tbody');
    if (!tbody) return;
    if (!historial.length) {
      tbody.innerHTML = `<tr><td colspan="4"><div class="empty" style="padding:20px 0">Sin intentos todavía. <a href="simulacros.html">Haz el primero</a></div></td></tr>`;
      return;
    }
    const color = (p) => (p >= 80 ? 'var(--acid)' : p >= 60 ? 'var(--amber)' : 'var(--coral-soft)');
    tbody.innerHTML = historial.slice(0, 8).map((h) => `
      <tr>
        <td>${Utils.sanitizeHTML(h.date)}</td>
        <td>${h.score}/${h.total}</td>
        <td><span class="inline" style="gap:8px"><span style="width:8px;height:8px;border-radius:99px;background:${color(h.pct)}"></span><strong>${h.pct}%</strong></span></td>
        <td class="num">${h.timeUsed ? Utils.formatTime(h.timeUsed) : '—'}</td>
      </tr>`).join('');
  },

  /* ── Unidades y tema a reforzar ─────────────────────────── */
  async cargarRuta() {
    const foco = document.getElementById('foco');
    const barras = document.getElementById('topic-bars');
    try {
      const ruta = await ProgresoRuta.cargar(1);

      if (barras) {
        barras.innerHTML = ruta.unidades.length
          ? ruta.unidades.map((u) => ProgresoRuta.filaUnidad(u)).join('')
          : `<div class="empty">Todavía no hay unidades cargadas.</div>`;
        ProgresoRuta.animarBarras(barras);
      }

      if (!foco) return;
      const t = ruta.masDebil || ruta.siguiente;
      if (!t) {
        foco.innerHTML = `
          <span class="lbl acid">Dónde enfocarte</span>
          <h2 style="font-size:1.5rem;letter-spacing:-0.02em">${ruta.temas.length ? 'Vas al día con todos los temas' : 'Aún no hay temas en la ruta'}</h2>
          <p class="t3" style="font-size:.875rem;line-height:1.5">Un simulacro completo te dirá qué reforzar después.</p>
          <a href="simulacros.html" class="btn btn-primary btn-block">${Icon.svg('clip', 18)}<span>Hacer un simulacro</span></a>`;
        return;
      }
      const debil = ruta.masDebil && t.id === ruta.masDebil.id;
      foco.innerHTML = `
        <span class="lbl acid">Dónde enfocarte</span>
        <div class="stack gap-8">
          <h2 style="font-size:1.5rem;line-height:1.15;letter-spacing:-0.02em">${Utils.sanitizeHTML(t.nombre)}</h2>
          <p class="t3" style="font-size:.875rem;line-height:1.5">${debil
            ? `De los temas que ya practicaste, es el de menor dominio: ${t.porcentaje}%. Un par de prácticas aquí rinden más que repasar lo que ya dominas.`
            : 'Es el siguiente tema de tu ruta y todavía no lo has practicado.'}</p>
        </div>
        ${t.preguntas > 0
          ? `<button type="button" class="btn btn-primary btn-block" id="btn-foco">${Icon.svg('play', 18)}<span>Practicar este tema</span></button>`
          : `<a href="ciencias-sociales.html" class="btn btn-secondary btn-block">${Icon.svg('map', 18)}<span>Ver en la ruta</span></a>`}`;
      const btn = document.getElementById('btn-foco');
      if (btn) btn.addEventListener('click', () => RutaAprendizaje.practicar(t.id, t.nombre, btn));
    } catch (err) {
      console.warn('No se pudo cargar el progreso por tema:', err);
      if (barras) barras.innerHTML = `<div class="empty">No se pudo cargar tu avance por unidad.</div>`;
      if (foco) foco.innerHTML = `<span class="lbl acid">Dónde enfocarte</span><p class="t3">No se pudo calcular ahora mismo.</p>`;
    }
  },

  set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; },
};
