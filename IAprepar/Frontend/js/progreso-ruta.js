'use strict';

/* ============================================================
   PreparIA — progreso-ruta.js
   Agrupa el progreso por nodo (GET /progreso/nodos) en unidades y
   temas, igual que la ruta de Ciencias Sociales.

   Lo usan el Inicio y Estadísticas. Antes esas dos pantallas
   mostraban barras escritas a mano en el HTML (72 %, 58 %, 45 %,
   38 %): todos los estudiantes veían los mismos números. Ahora
   salen de las respuestas reales de cada cuenta.
   ============================================================ */

const ProgresoRuta = (() => {
  let cache = null;

  const ESTADOS = {
    dominado:    { etiqueta: 'Dominado',          color: 'var(--acid)',  clase: '' },
    en_progreso: { etiqueta: 'En progreso',       color: 'var(--amber)', clase: 'amber' },
    disponible:  { etiqueta: 'Sin practicar',     color: '#3A3A6A',      clase: 'dim' },
    vacio:       { etiqueta: 'Sin preguntas aún', color: '#3A3A6A',      clase: 'dim' },
  };

  /** "hoy", "ayer", "hace 3 días"… a partir de una fecha ISO. */
  const haceCuanto = (iso) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dia = new Date(d); dia.setHours(0, 0, 0, 0);
    const n = Math.round((hoy - dia) / 86400000);
    if (n <= 0) return 'hoy';
    if (n === 1) return 'ayer';
    if (n < 30) return `hace ${n} días`;
    const m = Math.round(n / 30);
    return m === 1 ? 'hace un mes' : `hace ${m} meses`;
  };

  const agrupar = (nodos) => {
    const porId = new Map(nodos.map((n) => [String(n.id), { ...n, hijos: [] }]));
    const raices = [];
    porId.forEach((n) => {
      const padre = n.id_padre != null ? porId.get(String(n.id_padre)) : null;
      if (padre) padre.hijos.push(n); else raices.push(n);
    });

    const aplanar = (n, acc = []) => { n.hijos.forEach((h) => { acc.push(h); aplanar(h, acc); }); return acc; };

    const unidades = raices.map((r, i) => {
      const hijos = aplanar(r);
      const temas = hijos.length ? hijos : [r];
      const conContenido = temas.filter((t) => t.estado !== 'vacio');
      const pct = conContenido.length
        ? Math.round(conContenido.reduce((s, t) => s + (t.porcentaje || 0), 0) / conContenido.length)
        : 0;
      let estado = 'disponible';
      if (!conContenido.length) estado = 'vacio';
      else if (conContenido.every((t) => t.estado === 'dominado')) estado = 'dominado';
      else if (conContenido.some((t) => t.respondidas > 0)) estado = 'en_progreso';
      return { id: r.id, numero: i + 1, nombre: r.nombre, temas, pct, estado };
    });

    const temas = unidades.flatMap((u) => u.temas.map((t) => ({ ...t, unidad: u })));
    const siguiente = temas.find((t) => t.estado === 'en_progreso') || temas.find((t) => t.estado === 'disponible') || null;
    const practicados = temas.filter((t) => t.respondidas > 0 && t.estado !== 'dominado');
    const masDebil = practicados.sort((a, b) => a.porcentaje - b.porcentaje)[0] || null;

    return { unidades, temas, siguiente, masDebil };
  };

  const cargar = (idMateria = 1) => {
    if (!cache) {
      cache = ProgresoAPI.getProgresoNodos(idMateria)
        .then((res) => {
          const datos = (res && res.datos) || {};
          return { ...agrupar(datos.nodos || []), resumen: datos.resumen || null };
        })
        .catch((err) => { cache = null; throw err; });
    }
    return cache;
  };

  /** Fila de unidad (nombre, estado, barra y %) para listas de progreso. */
  const filaUnidad = (u, href = 'ciencias-sociales.html') => {
    const e = ESTADOS[u.estado] || ESTADOS.disponible;
    return `
      <a href="${href}" class="row-link" style="display:grid;grid-template-columns:minmax(0,1fr) 52px 20px">
        <span class="stack gap-8">
          <span class="inline" style="gap:10px;flex-wrap:wrap">
            <strong style="font-size:.9375rem">${Utils.sanitizeHTML(u.nombre)}</strong>
            <span class="status ${u.estado}">${e.etiqueta}</span>
          </span>
          <span class="well bar sm"><span class="${e.clase}" data-pct="${u.pct}"></span></span>
        </span>
        <strong class="num" style="text-align:right">${u.pct}%</strong>
        <span class="chev">${Icon.svg('chev', 18)}</span>
      </a>`;
  };

  /** Anima las barras recién pintadas desde 0 hasta su porcentaje. */
  const animarBarras = (raiz = document) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      raiz.querySelectorAll('.bar > span[data-pct]').forEach((b) => { b.style.width = `${b.dataset.pct}%`; });
    }));
  };

  return { cargar, filaUnidad, animarBarras, haceCuanto, ESTADOS };
})();
