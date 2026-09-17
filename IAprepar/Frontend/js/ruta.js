'use strict';

/* ============================================================
   PreparIA — Ruta de aprendizaje

   El árbol de contenidos como un camino: cada categoría es una
   etapa con su banner, y sus temas descienden en curva.

   El trazo se dibuja con SVG a partir de la posición real de
   cada nodo, así que sigue las curvas aunque cambie el ancho de
   la pantalla. El color de cada tramo lo decide el estado del
   tema al que llega: verde dominado, ámbar en progreso, gris sin
   practicar y gris punteado cuando todavía no hay contenido.

   El estado NO se inventa ni se guarda en el navegador: viene de
   GET /progreso/nodos, calculado a partir de las preguntas que el
   estudiante ya respondió en sus simulacros.

   No hay bloqueo. Los círculos comunican avance, no permiso: por
   eso ningún nodo lleva candado.
   ============================================================ */

const RutaAprendizaje = (() => {

  const ICONOS_ETAPA = ['🏛️', '🌎', '⚖️', '📈', '🗳️', '🕰️', '🌐', '📜'];

  const ESTADOS = {
    dominado:    { clase: 'dominado',   etiqueta: 'Dominado' },
    en_progreso: { clase: 'progreso',   etiqueta: 'En progreso' },
    disponible:  { clase: 'disponible', etiqueta: 'Sin practicar' },
    vacio:       { clase: 'vacio',      etiqueta: 'Sin contenido aún' },
  };

  const COLOR_TRAMO = {
    dominado:    { color: 'var(--acid)',                  discontinuo: false, opacidad: 1    },
    en_progreso: { color: 'var(--amber)',                 discontinuo: false, opacidad: 0.95 },
    disponible:  { color: 'rgba(245,245,240,0.22)',       discontinuo: false, opacidad: 1    },
    vacio:       { color: 'rgba(245,245,240,0.14)',       discontinuo: true,  opacidad: 1    },
  };

  let contenedorActivo = null;

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
    const radio = 30;
    const circunferencia = 2 * Math.PI * radio;
    const avance = circunferencia * (Math.min(100, Math.max(0, porcentaje)) / 100);
    return `
      <svg class="ruta-anillo" viewBox="0 0 68 68" aria-hidden="true">
        <circle class="ruta-anillo-fondo" cx="34" cy="34" r="${radio}"></circle>
        <circle class="ruta-anillo-avance" cx="34" cy="34" r="${radio}"
                stroke-dasharray="${avance.toFixed(1)} ${(circunferencia - avance).toFixed(1)}"></circle>
      </svg>`;
  };

  const iconoEstado = (tema, esSiguiente) => {
    if (esSiguiente)                return '▶';
    if (tema.estado === 'dominado') return '★';
    if (tema.estado === 'vacio')    return '·';
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
                data-estado="${tema.estado}"
                aria-label="${Utils.sanitizeHTML(tema.label)} — ${info.etiqueta}, ${tema.porcentaje}% de aciertos">
          ${tema.estado === 'dominado' ? '<span class="ruta-corona" aria-hidden="true">👑</span>' : ''}
          <span class="ruta-disco">
            ${tema.estado === 'en_progreso' ? anilloProgreso(tema.porcentaje) : ''}
            <span class="ruta-icono" aria-hidden="true">${iconoEstado(tema, esSiguiente)}</span>
          </span>
        </button>
        <span class="ruta-etiqueta">
          <span class="ruta-nombre">${Utils.sanitizeHTML(tema.label)}</span>
          <span class="ruta-detalle">${detalle}</span>
          ${tema.estado === 'vacio' ? '' : `
            <button type="button" class="ruta-practicar"
                    data-practicar-id="${tema.id}"
                    data-practicar-nombre="${Utils.sanitizeHTML(tema.label)}">
              Practicar
            </button>`}
        </span>
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
        <ol class="ruta-camino">
          <svg class="ruta-trazo" aria-hidden="true" focusable="false"></svg>
          ${pasos || '<li class="ruta-vacia">Esta etapa todavía no tiene temas.</li>'}
        </ol>
      </section>`;
  };

  /* ────────────────────────────────────────────────────────────
     Trazo del camino
     Se calcula después de pintar, con la posición real de cada
     nodo. Un tramo por par de nodos, para que cada uno lleve el
     color de su estado.
  ──────────────────────────────────────────────────────────── */
  const dibujarCamino = (contenedor) => {
    if (!contenedor) return;

    contenedor.querySelectorAll('.ruta-camino').forEach((camino) => {
      const svg   = camino.querySelector('.ruta-trazo');
      const nodos = Array.from(camino.querySelectorAll('.ruta-nodo'));
      if (!svg) return;

      const base = camino.getBoundingClientRect();
      // Si la vista está oculta el ancho es 0: no tiene sentido medir.
      if (!base.width || nodos.length < 2) { svg.innerHTML = ''; return; }

      svg.setAttribute('width',  base.width);
      svg.setAttribute('height', base.height);
      svg.setAttribute('viewBox', `0 0 ${base.width} ${base.height}`);

      const centros = nodos.map((n) => {
        const r = n.getBoundingClientRect();
        return {
          x: r.left - base.left + r.width / 2,
          y: r.top  - base.top  + r.height / 2,
          w: r.width,
          h: r.height,
          estado: n.dataset.estado || 'disponible',
        };
      });

      const centroX = base.width / 2;
      const tramos = [];

      for (let i = 0; i < centros.length - 1; i++) {
        const a = centros[i];
        const b = centros[i + 1];

        // El nombre del tema va justo debajo de cada nodo, así que el trazo
        // no puede bajar por el centro: sale por un costado de la tarjeta,
        // se abre hacia afuera y entra al siguiente nodo por el costado
        // opuesto. Así rodea el texto en vez de atravesarlo.
        const dx  = b.x - a.x;
        const dir = Math.abs(dx) > 24
          ? Math.sign(dx)
          : (a.x >= centroX ? 1 : -1);

        const ax = a.x + dir * (a.w / 2 - 4);
        const ay = a.y + a.h * 0.16;
        const bx = b.x - dir * (b.w / 2 - 4);
        const by = b.y - b.h * 0.16;

        const alto  = by - ay;
        const apertura = Math.min(70, Math.max(34, Math.abs(dx) * 0.45 + 34));

        const d = `M ${ax.toFixed(1)} ${ay.toFixed(1)} ` +
                  `C ${(ax + dir * apertura).toFixed(1)} ${(ay + alto * 0.42).toFixed(1)}, ` +
                  `${(bx - dir * apertura).toFixed(1)} ${(by - alto * 0.42).toFixed(1)}, ` +
                  `${bx.toFixed(1)} ${by.toFixed(1)}`;

        const estilo = COLOR_TRAMO[b.estado] || COLOR_TRAMO.disponible;

        // Los tramos ya dominados llevan un halo detrás.
        if (b.estado === 'dominado') {
          tramos.push(`<path d="${d}" class="tramo-halo" />`);
        }

        tramos.push(
          `<path d="${d}" class="tramo" ` +
          `stroke="${estilo.color}" ` +
          `opacity="${estilo.opacidad}" ` +
          (estilo.discontinuo ? 'stroke-dasharray="2 16" ' : '') +
          `/>`
        );
      }

      svg.innerHTML = tramos.join('');
    });
  };

  let temporizador = null;
  const redibujarConRetraso = () => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => dibujarCamino(contenedorActivo), 120);
  };

  window.addEventListener('resize', redibujarConRetraso);

  /**
   * Genera un simulacro centrado en un solo tema y lo arranca.
   * Es la vía por la que el progreso del tema se mueve: las preguntas nacen
   * con su id_nodo, así que las respuestas se pueden atribuir después.
   */
  const practicarTema = async (boton) => {
    if (typeof IAAPI === 'undefined') return;

    const id     = boton.dataset.practicarId;
    const nombre = boton.dataset.practicarNombre;
    const texto  = boton.textContent;

    boton.disabled = true;
    boton.textContent = 'Preparando…';
    // Las preguntas salen del banco de la base de datos, no de la IA: esto es
    // cuestión de milisegundos, no de esperar a que Gemini escriba nada.
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

      const total = res.datos.total_preguntas || 0;
      UI.showToast(`${total} preguntas del banco listas. Arrancando…`);

      window.location.href = `simulacros.html#simulacro=${idSimulacro}`;
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo generar la práctica de este tema.', 'error');
      boton.disabled = false;
      boton.textContent = texto;
    }
  };

  /**
   * Dibuja la ruta completa.
   * @param {HTMLElement} contenedor
   * @param {Array} arbol     Árbol jerárquico de TreeManager
   * @param {Array} progreso  Nodos con estado devueltos por la API
   */
  const render = (contenedor, arbol, progreso = []) => {
    if (!contenedor) return;
    contenedorActivo = contenedor;

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

    const todos = [];
    arbol.forEach((etapa) => {
      const hijos = aplanar(etapa);
      const temas = (hijos.length ? hijos : [etapa]).map(enriquecer);
      todos.push({ etapa, temas });
    });

    // El "siguiente" es el primer tema con contenido que aún no está dominado.
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
        window.location.href = `nodo.html#id=${encodeURIComponent(boton.dataset.nodoId)}`;
      });
    });

    contenedor.querySelectorAll('.ruta-practicar').forEach((boton) => {
      boton.addEventListener('click', (e) => {
        e.stopPropagation();
        practicarTema(boton);
      });
    });

    // Las fuentes y los emojis pueden mover los nodos unos píxeles:
    // se dibuja en el siguiente cuadro, ya con la maquetación estable.
    requestAnimationFrame(() => dibujarCamino(contenedor));
  };

  /** Vuelve a medir. Necesario al mostrar la ruta si estaba oculta. */
  const refrescar = () => dibujarCamino(contenedorActivo);

  /** Lleva la vista al tema donde toca continuar. */
  const irAlSiguiente = () => {
    const objetivo = contenedorActivo?.querySelector('.ruta-nodo.siguiente');
    objetivo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return { render, refrescar, irAlSiguiente };
})();
