/* ============================================================
   PreparIA — api.js
   Cliente HTTP centralizado para comunicación con el backend REST
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   0. CONFIGURACIÓN BASE
────────────────────────────────────────────────────────── */
if (typeof PREPARIA_CONFIG === 'undefined') {
  throw new Error('[PreparIA] config.js no está cargado. Asegúrate de incluir <script src="js/config.js"></script> ANTES de api.js.');
}
const API_BASE_URL = PREPARIA_CONFIG.API_BASE_URL;

/* ──────────────────────────────────────────────────────────
   1. SESSION HELPERS
   Manejo de token y usuario en localStorage
────────────────────────────────────────────────────────── */
const Session = (() => {
  const TOKEN_KEY = 'preparia_token';
  const USER_KEY  = 'preparia_user';

  const getToken = () => {
    try { return localStorage.getItem(TOKEN_KEY); }
    catch { return null; }
  };

  const setToken = (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); }
    catch { /* silently fail */ }
  };

  const getUser = () => {
    try {
      const data = localStorage.getItem(USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  };

  const setUser = (user) => {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
    catch { /* silently fail */ }
  };

  const isLoggedIn = () => !!getToken();

  const clearSession = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* silently fail */ }
  };

  return { getToken, setToken, getUser, setUser, isLoggedIn, clearSession };
})();

/* ──────────────────────────────────────────────────────────
   2. API FETCH — Wrapper central
────────────────────────────────────────────────────────── */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Add authorization if token exists
  const token = Session.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build fetch options
  const fetchOptions = {
    method: options.method || 'GET',
    headers,
  };

  // Add body for non-GET requests
  if (options.body && fetchOptions.method !== 'GET') {
    fetchOptions.body = typeof options.body === 'string'
      ? options.body
      : JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (networkErr) {
    // Network error — no connection
    throw {
      ok: false,
      status: 0,
      mensaje: 'Sin conexión. Verifica tu internet.',
      networkError: true,
    };
  }

  // Parse JSON response
  let data;
  try {
    data = await response.json();
  } catch {
    data = { ok: false, mensaje: 'Respuesta inválida del servidor.' };
  }

  // Handle 401 — unauthorized
  if (response.status === 401) {
    Session.clearSession();
    // Guardamos el motivo para explicarlo en la pantalla de inicio de sesión
    // (por ejemplo, cuando la sesión se cerró por inactividad).
    try {
      sessionStorage.setItem('preparia_motivo_salida', data.mensaje || 'Tu sesión expiró. Inicia sesión de nuevo.');
    } catch { /* almacenamiento no disponible */ }
    window.location.href = 'login.html';
    throw { ok: false, status: 401, mensaje: data.mensaje || 'Sesión expirada. Inicia sesión de nuevo.' };
  }

  // Handle 403 — sin permisos (rol insuficiente)
  if (response.status === 403) {
    throw { ok: false, status: 403, mensaje: data.mensaje || 'No tienes permisos para esta acción.' };
  }

  // Handle non-ok responses
  if (!response.ok || data.ok === false) {
    throw {
      ok: false,
      status: response.status,
      mensaje: data.mensaje || `Error del servidor (${response.status})`,
      datos: data.datos || null,
    };
  }

  return data;
}

/* ──────────────────────────────────────────────────────────
   3. AuthAPI — Autenticación
────────────────────────────────────────────────────────── */
const AuthAPI = {
  /**
   * Registrar nuevo usuario
   */
  async register(datos) {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: {
        nombre:      datos.nombre,
        apellido:    datos.apellido || '',
        email:       datos.email,
        password:    datos.password,
        grado:       datos.grado,
        institucion: datos.institucion,   // RF-02
        ciudad:      datos.ciudad || '',  // RF-02
        telefono:    datos.telefono,      // RF-02
      },
    });

    // Guardar token y usuario
    if (res.datos) {
      if (res.datos.token) Session.setToken(res.datos.token);
      if (res.datos.usuario) Session.setUser(res.datos.usuario);
    }

    return res;
  },

  /**
   * Iniciar sesión
   */
  async login(email, password) {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    // Guardar token y usuario
    if (res.datos) {
      if (res.datos.token) Session.setToken(res.datos.token);
      if (res.datos.usuario) Session.setUser(res.datos.usuario);
    }

    return res;
  },

  /**
   * Cerrar sesión
   */
  async logout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the API call fails, we still want to clear the session
    }
    Session.clearSession();
    window.location.href = 'login.html';
  },

  /**
   * Cambiar la contraseña propia. Cierra la sesión al terminar.
   */
  async cambiarPassword(passwordActual, passwordNueva) {
    return apiFetch('/auth/password', {
      method: 'PUT',
      body: { password_actual: passwordActual, password_nueva: passwordNueva },
    });
  },
};

/* ──────────────────────────────────────────────────────────
   4. UsuarioAPI — Perfil de usuario
────────────────────────────────────────────────────────── */
const UsuarioAPI = {
  async getPerfil() {
    return apiFetch('/usuarios/perfil');
  },

  async updatePerfil(data) {
    return apiFetch('/usuarios/perfil', {
      method: 'PUT',
      body: data,
    });
  },
};

/* ──────────────────────────────────────────────────────────
   5. MateriasAPI — Materias y niveles
────────────────────────────────────────────────────────── */
const MateriasAPI = {
  async getMaterias() {
    return apiFetch('/materias');
  },

  async getNiveles() {
    return apiFetch('/niveles');
  },
};

/* ──────────────────────────────────────────────────────────
   6. NodosAPI — Árbol de nodos de aprendizaje
────────────────────────────────────────────────────────── */
const NodosAPI = {
  async getArbol(idMateria) {
    return apiFetch(`/nodos/arbol/${idMateria}`);
  },

  async getNodo(id) {
    return apiFetch(`/nodos/${id}`);
  },

  async getMaterial(id) {
    return apiFetch(`/nodos/${id}/material`);
  },

  async getNodos(params = {}) {
    const query = new URLSearchParams();
    if (params.materia) query.set('materia', params.materia);
    if (params.nivel)   query.set('nivel', params.nivel);
    if (params.padre)   query.set('padre', params.padre);
    const qs = query.toString();
    return apiFetch(`/nodos${qs ? '?' + qs : ''}`);
  },

  async crearNodo(datos) {
    return apiFetch('/nodos', {
      method: 'POST',
      body: JSON.stringify(datos)
    });
  },

  async eliminarNodo(id) {
    return apiFetch(`/nodos/${id}`, {
      method: 'DELETE'
    });
  },

  async actualizarNombre(id, nombre) {
    return apiFetch(`/nodos/${id}`, {
      method: 'PATCH',
      body: { nombre }
    });
  },
};

/* ──────────────────────────────────────────────────────────
   7. SimulacrosAPI — Simulacros e intentos
────────────────────────────────────────────────────────── */
const SimulacrosAPI = {
  async getSimulacros(params = {}) {
    const query = new URLSearchParams();
    if (params.materia) query.set('materia', params.materia);
    if (params.nivel)   query.set('nivel', params.nivel);
    const qs = query.toString();
    return apiFetch(`/simulacros${qs ? '?' + qs : ''}`);
  },

  async getSimulacro(id) {
    return apiFetch(`/simulacros/${id}`);
  },

  async iniciarIntento(idSimulacro) {
    return apiFetch('/intentos', {
      method: 'POST',
      body: { id_simulacro: idSimulacro },
    });
  },

  async responderPregunta(idIntento, idPregunta, idOpcion) {
    return apiFetch(`/intentos/${idIntento}/responder`, {
      method: 'POST',
      body: { id_pregunta: idPregunta, id_opcion: idOpcion },
    });
  },

  async finalizarIntento(idIntento, tiempoUsado) {
    return apiFetch(`/intentos/${idIntento}/finalizar`, {
      method: 'POST',
      body: tiempoUsado != null ? { tiempo_usado: tiempoUsado } : undefined,
    });
  },

  async getHistorial(params = {}) {
    const query = new URLSearchParams();
    if (params.por_pagina) query.set('por_pagina', params.por_pagina);
    if (params.pagina)     query.set('pagina', params.pagina);
    const qs = query.toString();
    return apiFetch(`/intentos${qs ? '?' + qs : ''}`);
  },
};

/* ──────────────────────────────────────────────────────────
   8. ProgresoAPI — Progreso del estudiante
────────────────────────────────────────────────────────── */
const ProgresoAPI = {
  async getProgreso() {
    return apiFetch('/progreso');
  },

  async getProgresoMateria(id) {
    return apiFetch(`/progreso/materia/${id}`);
  },
};

/* ──────────────────────────────────────────────────────────
   9. ExamenNivelAPI — Examen de nivelación
────────────────────────────────────────────────────────── */
const ExamenNivelAPI = {
  /** Devuelve el examen en curso o genera uno nuevo con preguntas fijas. */
  async getExamen(idMateria) {
    return apiFetch(`/examen-nivel?materia=${idMateria}`);
  },

  /**
   * Entrega el examen completo para su calificación.
   * @param {number} idExamen
   * @param {Array<{id_pregunta:number,id_opcion:number}>} respuestas
   */
  async responder(idExamen, respuestas) {
    return apiFetch('/examen-nivel/responder', {
      method: 'POST',
      body: { id_examen: idExamen, respuestas },
    });
  },

  /** Último nivel asignado al estudiante en esa materia. */
  async getResultado(idMateria) {
    return apiFetch(`/examen-nivel/resultado?materia=${idMateria}`);
  },
};

/* ──────────────────────────────────────────────────────────
   10. IAAPI — Generación con Google Gemini
────────────────────────────────────────────────────────── */
const IAAPI = {
  async generarPreguntas(opciones) {
    return apiFetch('/ia/generar-preguntas', {
      method: 'POST',
      body: opciones
    });
  },

  async generarSimulacro(opciones) {
    return apiFetch('/ia/generar-simulacro', {
      method: 'POST',
      body: opciones
    });
  },

  async mejorarPregunta(id) {
    return apiFetch(`/ia/mejorar-pregunta/${id}`, {
      method: 'POST'
    });
  },

  async getEstado() {
    return apiFetch('/ia/estado');
  }
};

/* ──────────────────────────────────────────────────────────
   11. RankingAPI — Leaderboard y estadísticas de gamificación
────────────────────────────────────────────────────────── */
const RankingAPI = {
  async getRanking(period = 'all_time', limit = 50, offset = 0) {
    return apiFetch(`/ranking?period=${encodeURIComponent(period)}&limit=${limit}&offset=${offset}`);
  },

  async getUserStats(userId) {
    return apiFetch(`/usuarios/${userId}/stats`);
  },
};

/* ──────────────────────────────────────────────────────────
   12. AdminAPI — Panel de administración
   RF-03 (gestión de perfiles), RF-04 (gestión de contenidos)
   y caso de uso 4.7 (generación de reportes).
   Todas las rutas exigen rol 'admin' en el backend.
────────────────────────────────────────────────────────── */
const AdminAPI = {

  // ── Usuarios (RF-03) ────────────────────────────────────
  usuarios: {
    async listar({ q = '', rol = '', activo = '', limit = 25, offset = 0 } = {}) {
      const query = new URLSearchParams();
      if (q)      query.set('q', q);
      if (rol)    query.set('rol', rol);
      if (activo !== '') query.set('activo', activo);
      query.set('limit', limit);
      query.set('offset', offset);
      return apiFetch(`/usuarios?${query.toString()}`);
    },

    async detalle(id) {
      return apiFetch(`/usuarios/${id}`);
    },

    async actualizar(id, datos) {
      return apiFetch(`/usuarios/${id}`, { method: 'PUT', body: datos });
    },

    async cambiarEstado(id, activo) {
      return apiFetch(`/usuarios/${id}/estado`, { method: 'PATCH', body: { activo } });
    },

    async eliminar(id) {
      return apiFetch(`/usuarios/${id}`, { method: 'DELETE' });
    },
  },

  // ── Banco de preguntas (RF-04) ──────────────────────────
  preguntas: {
    async listar({ q = '', nodo = '', nivel = '', dificultad = '', limit = 25, offset = 0 } = {}) {
      const query = new URLSearchParams();
      if (q)          query.set('q', q);
      if (nodo)       query.set('nodo', nodo);
      if (nivel)      query.set('nivel', nivel);
      if (dificultad) query.set('dificultad', dificultad);
      query.set('limit', limit);
      query.set('offset', offset);
      return apiFetch(`/preguntas?${query.toString()}`);
    },

    async detalle(id) {
      return apiFetch(`/preguntas/${id}`);
    },

    async crear(datos) {
      return apiFetch('/preguntas', { method: 'POST', body: datos });
    },

    async editar(id, datos) {
      return apiFetch(`/preguntas/${id}`, { method: 'PUT', body: datos });
    },

    async retirar(id) {
      return apiFetch(`/preguntas/${id}`, { method: 'DELETE' });
    },
  },

  // ── Material de estudio (RF-04) ─────────────────────────
  material: {
    async listar({ nodo = '', limit = 50, offset = 0 } = {}) {
      const query = new URLSearchParams();
      if (nodo) query.set('nodo', nodo);
      query.set('limit', limit);
      query.set('offset', offset);
      return apiFetch(`/material?${query.toString()}`);
    },

    async crear(datos) {
      return apiFetch('/material', { method: 'POST', body: datos });
    },

    async editar(id, datos) {
      return apiFetch(`/material/${id}`, { method: 'PUT', body: datos });
    },

    async retirar(id) {
      return apiFetch(`/material/${id}`, { method: 'DELETE' });
    },
  },

  // ── Reportes (caso de uso 4.7) ──────────────────────────
  reportes: {
    async generar({ tipo = 'progreso_general', desde = '', hasta = '' } = {}) {
      const query = new URLSearchParams({ tipo });
      if (desde) query.set('desde', desde);
      if (hasta) query.set('hasta', hasta);
      return apiFetch(`/reportes?${query.toString()}`);
    },

    /**
     * Descarga el reporte en CSV. No usa apiFetch porque la respuesta no es
     * JSON: hay que construir la petición y el enlace de descarga a mano.
     */
    async descargarCsv({ tipo = 'progreso_general', desde = '', hasta = '' } = {}) {
      const query = new URLSearchParams({ tipo, formato: 'csv' });
      if (desde) query.set('desde', desde);
      if (hasta) query.set('hasta', hasta);

      const respuesta = await fetch(`${API_BASE_URL}/reportes?${query.toString()}`, {
        headers: { Authorization: `Bearer ${Session.getToken()}` },
      });

      if (!respuesta.ok) {
        throw { ok: false, status: respuesta.status, mensaje: 'No se pudo generar el archivo.' };
      }

      const blob = await respuesta.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `preparia_${tipo}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },

    async historial() {
      return apiFetch('/reportes/historial');
    },
  },

  // ── Catálogo auxiliar ───────────────────────────────────
  async getNodos(idMateria = 1) {
    return apiFetch(`/nodos?materia=${idMateria}`);
  },
};
