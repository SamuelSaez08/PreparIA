'use strict';

const iaService          = require('../services/ia.service');
const { testConnection } = require('../config/gemini');
const { ok, created, fail } = require('../utils/response');
const db                 = require('../config/db');
const { ROLES } = require('../utils/constants');

// Distribución por defecto de temas para Ciencias Sociales (porcentajes)
const DISTRIBUCION_CIENCIAS_SOCIALES = {
  'Historia y geografía':                0.35,
  'Política y Constitución colombiana':  0.30,
  'Relaciones espaciales y ambientales': 0.20,
  'Ética y ciudadanía':                  0.15,
};

// Convierte un mapa de porcentajes en cantidades enteras, distribuyendo el residuo
// por mayor parte decimal (algoritmo de mayor resto)
const calcularDistribucion = (subjectConfig, cantidadTotal) => {
  const temas   = Object.entries(subjectConfig);
  let asignado  = 0;
  const distribucion = {};

  // Asignar floor de cada tema
  temas.forEach(([tema, pct]) => {
    distribucion[tema] = Math.floor(pct * cantidadTotal);
    asignado += distribucion[tema];
  });

  // Distribuir preguntas sobrantes por mayor parte decimal (residuo)
  const sobrante = cantidadTotal - asignado;
  if (sobrante > 0) {
    const ordenados = temas
      .map(([tema, pct]) => ({ tema, decimal: (pct * cantidadTotal) % 1 }))
      .sort((a, b) => b.decimal - a.decimal);
    for (let i = 0; i < sobrante; i++) {
      distribucion[ordenados[i].tema] += 1;
    }
  }

  // Filtrar temas con 0 preguntas
  return Object.fromEntries(Object.entries(distribucion).filter(([, v]) => v > 0));
};

const generarPreguntas = async (req, res, next) => {
  try {
    const { id_nodo, id_nivel, dificultad, cantidad, contexto_adicional, guardar, subject_config } = req.body;

    // Obtener nombres para el prompt (incluye id_materia)
    const { rows: nRows } = await db.query(
      `SELECT n.nombre, n.id_materia, m.nombre AS materia
       FROM nodo_aprendizaje n
       JOIN materia m ON m.id = n.id_materia
       WHERE n.id = $1`, [id_nodo]
    );
    if (!nRows.length) return fail(res, 'Nodo no encontrado', 404);

    const { rows: nivRows } = await db.query('SELECT nombre FROM nivel WHERE id = $1', [id_nivel]);
    const nivelNombre = nivRows.length ? nivRows[0].nombre : 'General';

    // Calcular distribución de temas si se proporciona subject_config,
    // o aplicar la distribución por defecto para Ciencias Sociales
    let distribucion_temas = null;
    if (subject_config && typeof subject_config === 'object' && Object.keys(subject_config).length > 0) {
      distribucion_temas = calcularDistribucion(subject_config, parseInt(cantidad, 10));
    } else if (nRows[0].materia === 'Ciencias Sociales') {
      distribucion_temas = calcularDistribucion(DISTRIBUCION_CIENCIAS_SOCIALES, parseInt(cantidad, 10));
    }

    if ((guardar === 'true' || guardar === true) && req.user.rol !== ROLES.ADMIN) {
      return fail(res, 'Solo los administradores pueden guardar preguntas generadas', 403);
    }

    const opciones = {
      materia:            nRows[0].materia,
      nodo:               nRows[0].nombre,
      subtema:            '',
      nivel:              nivelNombre,
      dificultad,
      cantidad:           parseInt(cantidad, 10),
      tipo:               'seleccion_multiple',
      contexto_adicional,
      distribucion_temas,
    };

    const contextData = {
      id_usuario: req.user.id_usuario,
      id_materia: nRows[0].id_materia,
      id_nodo:    id_nodo,
    };

    const preguntas = await iaService.generarPreguntas(opciones, contextData);

    return ok(res, 'Preguntas generadas con IA', preguntas);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const generarSimulacro = async (req, res, next) => {
  try {
    // Solo admin (rutas ya lo restringen, pero checkamos por seguridad)
    const opciones = {
      ...req.body,
      id_usuario_admin: req.user.id_usuario
    };

    const simulacro = await iaService.generarSimulacroCompleto(opciones);
    return created(res, 'Simulacro generado guardado en la base de datos', simulacro);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const mejorarPregunta = async (req, res, next) => {
  try {
    const result = await iaService.mejorarPregunta(req.params.id, { id_usuario: req.user.id_usuario });
    return ok(res, 'Pregunta mejorada', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const generarExplicacion = async (req, res, next) => {
  try {
    const result = await iaService.generarExplicacion(req.params.id, { id_usuario: req.user.id_usuario });
    return ok(res, 'Explicación generada', result);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const getEstado = async (req, res, next) => {
  try {
    const apiConfigurada = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'tu_api_key_aqui';
    const testExitoso = apiConfigurada ? await testConnection() : false;

    return ok(res, 'Estado de la integración IA', {
      activa: apiConfigurada && testExitoso,
      modelo: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
      api_configurada: apiConfigurada,
      test_exitoso: testExitoso
    });
  } catch (err) {
    next(err);
  }
};

const getHistorial = async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT l.*, u.nombre AS usuario, m.nombre AS materia, n.nombre AS nodo
       FROM ia_log l
       LEFT JOIN usuario u ON u.id = l.id_usuario
       LEFT JOIN materia m ON m.id = l.id_materia
       LEFT JOIN nodo_aprendizaje n ON n.id = l.id_nodo
       ORDER BY l.creado_en DESC LIMIT 100`
    );
    return ok(res, 'Historial IA', rows);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  generarPreguntas,
  generarSimulacro,
  mejorarPregunta,
  generarExplicacion,
  getEstado,
  getHistorial
};
