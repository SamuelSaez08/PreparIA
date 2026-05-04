/* ============================================================
   PreparIA — api.js
   Cliente HTTP centralizado para comunicación con el backend REST
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────────────────
   0. CONFIGURACIÓN BASE
────────────────────────────────────────────────────────── */
const API_BASE_URL = 'http://localhost:3000/api/v1';

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
    window.location.href = 'login';
    throw { ok: false, status: 401, mensaje: data.mensaje || 'Sesión expirada. Inicia sesión de nuevo.' };
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
  async register(nombre, apellido, email, password, grado) {
    const res = await apiFetch('/auth/register', {
      method: 'POST',
      body: {
        nombre,
        apellido,
        email,
        password,
        id_rol: 2, // Rol estudiante
        grado,
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
    window.location.href = 'login';
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

  async finalizarIntento(idIntento) {
    return apiFetch(`/intentos/${idIntento}/finalizar`, {
      method: 'POST',
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
  async getExamen(idMateria) {
    return apiFetch(`/examen-nivel?materia=${idMateria}`);
  },

  async responder(idExamen, idPregunta, idOpcion) {
    return apiFetch('/examen-nivel/responder', {
      method: 'POST',
      body: {
        id_examen:  idExamen,
        id_pregunta: idPregunta,
        id_opcion:  idOpcion,
      },
    });
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
  async getRanking(period = 'all_time') {
    return apiFetch(`/ranking?period=${encodeURIComponent(period)}`);
  },

  async getUserStats(userId) {
    return apiFetch(`/usuarios/${userId}/stats`);
  },
};
