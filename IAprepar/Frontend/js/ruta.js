'use strict';

/* ============================================================
   PreparIA — Ruta de aprendizaje

   Presenta el árbol de contenidos como un camino vertical: cada
   categoría es una etapa con su banner, y sus temas se recorren
   en zigzag hacia abajo.

   El estado de cada tema NO es inventado ni guardado en el
   navegador: viene de GET /progreso/nodos, que lo calcula a
   partir de las preguntas que el estudiante ya respondió en sus
   simulacros.

   No hay bloqueo: todos los temas son accesibles siempre. Los
   círculos comunican avance, no permiso.
   ============================================================ */

const RutaAprendizaje = (() => {

  const ICONOS_ETAPA = ['🏛️', '🌎', '⚖️', '📈', '🗳️', '🕰️', '🌐', '📜'];

  const ESTADOS = {
    dominado:    { clase: 'dominado',    etiqueta: 'Dominado' },
    en_progreso: { clase: 'progreso',    etiqueta: 'En progreso' },
    disponible:  { clase: 'disponible',  etiqueta: 'Sin practicar' },
    vacio:       { clase: 'vacio',       etiqueta: 'Sin contenido aún' },
  };

  /** Aplana la rama de una etapa en la secuencia de temas del camino. */
  const aplanar = (nodo, acumulado = [], profundidad = 0) => {
    (nodo.children || []).forEach((hijo) => {
      acumulado.push({ ...hijo, profundidad });
      aplanar(hijo, acumulado, profundidad + 1);
    });
    return acumulado;
  };

  /** Desplazamiento en zigzag: onda suave, no un vaivén brusco. */
  const desplazamiento = (indice) => Math.round(Math.sin(indice * 0.8) * 96);

  const anilloProgreso = (porcentaje) => {
    const radio = 34;
    const circunferencia = 2 * Math.PI * radio;
    const avance = circunferencia * (Math.min(100, Math.max(0, porcentaje)) / 100);
    return `
      <svg class="ruta-anillo" viewBox="0 0 80 80" aria-hidden="true">
        <circle class="ruta-anillo-fondo" cx="40" cy="40" r="${radio}"></circle>
        <circle class="ruta-anillo-avance" cx="40" cy="40" r="${radio}"
                stroke-dasharray="${avance.toFixed(1)} ${(circunferencia - avance).toFixed(1)}"></circle>
      </svg>`;
  };

  const iconoEstado = (tema, esSiguiente) => {
    if (tema.estado === 'dominado') return '★';
    if (tema.estado === 'vacio')    return '·';
    if (esSiguiente)                return '▶';
    return Utils.sanitizeHTML(tema.icon || '●');
  };

  const nodoHtml = (tema, indice, esSiguiente) => {
    const info    = ESTADOS[tema.estado] || ESTADOS.disponible;
    const x       = desplazamiento(indice);
    const detalle = tema.respondidas > 0
      ? `${tema.correctas} de ${tema.respondidas} preguntas correctas`
      : (tema.estado === 'vacio' ? 'Todavía sin material ni preguntas' : 'Aún no lo has practicado');

    return `
      <li class="ruta-paso" style="--x:${x}px">
        ${esSiguiente ? '<span class="ruta-aqui" aria-hidden="true">Continúa aquí</span>' : ''}
        <button type="button"
                class="ruta-nodo ${info.clase} ${esSiguiente ? 'siguiente' : ''}"
                data-nodo-id="${tema.id}"
                aria-label="${Utils.sanitizeHTML(tema.label)} — ${info.etiqueta}, ${tema.porcentaje}% de aciertos">
          ${tema.estado === 'en_progreso' ? anilloProgreso(tema.porcentaje) : ''}
          <span class="ruta-nodo-icono" aria-hidden="true">${iconoEstado(tema, esSiguiente)}</span>
        </button>
        <span class="ruta-nombre">${Utils.sanitizeHTML(tema.label)}</span>
        <span class="ruta-detalle">${detalle}</span>
      </li>`;
  };

  const etapaHtml = (etapa, numero, temas, indiceGlobalInicio, idSiguiente) => {
    const conContenido = temas.filter(t => t.estado !== 'vacio');
    const dominados    = temas.filter(t => t.estado === 'dominado').length;
    const avance       = conContenido.length ? Math.round((dominados / conContenido.length) * 100) : 0;

    const pasos = temas.map((tema, i) =>
      nodoHtml(tema, indiceGlobalInicio + i, String(tema.id) === String(idSiguiente))
    ).join('');

    return `
      <section class="ruta-etapa" aria-labelledby="etapa-${etapa.id}">
        <header class="ruta-banner">
          <div class="ruta-banner-texto">
            <p class="ruta-banner-eyebrow">Etapa ${numero}</p>
            <h3 id="etapa-${etapa.id}">${Utils.sanitizeHTML(etapa.icon || ICONOS_ETAPA[(numero - 1) % ICONOS_ETAPA.length])} ${Utils.sanitizeHTML(etapa.label)}</h3>
          </div>
          <div class="ruta-banner-avance" role="img" aria-label="${avance}% de la etapa dominado">
            <span class="ruta-banner-cifra">${avance}%</span>
            <span class="ruta-banner-pista">${dominados}/${conContenido.length || 0} temas</span>
          </div>
        </header>
        <ol class="ruta-camino">${pasos || '<li class="ruta-vacia">Esta etapa todavía no tiene temas.</li>'}</ol>
      </section>`;
  };

  /**
   * Dibuja la ruta completa.
   * @param {HTMLElement} contenedor
   * @param {Array} arbol       Árbol jerárquico de TreeManager
   * @param {Array} progreso    Nodos con estado devueltos por la API
   */
  const render = (contenedor, arbol, progreso = []) => {
    if (!contenedor) return;

    if (!arbol || !arbol.length) {
      contenedor.innerHTML = `
        <div class="ruta-mensaje">
          <div class="ruta-mensaje-icono">🗺️</div>
          <p>Todavía no hay temas cargados en esta materia.</p>
        </div>`;
      return;
    }

    const porId = new Map(progreso.map(n => [String(n.id), n]));

    const enriquecer = (nodo) => {
      const p = porId.get(String(nodo.id)) || {};
      return {
        ...nodo,
        estado:      p.estado      || 'disponible',
        porcentaje:  p.porcentaje  || 0,
        respondidas: p.respondidas || 0,
        correctas:   p.correctas   || 0,
      };
    };

    // El "siguiente" es el primer tema con contenido que aún no está dominado.
    const todos = [];
    arbol.forEach((etapa) => {
      const hijos = aplanar(etapa);
      const temas = (hijos.length ? hijos : [etapa]).map(enriquecer);
      todos.push({ etapa, temas });
    });

    const plano = todos.flatMap(t => t.temas);
    const siguiente = plano.find(t => t.estado === 'en_progreso')
      || plano.find(t => t.estado === 'disponible');
    const idSiguiente = siguiente ? siguiente.id : null;

    let indice = 0;
    contenedor.innerHTML = todos.map(({ etapa, temas }, i) => {
      const html = etapaHtml(etapa, i + 1, temas, indice, idSiguiente);
      indice += temas.length;
      return html;
    }).join('');

    contenedor.querySelectorAll('.ruta-nodo').forEach((boton) => {
      boton.addEventListener('click', () => {
        const id = boton.dataset.nodoId;
        window.location.href = `nodo.html#id=${encodeURIComponent(id)}`;
      });
    });
  };

  /** Lleva la vista al tema donde toca continuar. */
  const irAlSiguiente = (contenedor) => {
    const objetivo = contenedor?.querySelector('.ruta-nodo.siguiente');
    if (!objetivo) return;
    objetivo.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return { render, irAlSiguiente };
})();
