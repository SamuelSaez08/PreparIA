'use strict';

/* ============================================================
   PreparIA — Ruta de aprendizaje (rediseño clay v2)

   Cada unidad del árbol es una etapa; sus temas bajan en zigzag
   como nodos redondos. Al tocar un nodo se llena el panel lateral
   con su detalle y el botón para practicarlo. Antes el toque
   llevaba directo a nodo.html y el botón "Practicar" vivía debajo
   de cada nodo, compitiendo con el nombre: ahora hay una sola
   acción principal por pantalla, en el panel.

   El estado viene de GET /progreso/nodos (respuestas reales del
   estudiante). No hay bloqueo: los nodos comunican avance, no
   permiso.
   ============================================================ */

const RutaAprendizaje = (() => {

  const ESTADOS = {
    dominado:    { etiqueta: 'Dominado',          cta: 'Repasar este tema' },
    en_progreso: { etiqueta: 'En progreso',       cta: 'Seguir practicando' },
    disponible:  { etiqueta: 'Sin practicar',     cta: 'Empezar este tema' },
    vacio:       { etiqueta: 'Sin preguntas aún', cta: 'Práctica no disponible' },
  };

  const ICONO_NODO = { dominado: 'check', en_progreso: 'book', disponible: 'target', vacio: 'info' };

  let contenedorActivo = null;
  let panelActivo = null;
  let temasPorId = new Map();
  let seleccionado = null;

  const aplanar = (nodo, acumulado = []) => {
    (nodo.children || []).forEach((hijo) => { acumulado.push(hijo); aplanar(hijo, acumulado); });
    return acumulado;
  };

  /** Zigzag suave, en la proporción del prototipo. */
  const OFFS = [0, -0.66, -1, -0.66, 0, 0.66, 1, 0.66];
  const desplazamiento = (i, ancho) => Math.round(OFFS[i % OFFS.length] * Math.min(110, Math.max(56, ancho * 0.16)));

  const haceCuanto = (iso) => (typeof ProgresoRuta !== 'undefined' ? ProgresoRuta.haceCuanto(iso) : null);

  /* ── Práctica de un tema: 10 preguntas del banco, 20 minutos ───────────── */
  const practicar = async (id, nombre, boton) => {
    if (typeof IAAPI === 'undefined') return;
    const textoOriginal = boton ? boton.innerHTML : '';
    if (boton) { boton.disabled = true; boton.innerHTML = '<span>Preparando…</span>'; }
    UI.showToast(`Buscando preguntas de "${nombre}" en el banco…`);

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia: 1,
        id_nivel: 3,
        id_nodo: Number(id),
        cantidad: 10,
        duracion_minutos: 20,
        mezclar_dificultad: true,
        titulo: `Práctica: ${nombre}`,
      });
      const idSimulacro = res.datos && res.datos.id_simulacro;
      if (!idSimulacro) throw new Error('El servidor no devolvió el simulacro.');
      UI.showToast(`${res.datos.total_preguntas || 0} preguntas del banco listas. Arrancando…`);
      window.location.href = `simulacros.html#simulacro=${idSimulacro}`;
    } catch (err) {
      UI.showToast(err.mensaje || err.message || 'No se pudo preparar la práctica de este tema.', 'error');
      if (boton) { boton.disabled = false; boton.innerHTML = textoOriginal; }
    }
  };

  /* ── Panel de detalle ─────────────────────────────────────────────────── */
  const pintarPanel = () => {
    if (!panelActivo) return;
    const t = seleccionado && temasPorId.get(String(seleccionado));
    if (!t) { panelActivo.hidden = true; return; }
    panelActivo.hidden = false;

    const e = ESTADOS[t.estado] || ESTADOS.disponible;
    const hayBanco = t.preguntas > 0;
    const ultima = haceCuanto(t.ultima_practica);
    const barra = t.estado === 'dominado' ? '' : t.estado === 'en_progreso' ? 'amber' : 'dim';

    panelActivo.innerHTML = `
      <div class="stack gap-8">
        <span class="lbl acid">Unidad ${t.unidadNumero} · ${Utils.sanitizeHTML(t.unidadNombre)}</span>
        <h2>${Utils.sanitizeHTML(t.label)}</h2>
        <span class="status ${t.estado}">${e.etiqueta}</span>
      </div>
      <div class="stack gap-8">
        <div class="between" style="font-size:.875rem"><span class="t2" style="font-weight:600">Dominio</span><strong class="num">${t.porcentaje}%</strong></div>
        <div class="well bar"><span class="${barra}" data-pct="${t.porcentaje}"></span></div>
        <small class="t4" style="font-size:.8125rem">${t.respondidas > 0
          ? `${t.correctas} de ${t.respondidas} respuestas correctas. Con 80% queda dominado.`
          : 'Al llegar a 80% de aciertos queda marcado como dominado.'}</small>
      </div>
      <div class="ruta2-facts">
        <span>${Icon.svg('list', 18)}${hayBanco ? `${t.preguntas} preguntas en el banco` : 'Sin preguntas en el banco todavía'}</span>
        <span>${Icon.svg('clock', 18)}10 preguntas · 20 minutos</span>
        <span>${Icon.svg('spark', 18)}${ultima ? `Última práctica: ${ultima}` : 'Aún no lo has practicado'}</span>
      </div>
      ${hayBanco
        ? `<button type="button" class="btn btn-primary btn-block" data-practicar>${Icon.svg('play', 18)}<span>${e.cta}</span></button>`
        : `<div class="stack gap-8">
             <button type="button" class="btn btn-block" disabled>${Icon.svg('lock', 18)}<span>Práctica no disponible</span></button>
             <p class="t3" style="font-size:.8125rem;line-height:1.5">Este tema todavía no tiene preguntas guardadas. Se irá llenando a medida que se generen simulacros.</p>
           </div>`}
      <a href="nodo.html#id=${encodeURIComponent(t.id)}" class="btn btn-text" style="align-self:center">${Icon.svg('book', 18)}<span>Ver material de estudio</span></a>`;

    const btn = panelActivo.querySelector('[data-practicar]');
    if (btn) btn.addEventListener('click', () => practicar(t.id, t.label, btn));

    requestAnimationFrame(() => requestAnimationFrame(() => {
      panelActivo.querySelectorAll('.bar > span[data-pct]').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
    }));
  };

  const seleccionar = (id, { enfocarPanel = false } = {}) => {
    seleccionado = String(id);
    contenedorActivo?.querySelectorAll('.ruta2-step').forEach((li) => {
      const on = li.dataset.id === seleccionado;
      li.classList.toggle('is-sel', on);
      const b = li.querySelector('.ruta2-node');
      b.classList.toggle('is-sel', on);
      b.setAttribute('aria-pressed', String(on));
    });
    pintarPanel();
    // En móvil el panel queda debajo de la ruta: se lleva a la vista.
    if (enfocarPanel && panelActivo && window.matchMedia('(max-width: 960px)').matches) {
      panelActivo.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  };

  /* ── Trazo ────────────────────────────────────────────────────────────────
     Sale por un costado del nodo y entra al siguiente por el costado
     opuesto, para rodear el nombre en vez de atravesarlo. Los tramos que
     llegan a un tema dominado van en lima; el resto, punteados. */
  const dibujarCamino = (contenedor) => {
    if (!contenedor) return;
    const lienzo = contenedor.querySelector('.ruta2-path');
    const svg = contenedor.querySelector('.ruta2-svg');
    if (!lienzo || !svg) return;
    const base = lienzo.getBoundingClientRect();
    if (!base.width) { svg.innerHTML = ''; return; }
    svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);
    svg.setAttribute('width', base.width);
    svg.setAttribute('height', base.height);

    const tramos = [];
    lienzo.querySelectorAll('.ruta2-list').forEach((lista) => {
      const centros = Array.from(lista.querySelectorAll('.ruta2-node')).map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.left - base.left + r.width / 2, y: r.top - base.top + r.height / 2, w: r.width, h: r.height, estado: n.dataset.estado };
      });
      for (let i = 0; i < centros.length - 1; i++) {
        const a = centros[i], b = centros[i + 1];
        const dx = b.x - a.x;
        const dir = Math.abs(dx) > 16 ? Math.sign(dx) : (a.x >= base.width / 2 ? 1 : -1);
        const ax = a.x + dir * (a.w / 2 - 2), ay = a.y + a.h * 0.1;
        const bx = b.x - dir * (b.w / 2 - 2), by = b.y - b.h * 0.1;
        const alto = by - ay;
        const abre = Math.min(80, Math.max(40, Math.abs(dx) * 0.5 + 40));
        const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} C ${(ax + dir * abre).toFixed(1)} ${(ay + alto * 0.45).toFixed(1)}, ${(bx - dir * abre).toFixed(1)} ${(by - alto * 0.45).toFixed(1)}, ${bx.toFixed(1)} ${by.toFixed(1)}`;
        const hecho = a.estado === 'dominado' && b.estado === 'dominado';
        tramos.push(hecho
          ? `<path d="${d}" fill="none" stroke="#BFFF00" stroke-opacity=".55" stroke-width="8" stroke-linecap="round"/>`
          : `<path d="${d}" fill="none" stroke="#2A2A55" stroke-width="8" stroke-linecap="round" stroke-dasharray="2 16"/>`);
      }
    });
    svg.innerHTML = tramos.join('');
  };

  let temporizador = null;
  window.addEventListener('resize', () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => {
      if (!contenedorActivo) return;
      const ancho = contenedorActivo.getBoundingClientRect().width;
      contenedorActivo.querySelectorAll('.ruta2-step').forEach((li) => {
        li.style.setProperty('--x', `${desplazamiento(Number(li.dataset.i), ancho)}px`);
      });
      dibujarCamino(contenedorActivo);
    }, 120);
  });

  /**
   * Dibuja la ruta.
   * @param {HTMLElement} contenedor  #ruta-container
   * @param {Array} arbol             árbol de TreeManager
   * @param {Array} progreso          nodos de /progreso/nodos
   * @param {HTMLElement} [panel]     panel de detalle (#ruta-panel)
   */
  const render = (contenedor, arbol, progreso = [], panel = document.getElementById('ruta-panel')) => {
    if (!contenedor) return;
    contenedorActivo = contenedor;
    panelActivo = panel || null;

    if (!arbol || !arbol.length) {
      contenedor.innerHTML = `<div class="ruta-mensaje clay">${Icon.svg('map', 32)}<p style="margin-top:12px">Todavía no hay temas cargados en esta materia.</p></div>`;
      if (panelActivo) panelActivo.hidden = true;
      return;
    }

    const porId = new Map(progreso.map((n) => [String(n.id), n]));
    temasPorId = new Map();
    const ancho = contenedor.getBoundingClientRect().width || 640;

    let i = 0;
    const unidades = arbol.map((etapa, u) => {
      const hijos = aplanar(etapa);
      const temas = (hijos.length ? hijos : [etapa]).map((nodo) => {
        const p = porId.get(String(nodo.id)) || {};
        const t = {
          id: nodo.id,
          label: nodo.label || nodo.nombre || p.nombre || 'Tema',
          estado: p.estado || 'disponible',
          porcentaje: p.porcentaje || 0,
          respondidas: p.respondidas || 0,
          correctas: p.correctas || 0,
          preguntas: p.preguntas ?? 0,
          ultima_practica: p.ultima_practica || null,
          unidadNumero: u + 1,
          unidadNombre: etapa.label || etapa.nombre || '',
          i: i++,
        };
        temasPorId.set(String(t.id), t);
        return t;
      });
      return { etapa, numero: u + 1, temas };
    });

    const plano = unidades.flatMap((u) => u.temas);
    const siguiente = plano.find((t) => t.estado === 'en_progreso') || plano.find((t) => t.estado === 'disponible');
    if (!seleccionado || !temasPorId.has(String(seleccionado))) seleccionado = siguiente ? String(siguiente.id) : String(plano[0].id);

    contenedor.innerHTML = `
      <div class="ruta2-path">
        <svg class="ruta2-svg" aria-hidden="true" focusable="false"></svg>
        ${unidades.map((u) => {
          const conContenido = u.temas.filter((t) => t.estado !== 'vacio');
          const dom = u.temas.filter((t) => t.estado === 'dominado').length;
          return `
          <section class="ruta2-etapa" aria-labelledby="etapa-${u.etapa.id}">
            <header class="ruta2-unit">
              <span class="lbl">Unidad ${u.numero}</span>
              <strong id="etapa-${u.etapa.id}">${Utils.sanitizeHTML(u.etapa.label || u.etapa.nombre || '')}</strong>
              <small>${dom} de ${conContenido.length} temas dominados</small>
            </header>
            <ol class="ruta2-list">
              ${u.temas.map((t) => `
              <li class="ruta2-step ${t.estado}" data-id="${t.id}" data-i="${t.i}" style="--x:${desplazamiento(t.i, ancho)}px">
                ${siguiente && String(siguiente.id) === String(t.id) ? '<span class="ruta2-here" aria-hidden="true">Continúa aquí</span>' : ''}
                <button type="button" class="ruta2-node ${t.estado}" data-estado="${t.estado}" aria-pressed="false"
                  aria-label="${Utils.sanitizeHTML(t.label)}: ${ESTADOS[t.estado].etiqueta}${t.respondidas ? `, ${t.porcentaje}% de dominio` : ''}">
                  ${Icon.svg(ICONO_NODO[t.estado] || 'target', t.estado === 'dominado' ? 32 : 28, t.estado === 'dominado' ? 3 : 2)}
                </button>
                <span class="ruta2-name">${Utils.sanitizeHTML(t.label)}</span>
              </li>`).join('')}
            </ol>
          </section>`;
        }).join('')}
      </div>`;

    contenedor.querySelectorAll('.ruta2-step').forEach((li) => {
      li.querySelector('.ruta2-node').addEventListener('click', () => seleccionar(li.dataset.id, { enfocarPanel: true }));
    });

    seleccionar(seleccionado);
    requestAnimationFrame(() => dibujarCamino(contenedor));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => dibujarCamino(contenedor));
  };

  const refrescar = () => dibujarCamino(contenedorActivo);

  const irAlSiguiente = () => {
    const objetivo = contenedorActivo?.querySelector('.ruta2-here');
    objetivo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** Selecciona un tema desde fuera (p. ej. la vista Árbol). */
  const mostrarTema = (id) => { if (temasPorId.has(String(id))) seleccionar(id, { enfocarPanel: true }); };

  return { render, refrescar, irAlSiguiente, practicar, mostrarTema };
})();
