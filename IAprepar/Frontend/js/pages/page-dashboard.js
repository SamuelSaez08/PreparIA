'use strict';

/* ============================================================
   PreparIA — Inicio (rediseño clay v2)
   Una sola acción destacada: el siguiente tema de la ruta. Todo
   lo demás es contexto (racha, cifras, avance por unidad).
   Las cuatro consultas van en paralelo y cada bloque se pinta en
   cuanto llega su dato, sin esperar a los demás.
   ============================================================ */

const PageDashboard = {
  async init() {
    Auth.requireAuth();
    Utils.setActiveNav();
    Utils.renderUserInNav();
    UI.initModalCloseHandlers();

    const user = Session.getUser();
    document.querySelectorAll('[data-user-name]').forEach((el) => { el.textContent = user?.nombre || 'Estudiante'; });
    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    this.resumen = {};
    await Promise.allSettled([
      this.cargarProgreso(),
      this.cargarRuta(),
      this.cargarUltimo(),
      this.cargarPosicion(),
    ]);
    this.pintarSaludo();
  },

  /* ── Cifras generales y racha ───────────────────────────── */
  async cargarProgreso() {
    let racha = 0, dias = [], total = 0, promedio = 0, mejor = 0;
    try {
      const res = await ProgresoAPI.getProgreso();
      const datos = res.datos || res;
      const stats = datos.estadisticas || datos;
      total = stats.total_intentos || 0;
      promedio = Math.round(stats.promedio_global || 0);
      mejor = Math.round(stats.mejor_puntaje || 0);
      racha = datos.racha_actual || 0;
      dias = datos.actividad_semanal || [];
      Streak.updateFromBackend(datos);
    } catch (err) {
      const local = Streak.get();
      racha = local.count || 0;
      dias = local.history || [];
      if (err.networkError) UI.showToast('Sin conexión. Verifica tu internet.', 'error');
    }

    this.resumen.racha = racha;
    this.resumen.hoyHecho = dias.includes(this.ymd(new Date()));
    this.resumen.total = total;

    this.set('stat-simulacros', total);
    this.set('stat-simulacros-sub', total ? this.estaSemana(dias) : 'Aún no has hecho ninguno');
    this.set('stat-promedio', total ? `${promedio}%` : '—');
    this.set('stat-promedio-sub', !total ? 'Meta recomendada: 70%'
      : promedio >= 70 ? `Sobre la meta de 70% · mejor: ${mejor}%` : `A ${70 - promedio} puntos de la meta de 70%`);

    this.set('streak-count', racha);
    this.set('streak-unit', racha === 1 ? 'día seguido' : 'días seguidos');
    this.pintarSemana(dias);
    this.set('streak-msg', racha === 0
      ? 'Completa un simulacro o una práctica hoy para empezar tu racha.'
      : this.resumen.hoyHecho ? '¡Hoy ya sumaste! Vuelve mañana para seguir.' : `Practica hoy para llegar a ${racha + 1} días.`);
    if (typeof Shell !== 'undefined') Shell.setRacha(racha);
  },

  pintarSemana(fechas) {
    const el = document.getElementById('streak-days');
    if (!el) return;
    const hechos = new Set(fechas);
    const letras = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const hoy = new Date();
    el.innerHTML = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy);
      d.setDate(hoy.getDate() - (6 - i));
      const esHoy = i === 6;
      const hecho = hechos.has(this.ymd(d));
      const nombre = d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'short' });
      return `
        <div class="week-day${hecho ? ' done' : ''}${esHoy ? ' today' : ''}" title="${nombre}">
          <span class="week-dot">${hecho ? Icon.svg('check', 16, 2.6) : ''}</span>
          <small>${esHoy ? 'Hoy' : letras[d.getUTCDay()]}</small>
          <span class="sr-only">${nombre}: ${hecho ? 'practicaste' : 'sin práctica'}</span>
        </div>`;
    }).join('');
  },

  /* ── Siguiente tema y avance por unidad ─────────────────── */
  async cargarRuta() {
    const card = document.getElementById('continuar');
    const lista = document.getElementById('unidades');
    try {
      const ruta = await ProgresoRuta.cargar(1);
      this.resumen.siguiente = ruta.siguiente;

      if (lista) {
        lista.innerHTML = ruta.unidades.length
          ? ruta.unidades.map((u) => ProgresoRuta.filaUnidad(u)).join('')
          : `<div class="empty">${Icon.svg('map', 28)}<span>Todavía no hay unidades cargadas.</span></div>`;
        ProgresoRuta.animarBarras(lista);
      }
      if (card) this.pintarContinuar(card, ruta);
    } catch (err) {
      console.warn('No se pudo cargar el progreso por tema:', err);
      if (lista) lista.innerHTML = `<div class="empty">${Icon.svg('info', 28)}<span>No se pudo cargar tu avance. Recarga la página para intentarlo de nuevo.</span></div>`;
      if (card) card.innerHTML = `
        <span class="lbl acid">Continúa tu ruta</span>
        <p class="t3">No pudimos cargar tu ruta ahora mismo.</p>
        <div><a href="ciencias-sociales.html" class="btn btn-primary">${Icon.svg('map', 18)}<span>Ir a Ciencias Sociales</span></a></div>`;
    }
  },

  pintarContinuar(card, ruta) {
    const t = ruta.siguiente;
    if (!t) {
      const todoDominado = ruta.temas.length && ruta.temas.every((x) => x.estado === 'dominado' || x.estado === 'vacio');
      card.innerHTML = `
        <span class="lbl acid">${todoDominado ? '¡Ruta completa!' : 'Tu ruta'}</span>
        <h2 style="font-size:1.75rem;letter-spacing:-0.02em">${todoDominado ? 'Dominas todos los temas con preguntas' : 'Aún no hay temas para practicar'}</h2>
        <p class="t3">${todoDominado ? 'Mide lo aprendido con un simulacro completo.' : 'Cuando se carguen preguntas en el banco aparecerán aquí.'}</p>
        <div><a href="simulacros.html" class="btn btn-primary">${Icon.svg('clip', 18)}<span>Hacer un simulacro</span></a></div>`;
      return;
    }

    const e = ProgresoRuta.ESTADOS[t.estado];
    const hayBanco = t.preguntas > 0;
    const ultima = ProgresoRuta.haceCuanto(t.ultima_practica);
    card.innerHTML = `
      <div class="between" style="flex-wrap:wrap">
        <span class="lbl acid">Continúa tu ruta</span>
        <span class="t3" style="font-size:.8125rem;font-weight:700">Unidad ${t.unidad.numero} · ${Utils.sanitizeHTML(t.unidad.nombre)}</span>
      </div>
      <div class="inline" style="gap:22px;align-items:center">
        <span class="next-node ${t.estado}">${Icon.svg(t.estado === 'en_progreso' ? 'book' : 'target', 32)}</span>
        <div class="stack gap-8" style="min-width:0">
          <h2 style="font-size:1.75rem;line-height:1.15;letter-spacing:-0.02em">${Utils.sanitizeHTML(t.nombre)}</h2>
          <div class="inline t3" style="gap:18px;flex-wrap:wrap;font-size:.875rem;font-weight:600">
            <span class="inline" style="gap:6px">${Icon.svg('list', 16)}${hayBanco ? `${t.preguntas} preguntas en el banco` : 'Sin preguntas en el banco'}</span>
            <span class="inline" style="gap:6px">${Icon.svg('clock', 16)}${ultima ? `Practicado ${ultima}` : '20 minutos'}</span>
          </div>
        </div>
      </div>
      <div class="stack gap-8">
        <div class="between" style="font-size:.875rem"><span class="t2" style="font-weight:600">Dominio del tema · ${e.etiqueta}</span><strong class="num">${t.porcentaje}%</strong></div>
        <div class="well bar"><span class="${e.clase}" data-pct="${t.porcentaje}"></span></div>
        <small class="t4" style="font-size:.8125rem">Al llegar a 80% queda marcado como dominado.</small>
      </div>
      <div class="inline" style="gap:12px;flex-wrap:wrap">
        ${hayBanco
          ? `<button type="button" class="btn btn-primary" id="btn-practicar">${Icon.svg('play', 18)}<span>Practicar este tema</span></button>`
          : `<button type="button" class="btn" disabled>${Icon.svg('lock', 18)}<span>Aún sin preguntas</span></button>`}
        <a href="ciencias-sociales.html" class="btn btn-text"><span>Ver toda la ruta</span>${Icon.svg('arrow', 18)}</a>
      </div>`;
    ProgresoRuta.animarBarras(card);
    const btn = document.getElementById('btn-practicar');
    if (btn) btn.addEventListener('click', () => RutaAprendizaje.practicar(t.id, t.nombre, btn));
  },

  /* ── Último simulacro ───────────────────────────────────── */
  async cargarUltimo() {
    const el = document.getElementById('recent-simulacros');
    if (!el) return;
    let ultimo = null;
    try {
      const res = await SimulacrosAPI.getHistorial({ por_pagina: 5 });
      const lista = res.datos || [];
      Simulacros.updateFromBackend(lista);
      ultimo = lista[0] || null;
    } catch (err) {
      console.warn('SimulacrosAPI.getHistorial failed:', err);
    }

    const h = Simulacros.getHistory()[0];
    if (!h) {
      el.innerHTML = `
        <div class="empty" style="padding:12px 0 4px">${Icon.svg('clip', 28)}<span>Aún no tienes simulacros. El primero toma 20 minutos.</span></div>
        <a href="simulacros.html" class="btn btn-secondary" style="align-self:flex-start">Hacer el primero</a>`;
      return;
    }
    const cuando = ultimo && ultimo.fecha ? ProgresoRuta.haceCuanto(ultimo.fecha) : h.date;
    const malas = Math.max(0, (h.total || 0) - (h.score || 0));
    el.innerHTML = `
      <div class="inline" style="align-items:baseline;gap:10px">
        <span class="big-num" style="font-size:2.75rem">${h.score}<span style="color:var(--text-5)">/${h.total}</span></span>
        <span class="t3" style="font-size:.9375rem;font-weight:700">${h.pct}% · ${Utils.sanitizeHTML(cuando || '')}</span>
      </div>
      <div class="inline" style="gap:10px;flex-wrap:wrap">
        <span class="pill ok">${Icon.svg('check', 14, 2.6)}${h.score} correctas</span>
        <span class="pill bad">${Icon.svg('x', 14, 2.6)}${malas} incorrectas</span>
      </div>
      <div style="flex-grow:1"></div>
      <a href="estadisticas.html" class="btn btn-secondary" style="align-self:flex-start">Ver tu historial</a>`;
  },

  /* ── Posición en el ranking semanal ─────────────────────── */
  async cargarPosicion() {
    try {
      const res = await RankingAPI.getRanking('weekly', 1, 0);
      const p = res.datos && res.datos.posicion_usuario;
      if (p && p.rank_position) {
        this.set('stat-rank', `#${p.rank_position}`);
        this.set('stat-rank-sub', `de ${p.total_users_ranked || '—'} estudiantes esta semana`);
      } else {
        this.set('stat-rank', '—');
        this.set('stat-rank-sub', 'Haz un simulacro para entrar al ranking');
      }
    } catch {
      this.set('stat-rank', '—');
    }
  },

  /* ── Subtítulo según la situación real ──────────────────── */
  pintarSaludo() {
    const r = this.resumen;
    let txt;
    if (r.siguiente && r.siguiente.estado === 'en_progreso') txt = 'Tienes un tema a medio camino. Unos minutos hoy lo acercan a dominado.';
    else if (r.racha > 0 && !r.hoyHecho) txt = `Llevas ${r.racha} ${r.racha === 1 ? 'día' : 'días'} seguidos. Practica hoy para no perder la racha.`;
    else if (!r.total) txt = 'Empieza por un tema de la ruta o mide tu nivel con un simulacro.';
    else txt = 'Elige un tema de tu ruta o haz un simulacro completo.';
    this.set('greeting-sub', txt);
  },

  /* ── utilidades ─────────────────────────────────────────── */
  set(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; },
  // El servidor calcula la racha con fechas UTC; aquí se usa la misma base
  // para que los días marcados coincidan con el número de la racha.
  ymd(d) { return d.toISOString().split('T')[0]; },
  estaSemana(fechas) {
    const hace7 = new Date(); hace7.setDate(hace7.getDate() - 6);
    const n = fechas.filter((f) => f >= this.ymd(hace7)).length;
    return n ? `Practicaste ${n} ${n === 1 ? 'día' : 'días'} esta semana` : 'Ninguno esta semana';
  },
};
