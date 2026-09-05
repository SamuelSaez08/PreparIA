'use strict';

/**
 * PreparIA — Panel de administración.
 *
 * Cubre los tres casos de uso del actor Administrador que quedaban sin
 * implementar:
 *   4.9 Gestionar usuarios   → RF-03
 *   4.8 Gestionar contenidos → RF-04 (preguntas y material de estudio)
 *   4.7 Generar reportes     → resumen, CSV e impresión a PDF
 */
const PageAdmin = {

  estado: {
    usuarios:  { offset: 0, limit: 25, total: 0 },
    preguntas: { offset: 0, limit: 25, total: 0 },
    nodos:     [],
    niveles:   [],
    reporte:   null,
  },

  // ══════════════════════════════════════════════════════════════════════
  //  Arranque
  // ══════════════════════════════════════════════════════════════════════
  async init() {
    Auth.requireAuth();
    UI.initModalCloseHandlers();
    Utils.renderUserInNav();

    document.getElementById('logout-btn')?.addEventListener('click', () => Auth.logout());

    const usuario = Session.getUser();
    if (!usuario || usuario.rol !== 'admin') {
      document.getElementById('sin-permiso').hidden = false;
      return;
    }

    document.getElementById('admin-contenido').hidden = false;

    this.montarPestanas();
    this.montarUsuarios();
    this.montarPreguntas();
    this.montarMaterial();
    this.montarReportes();

    await this.cargarCatalogo();
    await this.cargarUsuarios();
  },

  montarPestanas() {
    const pestanas = document.querySelectorAll('.admin-tab');
    pestanas.forEach((boton) => {
      boton.addEventListener('click', () => {
        pestanas.forEach(b => b.classList.remove('active'));
        boton.classList.add('active');

        const objetivo = boton.dataset.panel;
        document.querySelectorAll('.admin-panel').forEach((panel) => {
          panel.hidden = panel.id !== `panel-${objetivo}`;
        });

        if (objetivo === 'preguntas' && !this._preguntasCargadas) this.cargarPreguntas();
        if (objetivo === 'material'  && !this._materialCargado)   this.cargarMaterial();
      });
    });
  },

  /** Nodos y niveles se usan en varios formularios: se cargan una sola vez. */
  async cargarCatalogo() {
    try {
      const [nodos, niveles] = await Promise.all([
        AdminAPI.getNodos(1),
        MateriasAPI.getNiveles(),
      ]);

      this.estado.nodos   = nodos.datos   || [];
      this.estado.niveles = niveles.datos || [];

      const opcionesNodos = this.estado.nodos
        .map(n => `<option value="${n.id}">${Utils.sanitizeHTML(n.nombre)}</option>`)
        .join('');

      const opcionesNiveles = this.estado.niveles
        .map(n => `<option value="${n.id}">${Utils.sanitizeHTML(n.nombre)}</option>`)
        .join('');

      const filtroNodo = document.getElementById('m-nodo');
      if (filtroNodo) filtroNodo.innerHTML = '<option value="">Todos los nodos</option>' + opcionesNodos;

      ['pf-nodo', 'mf-nodo'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opcionesNodos || '<option value="">Sin nodos cargados</option>';
      });

      const selNivel = document.getElementById('pf-nivel');
      if (selNivel) selNivel.innerHTML = opcionesNiveles || '<option value="">Sin niveles</option>';
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo cargar el catálogo de nodos.', 'error');
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  //  RF-03 — Usuarios
  // ══════════════════════════════════════════════════════════════════════
  montarUsuarios() {
    document.getElementById('u-refrescar')?.addEventListener('click', () => {
      this.estado.usuarios.offset = 0;
      this.cargarUsuarios();
    });

    document.getElementById('u-buscar')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.estado.usuarios.offset = 0;
        this.cargarUsuarios();
      }
    });

    document.getElementById('u-anterior')?.addEventListener('click', () => {
      const s = this.estado.usuarios;
      s.offset = Math.max(0, s.offset - s.limit);
      this.cargarUsuarios();
    });

    document.getElementById('u-siguiente')?.addEventListener('click', () => {
      const s = this.estado.usuarios;
      if (s.offset + s.limit < s.total) {
        s.offset += s.limit;
        this.cargarUsuarios();
      }
    });

    document.getElementById('form-usuario')?.addEventListener('submit', (e) => this.guardarUsuario(e));

    // Delegación: los botones se crean dinámicamente en cada recarga.
    document.getElementById('u-cuerpo')?.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      const { accion, id, activo, nombre } = boton.dataset;

      if (accion === 'editar')   this.abrirUsuario(id);
      if (accion === 'estado')   this.cambiarEstadoUsuario(id, activo === 'false', nombre);
      if (accion === 'eliminar') this.eliminarUsuario(id, nombre);
    });
  },

  async cargarUsuarios() {
    const cuerpo = document.getElementById('u-cuerpo');
    cuerpo.innerHTML = '<tr><td colspan="7" class="estado-vacio">Cargando usuarios…</td></tr>';

    try {
      const s = this.estado.usuarios;
      const res = await AdminAPI.usuarios.listar({
        q:      document.getElementById('u-buscar').value.trim(),
        rol:    document.getElementById('u-rol').value,
        activo: document.getElementById('u-estado').value,
        limit:  s.limit,
        offset: s.offset,
      });

      const usuarios = res.datos || [];
      s.total = (res.meta && res.meta.total) || usuarios.length;

      if (!usuarios.length) {
        cuerpo.innerHTML = '<tr><td colspan="7" class="estado-vacio">No hay usuarios que coincidan con la búsqueda.</td></tr>';
      } else {
        cuerpo.innerHTML = usuarios.map(u => this.filaUsuario(u)).join('');
      }

      const desde = s.total === 0 ? 0 : s.offset + 1;
      const hasta = Math.min(s.offset + s.limit, s.total);
      document.getElementById('u-conteo').textContent = `Mostrando ${desde}–${hasta} de ${s.total}`;

      document.getElementById('u-anterior').disabled  = s.offset === 0;
      document.getElementById('u-siguiente').disabled = s.offset + s.limit >= s.total;
    } catch (err) {
      cuerpo.innerHTML = `<tr><td colspan="7" class="estado-vacio">${Utils.sanitizeHTML(err.mensaje || 'No se pudieron cargar los usuarios.')}</td></tr>`;
    }
  },

  filaUsuario(u) {
    const nombre   = Utils.sanitizeHTML(`${u.nombre || ''} ${u.apellido || ''}`.trim());
    const contacto = [u.telefono, u.ciudad].filter(Boolean).map(Utils.sanitizeHTML).join(' · ') || '—';
    const rolPill  = u.rol === 'admin' ? '<span class="pill pill-admin">Admin</span>' : '';

    return `
      <tr>
        <td>
          <strong>${nombre || '(sin nombre)'}</strong> ${rolPill}<br>
          <span style="color:rgba(245,245,240,0.5);font-size:0.875rem">${Utils.sanitizeHTML(u.email)}</span>
        </td>
        <td>${Utils.sanitizeHTML(u.grado || '—')}</td>
        <td>${Utils.sanitizeHTML(u.institucion || '—')}</td>
        <td>${contacto}</td>
        <td style="font-variant-numeric:tabular-nums">${u.simulacros_completados ?? 0}</td>
        <td>${u.activo
              ? '<span class="pill pill-ok">Activa</span>'
              : '<span class="pill pill-off">Desactivada</span>'}</td>
        <td>
          <div class="acciones">
            <button class="btn-mini" data-accion="editar" data-id="${u.id}">Editar</button>
            <button class="btn-mini" data-accion="estado" data-id="${u.id}"
                    data-activo="${u.activo}" data-nombre="${Utils.sanitizeHTML(u.email)}">
              ${u.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn-mini peligro" data-accion="eliminar" data-id="${u.id}"
                    data-nombre="${Utils.sanitizeHTML(u.email)}">Eliminar</button>
          </div>
        </td>
      </tr>`;
  },

  async abrirUsuario(id) {
    try {
      const res = await AdminAPI.usuarios.detalle(id);
      const u = res.datos;

      document.getElementById('uf-id').value          = u.id;
      document.getElementById('uf-nombre').value      = u.nombre || '';
      document.getElementById('uf-apellido').value    = u.apellido || '';
      document.getElementById('uf-grado').value       = u.grado || '';
      document.getElementById('uf-institucion').value = u.institucion || '';
      document.getElementById('uf-ciudad').value      = u.ciudad || '';
      document.getElementById('uf-telefono').value    = u.telefono || '';

      UI.openModal('modal-usuario');
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo abrir el usuario.', 'error');
    }
  },

  async guardarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('uf-id').value;

    try {
      await AdminAPI.usuarios.actualizar(id, {
        nombre:      document.getElementById('uf-nombre').value.trim(),
        apellido:    document.getElementById('uf-apellido').value.trim(),
        grado:       document.getElementById('uf-grado').value.trim(),
        institucion: document.getElementById('uf-institucion').value.trim(),
        ciudad:      document.getElementById('uf-ciudad').value.trim(),
        telefono:    document.getElementById('uf-telefono').value.trim(),
      });

      UI.closeModal('modal-usuario');
      UI.showToast('Usuario actualizado.');
      this.cargarUsuarios();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo guardar.', 'error');
    }
  },

  async cambiarEstadoUsuario(id, activar, correo) {
    const accion = activar ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Seguro que quieres ${accion} la cuenta ${correo}?`)) return;

    try {
      await AdminAPI.usuarios.cambiarEstado(id, activar);
      UI.showToast(activar ? 'Cuenta activada.' : 'Cuenta desactivada.');
      this.cargarUsuarios();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo cambiar el estado.', 'error');
    }
  },

  async eliminarUsuario(id, correo) {
    if (!window.confirm(`Vas a eliminar definitivamente la cuenta ${correo}. Esta acción no se puede deshacer.\n\n¿Continuar?`)) return;

    try {
      await AdminAPI.usuarios.eliminar(id);
      UI.showToast('Usuario eliminado.');
      this.cargarUsuarios();
    } catch (err) {
      // 409 = tiene historial de simulacros; el backend sugiere desactivar.
      UI.showToast(err.mensaje || 'No se pudo eliminar.', 'error');
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  //  RF-04 — Banco de preguntas
  // ══════════════════════════════════════════════════════════════════════
  montarPreguntas() {
    document.getElementById('p-refrescar')?.addEventListener('click', () => {
      this.estado.preguntas.offset = 0;
      this.cargarPreguntas();
    });

    document.getElementById('p-nueva')?.addEventListener('click', () => this.abrirPregunta(null));

    document.getElementById('p-anterior')?.addEventListener('click', () => {
      const s = this.estado.preguntas;
      s.offset = Math.max(0, s.offset - s.limit);
      this.cargarPreguntas();
    });

    document.getElementById('p-siguiente')?.addEventListener('click', () => {
      const s = this.estado.preguntas;
      if (s.offset + s.limit < s.total) {
        s.offset += s.limit;
        this.cargarPreguntas();
      }
    });

    document.getElementById('form-pregunta')?.addEventListener('submit', (e) => this.guardarPregunta(e));

    document.getElementById('p-cuerpo')?.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      if (boton.dataset.accion === 'editar')  this.abrirPregunta(boton.dataset.id);
      if (boton.dataset.accion === 'retirar') this.retirarPregunta(boton.dataset.id);
    });
  },

  async cargarPreguntas() {
    this._preguntasCargadas = true;
    const cuerpo = document.getElementById('p-cuerpo');
    cuerpo.innerHTML = '<tr><td colspan="5" class="estado-vacio">Cargando preguntas…</td></tr>';

    try {
      const s = this.estado.preguntas;
      const res = await AdminAPI.preguntas.listar({
        q:          document.getElementById('p-buscar').value.trim(),
        dificultad: document.getElementById('p-dificultad').value,
        limit:      s.limit,
        offset:     s.offset,
      });

      const preguntas = res.datos || [];
      s.total = (res.meta && res.meta.total) || preguntas.length;

      if (!preguntas.length) {
        cuerpo.innerHTML = '<tr><td colspan="5" class="estado-vacio">Todavía no hay preguntas en el banco. Créalas aquí o genéralas con IA desde el árbol de conocimiento.</td></tr>';
      } else {
        cuerpo.innerHTML = preguntas.map(p => this.filaPregunta(p)).join('');
      }

      const desde = s.total === 0 ? 0 : s.offset + 1;
      const hasta = Math.min(s.offset + s.limit, s.total);
      document.getElementById('p-conteo').textContent = `Mostrando ${desde}–${hasta} de ${s.total}`;
      document.getElementById('p-anterior').disabled  = s.offset === 0;
      document.getElementById('p-siguiente').disabled = s.offset + s.limit >= s.total;
    } catch (err) {
      cuerpo.innerHTML = `<tr><td colspan="5" class="estado-vacio">${Utils.sanitizeHTML(err.mensaje || 'No se pudieron cargar las preguntas.')}</td></tr>`;
    }
  },

  filaPregunta(p) {
    const opciones = p.opciones || [];
    const correcta = opciones.find(o => o.es_correcta);
    const recorte  = (p.enunciado || '').length > 120
      ? p.enunciado.slice(0, 120) + '…'
      : (p.enunciado || '');

    return `
      <tr>
        <td style="max-width:420px">${Utils.sanitizeHTML(recorte)}</td>
        <td>${Utils.sanitizeHTML(p.nodo || '—')}</td>
        <td><span class="pill pill-${Utils.sanitizeHTML(p.dificultad || 'media')}">${Utils.sanitizeHTML(p.dificultad || 'media')}</span></td>
        <td>${correcta ? `<strong>${Utils.sanitizeHTML(correcta.letra)}</strong>` : '<span style="color:var(--coral)">sin definir</span>'}</td>
        <td>
          <div class="acciones">
            <button class="btn-mini" data-accion="editar" data-id="${p.id}">Editar</button>
            <button class="btn-mini peligro" data-accion="retirar" data-id="${p.id}">Retirar</button>
          </div>
        </td>
      </tr>`;
  },

  /** Dibuja las 4 filas de opciones (A–D) con su radio de "correcta". */
  renderOpciones(opciones = []) {
    const contenedor = document.getElementById('pf-opciones');
    const letras = ['A', 'B', 'C', 'D'];

    contenedor.innerHTML = letras.map((letra, i) => {
      const o = opciones[i] || {};
      return `
        <div class="opcion-fila">
          <span class="letra">${letra}</span>
          <input type="text" class="input-field" data-opcion="${i}"
                 value="${Utils.sanitizeHTML(o.texto || '')}" placeholder="Texto de la opción ${letra}">
          <label>
            <input type="radio" name="pf-correcta" value="${i}" ${o.es_correcta ? 'checked' : ''}>
            Correcta
          </label>
        </div>`;
    }).join('');
  },

  async abrirPregunta(id) {
    const form = document.getElementById('form-pregunta');
    form.reset();
    document.getElementById('pf-id').value = id || '';
    document.getElementById('pf-titulo').textContent = id ? 'Editar pregunta' : 'Nueva pregunta';

    if (!id) {
      this.renderOpciones([]);
      UI.openModal('modal-pregunta');
      return;
    }

    try {
      const res = await AdminAPI.preguntas.detalle(id);
      const p = res.datos;

      document.getElementById('pf-nodo').value        = p.id_nodo || '';
      document.getElementById('pf-nivel').value       = p.id_nivel || '';
      document.getElementById('pf-dificultad').value  = p.dificultad || 'media';
      document.getElementById('pf-texto-base').value  = p.texto_base || '';
      document.getElementById('pf-enunciado').value   = p.enunciado || '';
      document.getElementById('pf-explicacion').value = p.explicacion || '';

      this.renderOpciones(p.opciones || []);
      UI.openModal('modal-pregunta');
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo abrir la pregunta.', 'error');
    }
  },

  async guardarPregunta(e) {
    e.preventDefault();

    const id = document.getElementById('pf-id').value;
    const entradas = [...document.querySelectorAll('#pf-opciones input[data-opcion]')];
    const marcada  = document.querySelector('input[name="pf-correcta"]:checked');

    const opciones = entradas
      .map((input, i) => ({
        texto: input.value.trim(),
        es_correcta: marcada ? Number(marcada.value) === i : false,
      }))
      .filter(o => o.texto !== '');

    if (opciones.length < 2)                  return UI.showToast('Escribe al menos dos opciones.', 'error');
    if (!opciones.some(o => o.es_correcta))   return UI.showToast('Marca cuál es la opción correcta.', 'error');

    const enunciado = document.getElementById('pf-enunciado').value.trim();
    if (!enunciado) return UI.showToast('El enunciado no puede quedar vacío.', 'error');

    const datos = {
      id_nodo:     Number(document.getElementById('pf-nodo').value),
      id_nivel:    Number(document.getElementById('pf-nivel').value),
      enunciado,
      texto_base:  document.getElementById('pf-texto-base').value.trim(),
      dificultad:  document.getElementById('pf-dificultad').value,
      explicacion: document.getElementById('pf-explicacion').value.trim(),
      opciones,
    };

    try {
      if (id) await AdminAPI.preguntas.editar(id, datos);
      else    await AdminAPI.preguntas.crear(datos);

      UI.closeModal('modal-pregunta');
      UI.showToast(id ? 'Pregunta actualizada.' : 'Pregunta creada.');
      this.cargarPreguntas();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo guardar la pregunta.', 'error');
    }
  },

  async retirarPregunta(id) {
    if (!window.confirm('La pregunta dejará de aparecer en nuevos simulacros. Los intentos ya realizados no se modifican.\n\n¿Continuar?')) return;

    try {
      const res = await AdminAPI.preguntas.retirar(id);
      UI.showToast(res.mensaje || 'Pregunta retirada.');
      this.cargarPreguntas();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo retirar la pregunta.', 'error');
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  //  RF-04 — Material de estudio
  // ══════════════════════════════════════════════════════════════════════
  montarMaterial() {
    document.getElementById('m-refrescar')?.addEventListener('click', () => this.cargarMaterial());
    document.getElementById('m-nuevo')?.addEventListener('click', () => this.abrirMaterial(null));
    document.getElementById('form-material')?.addEventListener('submit', (e) => this.guardarMaterial(e));

    document.getElementById('m-cuerpo')?.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-accion]');
      if (!boton) return;
      if (boton.dataset.accion === 'editar')  this.abrirMaterial(boton.dataset.id);
      if (boton.dataset.accion === 'retirar') this.retirarMaterial(boton.dataset.id);
    });
  },

  async cargarMaterial() {
    this._materialCargado = true;
    const cuerpo = document.getElementById('m-cuerpo');
    cuerpo.innerHTML = '<tr><td colspan="5" class="estado-vacio">Cargando material…</td></tr>';

    try {
      const res = await AdminAPI.material.listar({ nodo: document.getElementById('m-nodo').value });
      const items = res.datos || [];

      if (!items.length) {
        cuerpo.innerHTML = '<tr><td colspan="5" class="estado-vacio">No hay material cargado para este filtro.</td></tr>';
        return;
      }

      cuerpo.innerHTML = items.map(m => `
        <tr>
          <td><strong>${Utils.sanitizeHTML(m.titulo)}</strong></td>
          <td>${Utils.sanitizeHTML(m.nodo || '—')}</td>
          <td>${Utils.sanitizeHTML(m.tipo || 'texto')}</td>
          <td>${m.url
                ? `<a href="${Utils.sanitizeHTML(m.url)}" target="_blank" rel="noopener" style="color:var(--acid)">Abrir</a>`
                : '—'}</td>
          <td>
            <div class="acciones">
              <button class="btn-mini" data-accion="editar" data-id="${m.id}">Editar</button>
              <button class="btn-mini peligro" data-accion="retirar" data-id="${m.id}">Retirar</button>
            </div>
          </td>
        </tr>`).join('');
    } catch (err) {
      cuerpo.innerHTML = `<tr><td colspan="5" class="estado-vacio">${Utils.sanitizeHTML(err.mensaje || 'No se pudo cargar el material.')}</td></tr>`;
    }
  },

  async abrirMaterial(id) {
    const form = document.getElementById('form-material');
    form.reset();
    document.getElementById('mf-id').value = id || '';
    document.getElementById('mf-titulo').textContent = id ? 'Editar material' : 'Nuevo material';

    if (id) {
      try {
        const res = await AdminAPI.material.listar({});
        const m = (res.datos || []).find(x => String(x.id) === String(id));
        if (m) {
          document.getElementById('mf-nodo').value         = m.id_nodo || '';
          document.getElementById('mf-titulo-campo').value = m.titulo || '';
          document.getElementById('mf-tipo').value         = m.tipo || 'texto';
          document.getElementById('mf-url').value          = m.url || '';
          document.getElementById('mf-contenido').value    = m.contenido || '';
        }
      } catch { /* se abre vacío */ }
    }

    UI.openModal('modal-material');
  },

  async guardarMaterial(e) {
    e.preventDefault();

    const id = document.getElementById('mf-id').value;
    const titulo = document.getElementById('mf-titulo-campo').value.trim();
    if (!titulo) return UI.showToast('El título es obligatorio.', 'error');

    const datos = {
      id_nodo:   Number(document.getElementById('mf-nodo').value),
      titulo,
      tipo:      document.getElementById('mf-tipo').value,
      url:       document.getElementById('mf-url').value.trim(),
      contenido: document.getElementById('mf-contenido').value,
    };

    if (!datos.url) delete datos.url;

    try {
      if (id) await AdminAPI.material.editar(id, datos);
      else    await AdminAPI.material.crear(datos);

      UI.closeModal('modal-material');
      UI.showToast(id ? 'Material actualizado.' : 'Material creado.');
      this.cargarMaterial();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo guardar el material.', 'error');
    }
  },

  async retirarMaterial(id) {
    if (!window.confirm('¿Retirar este material del árbol de conocimiento?')) return;

    try {
      await AdminAPI.material.retirar(id);
      UI.showToast('Material retirado.');
      this.cargarMaterial();
    } catch (err) {
      UI.showToast(err.mensaje || 'No se pudo retirar el material.', 'error');
    }
  },

  // ══════════════════════════════════════════════════════════════════════
  //  Caso de uso 4.7 — Reportes
  // ══════════════════════════════════════════════════════════════════════
  montarReportes() {
    document.getElementById('r-generar')?.addEventListener('click', () => this.generarReporte());
    document.getElementById('r-imprimir')?.addEventListener('click', () => window.print());

    document.getElementById('r-csv')?.addEventListener('click', async () => {
      try {
        await AdminAPI.reportes.descargarCsv({
          desde: document.getElementById('r-desde').value,
          hasta: document.getElementById('r-hasta').value,
        });
        UI.showToast('Archivo descargado.');
      } catch (err) {
        UI.showToast(err.mensaje || 'No se pudo generar el archivo.', 'error');
      }
    });
  },

  async generarReporte() {
    const contenedor = document.getElementById('r-resultado');
    contenedor.innerHTML = '<p class="estado-vacio">Compilando la información…</p>';

    try {
      const res = await AdminAPI.reportes.generar({
        desde: document.getElementById('r-desde').value,
        hasta: document.getElementById('r-hasta').value,
      });

      this.estado.reporte = res.datos;
      contenedor.innerHTML = this.renderReporte(res.datos);
    } catch (err) {
      contenedor.innerHTML = `<p class="estado-vacio">${Utils.sanitizeHTML(err.mensaje || 'No se pudo generar el reporte.')}</p>`;
    }
  },

  renderReporte(d) {
    const r = d.resumen || {};

    const kpis = [
      ['Estudiantes registrados', r.total_estudiantes],
      ['Cuentas activas',         r.usuarios_activos],
      ['Simulacros completados',  r.intentos_completados],
      ['Promedio general',        `${r.promedio_general ?? 0}%`],
      ['Mejor puntaje',           `${r.mejor_puntaje ?? 0}%`],
      ['Preguntas en el banco',   r.total_preguntas],
    ].map(([etiqueta, valor]) => `
      <div class="kpi">
        <div class="valor">${Utils.sanitizeHTML(String(valor ?? 0))}</div>
        <div class="etiqueta">${etiqueta}</div>
      </div>`).join('');

    const estudiantes = (d.rendimiento_por_estudiante || []).slice(0, 50).map(e => `
      <tr>
        <td><strong>${Utils.sanitizeHTML(`${e.nombre || ''} ${e.apellido || ''}`.trim())}</strong><br>
            <span style="color:rgba(245,245,240,0.5);font-size:0.875rem">${Utils.sanitizeHTML(e.email)}</span></td>
        <td>${Utils.sanitizeHTML(e.grado || '—')}</td>
        <td>${Utils.sanitizeHTML(e.institucion || '—')}</td>
        <td style="font-variant-numeric:tabular-nums">${e.simulacros}</td>
        <td style="font-variant-numeric:tabular-nums;color:${Utils.scoreColor(Number(e.promedio))}">${e.promedio}%</td>
        <td style="font-variant-numeric:tabular-nums">${e.mejor}%</td>
      </tr>`).join('');

    const falladas = (d.preguntas_mas_falladas || []).map(p => `
      <tr>
        <td style="max-width:420px">${Utils.sanitizeHTML((p.enunciado || '').slice(0, 140))}</td>
        <td>${Utils.sanitizeHTML(p.nodo || '—')}</td>
        <td style="font-variant-numeric:tabular-nums">${p.veces_respondida}</td>
        <td style="font-variant-numeric:tabular-nums;color:var(--coral)">${p.porcentaje_fallo}%</td>
      </tr>`).join('');

    return `
      <div style="margin-bottom:20px">
        <h2 style="margin-bottom:6px">Reporte de progreso general</h2>
        <p style="color:rgba(245,245,240,0.55);font-size:0.9rem">
          Periodo: ${Utils.sanitizeHTML(String(d.periodo.desde))} → ${Utils.sanitizeHTML(String(d.periodo.hasta))}
          · Generado el ${new Date(d.generado_en).toLocaleString('es-CO')}
        </p>
      </div>

      <div class="kpi-grid">${kpis}</div>

      <h3 style="margin:28px 0 12px">Rendimiento por estudiante</h3>
      <div class="tabla-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Estudiante</th><th>Grado</th><th>Institución</th><th>Simulacros</th><th>Promedio</th><th>Mejor</th></tr>
          </thead>
          <tbody>${estudiantes || '<tr><td colspan="6" class="estado-vacio">Sin datos en este periodo.</td></tr>'}</tbody>
        </table>
      </div>

      <h3 style="margin:28px 0 12px">Preguntas con mayor índice de error</h3>
      <div class="tabla-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>Enunciado</th><th>Nodo</th><th>Respondida</th><th>% de fallo</th></tr>
          </thead>
          <tbody>${falladas || '<tr><td colspan="4" class="estado-vacio">Aún no hay suficientes respuestas para este análisis.</td></tr>'}</tbody>
        </table>
      </div>`;
  },
};
