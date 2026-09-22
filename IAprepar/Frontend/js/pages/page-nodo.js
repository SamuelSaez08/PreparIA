'use strict';

/* ============================================================
   PreparIA — page-nodo.js  ·  Pantalla de un tema

   Qué cambió respecto a la versión anterior:
   · Todo el texto que viene del servidor se escapa antes de
     pintarlo (nombres de temas, títulos y cuerpo del material).
   · Una sola acción principal: practicar este tema.
   · El material se lee como un documento: medida de línea corta,
     índice lateral que sigue la lectura y barra flotante que
     aparece al bajar, con la misma salida por la que se entró.
   · El dominio del tema sale de /progreso/nodos, no del HTML.
   ============================================================ */

const PageNodo = (() => {
  const esc = (t) => (typeof Utils !== 'undefined' ? Utils.sanitizeHTML(t == null ? '' : String(t)) : String(t == null ? '' : t));
  const ico = (nombre, tam = 20, grosor) => (typeof Icon !== 'undefined' ? Icon.svg(nombre, tam, grosor) : '');
  const $ = (sel) => document.querySelector(sel);

  const ESTADOS = {
    dominado:    { etiqueta: 'Dominado',          cta: 'Repasar este tema' },
    en_progreso: { etiqueta: 'En progreso',       cta: 'Seguir practicando' },
    disponible:  { etiqueta: 'Sin practicar',     cta: 'Empezar este tema' },
    vacio:       { etiqueta: 'Sin preguntas aún', cta: 'Práctica no disponible' },
  };

  const TIPOS = {
    ejemplo:   { clase: 'ejemplo', icono: 'spark', etiqueta: 'Ejemplo' },
    tip_icfes: { clase: 'tip',     icono: 'target', etiqueta: 'Tip ICFES' },
    teoria:    { clase: 'teoria',  icono: 'book',  etiqueta: 'Teoría' },
  };

  let nodoActual = null;
  let idActual = null;
  let progresoTema = null;
  let observador = null;

  /* ── Utilidades de datos ─────────────────────────────────────────────── */

  const leerIdDeLaUrl = () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash) return hash.includes('=') ? new URLSearchParams(hash).get('id') : hash;
    return new URLSearchParams(window.location.search).get('id');
  };

  const mapearNodo = (raw, hijos = []) => ({
    id: raw.id,
    label: raw.nombre || 'Sin nombre',
    description: raw.descripcion || '',
    children: hijos,
  });

  const cargarArbol = async () => {
    try {
      const res = await NodosAPI.getArbol(1);
      const datos = res.datos || res;
      const arbol = Array.isArray(datos) ? datos : (datos.hijos || datos.nodos || [datos]);
      TreeManager.setTreeFromBackend(arbol);
    } catch { /* se resuelve con getNodo */ }
  };

  const buscarNodo = async (id) => {
    if (!TreeManager.getTree().length) await cargarArbol();
    let nodo = TreeManager.getNodeById(id);
    if (nodo) return nodo;

    await cargarArbol();
    nodo = TreeManager.getNodeById(id);
    if (nodo) return nodo;

    // Último recurso: pedir el nodo y sus hijos sueltos.
    const res = await NodosAPI.getNodo(id);
    const raw = res.datos || res;
    let hijos = [];
    try {
      const hijosRes = await NodosAPI.getNodos({ padre: id });
      hijos = ((hijosRes && hijosRes.datos) || []).map(h => mapearNodo(h));
    } catch { /* un tema sin hijos es normal */ }
    return mapearNodo(raw, hijos);
  };

  const rutaHasta = (id) => {
    const camino = [];
    const buscar = (nodos, previo) => {
      for (const n of nodos) {
        const paso = [...previo, { id: n.id, label: n.label }];
        if (String(n.id) === String(id)) { camino.push(...paso); return true; }
        if (n.children && buscar(n.children, paso)) return true;
      }
      return false;
    };
    buscar(TreeManager.getTree(), []);
    return camino;
  };

  const aplanarArbol = () => {
    const plano = [];
    const recorrer = (nodos) => nodos.forEach(n => { plano.push(n); if (n.children?.length) recorrer(n.children); });
    recorrer(TreeManager.getTree());
    return plano;
  };

  /** Dominio real del tema, si /progreso/nodos lo conoce. */
  const cargarProgreso = async (id) => {
    if (typeof ProgresoRuta === 'undefined') return null;
    try {
      const { temas } = await ProgresoRuta.cargar(1);
      return temas.find(t => String(t.id) === String(id)) || null;
    } catch { return null; }
  };

  /* ── Cabecera ────────────────────────────────────────────────────────── */

  const pintarCabecera = () => {
    const nodo = nodoActual;
    const hijos = nodo.children || [];
    const p = progresoTema;
    const estado = (p && p.estado) || (hijos.length ? null : 'disponible');

    document.title = `PreparIA — ${nodo.label}`;

    // Migas: la última no es enlace, es dónde estás.
    const camino = rutaHasta(idActual);
    const intermedios = camino.slice(0, -1).map(n =>
      `<span class="sep">/</span><a href="nodo.html#id=${encodeURIComponent(n.id)}">${esc(n.label)}</a>`).join('');
    $('#tema-crumbs').innerHTML = `
      <a href="dashboard.html">Inicio</a>
      <span class="sep">/</span>
      <a href="ciencias-sociales.html">Ciencias Sociales</a>
      ${intermedios}
      <span class="sep">/</span>
      <span class="ahora">${esc(nodo.label)}</span>`;

    const iconoTema = hijos.length ? 'tree' : (estado === 'dominado' ? 'check' : 'book');
    const cajaIco = $('#tema-ico');
    cajaIco.className = `tema-ico${estado === 'dominado' || !hijos.length ? '' : ' dim'}`;
    cajaIco.innerHTML = ico(iconoTema, 26, 2.2);

    $('#tema-nombre').textContent = nodo.label;

    const desc = (nodo.description || '').trim();
    const descEl = $('#tema-desc');
    // Una descripción corta suele ser un emoji o una etiqueta, no un texto.
    if (desc.length > 4) { descEl.textContent = desc; descEl.hidden = false; } else { descEl.hidden = true; }

    const chips = [];
    if (estado) chips.push(`<span class="status ${estado}">${ESTADOS[estado].etiqueta}</span>`);
    if (p && p.preguntas > 0) chips.push(`<span class="t4" style="font-size:.8125rem;font-weight:600">${p.preguntas} preguntas en el banco</span>`);
    if (hijos.length) chips.push(`<span class="t4" style="font-size:.8125rem;font-weight:600">${hijos.length} subtema${hijos.length > 1 ? 's' : ''}</span>`);
    const ultima = p && typeof ProgresoRuta !== 'undefined' ? ProgresoRuta.haceCuanto(p.ultima_practica) : null;
    if (ultima) chips.push(`<span class="t4" style="font-size:.8125rem;font-weight:600">Practicado ${esc(ultima)}</span>`);
    $('#tema-chips').innerHTML = chips.join('') || '<span class="t4" style="font-size:.8125rem;font-weight:600">Tema de estudio</span>';

    // Una sola acción principal por pantalla.
    const acciones = $('#tema-acciones');
    const puedePracticar = p ? p.preguntas > 0 : !hijos.length;
    acciones.innerHTML = `
      ${puedePracticar ? `<button type="button" class="btn btn-primary" data-practicar>${ico('play', 18)}<span>${(ESTADOS[estado] || ESTADOS.disponible).cta}</span></button>` : ''}
      <a href="ciencias-sociales.html" class="btn btn-secondary">${ico('route', 18)}<span>Ver en la ruta</span></a>`;

    $('[data-bar-titulo]').textContent = nodo.label;
    $('[data-bar-sub]').textContent = camino.length > 1 ? camino[0].label : 'Ciencias Sociales';
    const botonBarra = $('.tema-bar [data-practicar]');
    if (botonBarra) botonBarra.hidden = !puedePracticar;

    document.querySelectorAll('[data-practicar]').forEach(b => {
      b.addEventListener('click', () => practicar(b));
    });
  };

  /* ── Práctica del tema (banco de preguntas, 10 en 20 minutos) ────────── */

  const practicar = async (boton) => {
    if (typeof IAAPI === 'undefined') return;
    const botones = Array.from(document.querySelectorAll('[data-practicar]'));
    const original = botones.map(b => b.innerHTML);
    botones.forEach(b => { b.disabled = true; });
    if (boton) boton.innerHTML = '<span>Preparando…</span>';
    UI.showToast(`Buscando preguntas de "${nodoActual.label}" en el banco…`);

    try {
      const res = await IAAPI.generarSimulacro({
        id_materia: 1,
        id_nivel: 3,
        id_nodo: Number(idActual),
        cantidad: 10,
        duracion_minutos: 20,
        mezclar_dificultad: true,
        titulo: `Práctica: ${nodoActual.label}`,
      });
      const idSimulacro = res.datos && res.datos.id_simulacro;
      if (!idSimulacro) throw new Error('El servidor no devolvió el simulacro.');
      window.location.href = `simulacros.html#simulacro=${idSimulacro}`;
    } catch (err) {
      UI.showToast(err.mensaje || err.message || 'No se pudo preparar la práctica de este tema.', 'error');
      botones.forEach((b, i) => { b.disabled = false; b.innerHTML = original[i]; });
    }
  };

  /* ── Contenido ───────────────────────────────────────────────────────── */

  /** Escapa primero y solo entonces arma los párrafos. */
  const formatear = (texto) => String(texto || '')
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

  const vacio = (icono, titulo, cuerpo) => `
    <div class="clay tema-vacio">
      <span class="ico-redondo">${ico(icono, 22)}</span>
      <strong style="font-size:1rem">${esc(titulo)}</strong>
      <p class="t3" style="font-size:.9375rem;max-width:44ch">${esc(cuerpo)}</p>
    </div>`;

  const pintarContenido = async () => {
    const zona = $('#tema-contenido');
    const nodo = nodoActual;
    const hijos = nodo.children || [];
    const descripcion = (nodo.description || '').trim();
    const esNumerico = !isNaN(parseInt(idActual, 10));

    let materiales = [];
    if (esNumerico) {
      try {
        const res = await NodosAPI.getMaterial(idActual);
        materiales = (res && res.datos) ? res.datos : [];
      } catch (err) {
        zona.innerHTML = `
          <div class="clay tema-vacio">
            <span class="ico-redondo" style="color:var(--coral)">${ico('info', 22)}</span>
            <strong style="font-size:1rem">No se pudo cargar el contenido</strong>
            <p class="t3" style="font-size:.9375rem;max-width:44ch">${esc(err.mensaje || 'Revisa tu conexión e inténtalo de nuevo.')}</p>
            <button type="button" class="btn btn-secondary btn-sm" data-reintentar>${ico('refresh', 16)}<span>Reintentar</span></button>
          </div>`;
        zona.querySelector('[data-reintentar]')?.addEventListener('click', () => pintarContenido());
        return [];
      }
    }

    if (!materiales.length) {
      if (descripcion.length > 4) {
        zona.innerHTML = `<article class="clay mat teoria"><div class="prosa">${formatear(descripcion)}</div></article>`;
      } else if (hijos.length) {
        zona.innerHTML = vacio('tree', 'Este tema agrupa subtemas', 'Elige uno de los subtemas de la derecha para estudiar su contenido.');
      } else {
        zona.innerHTML = vacio('book', 'Sin material todavía', 'Este tema aún no tiene material de estudio. Puedes practicarlo con las preguntas del banco.');
      }
      return [];
    }

    const secciones = materiales.map((mat, i) => {
      const tipo = TIPOS[mat.tipo] || TIPOS.teoria;
      const titulo = mat.titulo || tipo.etiqueta;
      const cuerpo = formatear(mat.contenido || mat.cuerpo || '');
      return { id: `mat-${i + 1}`, titulo, tipo, html: `
        <article class="clay mat ${tipo.clase}" id="mat-${i + 1}">
          <div class="mat-head">
            <span class="mat-ico">${ico(tipo.icono, 18)}</span>
            <h2>${esc(titulo)}</h2>
            <span class="lbl">${tipo.etiqueta}</span>
          </div>
          <div class="prosa">${cuerpo}</div>
        </article>` };
    });

    zona.innerHTML = secciones.map(s => s.html).join('');
    return secciones;
  };

  /* ── Panel lateral: índice, dominio y subtemas ───────────────────────── */

  const pintarLateral = (secciones) => {
    const aside = $('#tema-aside');
    const hijos = nodoActual.children || [];
    const p = progresoTema;
    const bloques = [];

    if (p && (p.preguntas > 0 || p.porcentaje > 0)) {
      const barra = p.estado === 'dominado' ? '' : p.estado === 'en_progreso' ? 'amber' : 'dim';
      bloques.push(`
        <section class="clay card-pad dominio" aria-labelledby="dom-t">
          <span class="lbl" id="dom-t">Tu dominio del tema</span>
          <div class="dominio-cifra"><strong class="num">${p.porcentaje}%</strong><span class="t4" style="font-size:.8125rem;font-weight:600">de 80% para dominarlo</span></div>
          <div class="well bar"><span class="${barra}" style="width:${Math.max(2, p.porcentaje)}%"></span></div>
        </section>`);
    }

    if (secciones.length > 1) {
      bloques.push(`
        <nav class="clay card-pad stack gap-12 toc-card" aria-labelledby="idx-t">
          <span class="lbl" id="idx-t">En esta página</span>
          <div class="toc" id="tema-toc">
            ${secciones.map(s => `<a href="#${s.id}" data-ir="${s.id}">${esc(s.titulo)}</a>`).join('')}
          </div>
        </nav>`);
    }

    if (hijos.length) {
      bloques.push(`
        <section class="clay stack gap-4" style="padding:20px 8px 12px" aria-labelledby="sub-t">
          <span class="lbl" id="sub-t" style="padding:0 12px 6px">Subtemas</span>
          ${hijos.map((h, i) => `
            <a href="nodo.html#id=${encodeURIComponent(h.id)}" class="sub-row lift">
              <span class="num">${i + 1}</span>
              <span class="stack gap-4" style="min-width:0">
                <strong style="font-size:.9375rem">${esc(h.label)}</strong>
                ${h.children?.length ? `<small class="t4" style="font-size:.75rem">${h.children.length} subtema${h.children.length > 1 ? 's' : ''}</small>` : ''}
              </span>
              <span class="chev">${ico('chev', 18)}</span>
            </a>`).join('')}
        </section>`);
    }

    aside.innerHTML = bloques.join('');
    aside.hidden = !bloques.length;

    // El índice sigue la lectura y el salto respeta "movimiento reducido".
    if (secciones.length > 1) seguirLectura(secciones);
  };

  const seguirLectura = (secciones) => {
    const enlaces = new Map(secciones.map(s => [s.id, document.querySelector(`[data-ir="${s.id}"]`)]));
    const suave = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    enlaces.forEach((enlace, id) => {
      enlace?.addEventListener('click', (e) => {
        e.preventDefault();
        // No se toca el hash: aquí el hash es el id del tema, no la sección.
        document.getElementById(id)?.scrollIntoView({ behavior: suave ? 'smooth' : 'auto', block: 'start' });
      });
    });

    observador?.disconnect();
    observador = new IntersectionObserver((entradas) => {
      entradas.forEach(en => {
        if (!en.isIntersecting) return;
        enlaces.forEach(a => a?.classList.remove('aqui'));
        enlaces.get(en.target.id)?.classList.add('aqui');
      });
    }, { rootMargin: '-96px 0px -70% 0px', threshold: 0 });
    secciones.forEach(s => { const el = document.getElementById(s.id); if (el) observador.observe(el); });
  };

  /* ── Anterior / siguiente ────────────────────────────────────────────── */

  const pintarPrevNext = () => {
    const plano = aplanarArbol();
    const i = plano.findIndex(n => String(n.id) === String(idActual));
    const nav = $('#tema-prevnext');
    if (i === -1) { nav.hidden = true; return; }

    const previo = i > 0 ? plano[i - 1] : null;
    const siguiente = i < plano.length - 1 ? plano[i + 1] : null;
    if (!previo && !siguiente) { nav.hidden = true; return; }

    nav.hidden = false;
    nav.innerHTML = `
      ${previo ? `<a class="clay pn lift" href="nodo.html#id=${encodeURIComponent(previo.id)}"><small>Anterior</small><strong>${esc(previo.label)}</strong></a>` : '<span></span>'}
      ${siguiente ? `<a class="clay pn siguiente lift" href="nodo.html#id=${encodeURIComponent(siguiente.id)}"><small>Siguiente</small><strong>${esc(siguiente.label)}</strong></a>` : ''}`;
  };

  /* ── Barra flotante + progreso de lectura ────────────────────────────── */

  const barraFlotante = () => {
    const barra = $('#tema-bar');
    const linea = $('#tema-leido');
    const cabecera = $('#tema-head');
    let pendiente = false;

    const pintar = () => {
      pendiente = false;
      const limite = cabecera.offsetTop + cabecera.offsetHeight - 40;
      const visible = window.scrollY > limite;
      barra.classList.toggle('visible', visible);
      barra.setAttribute('aria-hidden', visible ? 'false' : 'true');

      const alto = document.documentElement.scrollHeight - window.innerHeight;
      const leido = alto > 0 ? Math.min(1, Math.max(0, window.scrollY / alto)) : 0;
      linea.style.transform = `scaleX(${leido})`;
    };

    // rAF: una lectura de layout por cuadro, nunca una por evento de scroll.
    window.addEventListener('scroll', () => {
      if (!pendiente) { pendiente = true; requestAnimationFrame(pintar); }
    }, { passive: true });
    pintar();
  };

  /* ── Errores ─────────────────────────────────────────────────────────── */

  const mostrarError = (mensaje) => {
    $('#tema-head').hidden = true;
    $('#tema-aside').hidden = true;
    $('#tema-prevnext').hidden = true;
    $('#tema-contenido').innerHTML = `
      <div class="clay tema-vacio">
        <span class="ico-redondo" style="color:var(--coral)">${ico('info', 22)}</span>
        <strong style="font-size:1rem">${esc(mensaje)}</strong>
        <a href="ciencias-sociales.html" class="btn btn-secondary btn-sm">${ico('back', 16)}<span>Volver a la ruta</span></a>
      </div>`;
  };

  /* ── Arranque ────────────────────────────────────────────────────────── */

  const init = async () => {
    Auth.requireAuth();

    idActual = leerIdDeLaUrl();
    if (!idActual) { window.location.href = 'ciencias-sociales.html'; return; }

    if (!PageNodo._hashListo) {
      PageNodo._hashListo = true;
      window.addEventListener('hashchange', () => { window.scrollTo({ top: 0 }); init(); });
      barraFlotante();
    }

    try {
      nodoActual = await buscarNodo(idActual);
    } catch {
      mostrarError('No encontramos este tema.');
      return;
    }

    progresoTema = await cargarProgreso(idActual);

    $('#tema-head').hidden = false;
    pintarCabecera();
    const secciones = await pintarContenido();
    pintarLateral(secciones);
    pintarPrevNext();

    if (typeof Icon !== 'undefined' && Icon.hydrate) Icon.hydrate();
  };

  return { init };
})();
