'use strict';

const { body, param, query } = require('express-validator');
const { validationResult } = require('express-validator');
const { fail } = require('./response');

/** Middleware reutilizable: corta la petición si alguna regla falló. */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, errors.array());
  next();
};

// ── Autenticación ────────────────────────────────────────────────────────────

const loginRules = [
  body('email').isEmail().withMessage('Correo electrónico inválido.').trim().toLowerCase(),
  body('password').notEmpty().withMessage('La contraseña es requerida.'),
];

const registerRules = [
  body('nombre').trim().notEmpty().withMessage('El nombre es requerido.')
    .isLength({ max: 100 }).withMessage('El nombre no puede superar 100 caracteres.'),
  body('apellido').optional({ values: 'falsy' }).trim().isLength({ max: 100 })
    .withMessage('El apellido no puede superar 100 caracteres.'),
  body('email').isEmail().withMessage('Correo electrónico inválido.').trim().toLowerCase(),
  body('password').isLength({ min: 8 }).withMessage('La contraseña debe tener mínimo 8 caracteres.'),
  body('grado').trim().notEmpty().withMessage('El grado escolar es requerido.')
    .isLength({ max: 30 }).withMessage('Grado inválido.'),
  body('institucion').trim().notEmpty().withMessage('La institución educativa es requerida.')
    .isLength({ max: 150 }).withMessage('El nombre de la institución es demasiado largo.'),
  body('ciudad').optional({ values: 'falsy' }).trim().isLength({ max: 100 })
    .withMessage('La ciudad no puede superar 100 caracteres.'),
  body('telefono').trim().notEmpty().withMessage('El teléfono de contacto es requerido.')
    .matches(/^[0-9+\-\s()]{7,20}$/).withMessage('Teléfono inválido. Usa solo números, espacios, + y guiones.'),
];

const cambiarPasswordRules = [
  body('password_actual').notEmpty().withMessage('Debes escribir tu contraseña actual.'),
  body('password_nueva').isLength({ min: 8 }).withMessage('La contraseña nueva debe tener mínimo 8 caracteres.'),
];

// ── Perfil ───────────────────────────────────────────────────────────────────

const actualizarPerfilRules = [
  body('nombre').optional({ values: 'falsy' }).trim().isLength({ min: 2, max: 100 })
    .withMessage('El nombre debe tener entre 2 y 100 caracteres.'),
  body('apellido').optional({ values: 'null' }).trim().isLength({ max: 100 }),
  body('grado').optional({ values: 'null' }).trim().isLength({ max: 30 }),
  body('institucion').optional({ values: 'null' }).trim().isLength({ max: 150 }),
  body('ciudad').optional({ values: 'null' }).trim().isLength({ max: 100 }),
  body('telefono').optional({ values: 'null' }).trim()
    .matches(/^$|^[0-9+\-\s()]{7,20}$/).withMessage('Teléfono inválido.'),
];

// ── Simulacros e intentos ────────────────────────────────────────────────────

const validateIniciarIntento = [
  body('id_simulacro').isInt({ min: 1 }).withMessage('id_simulacro debe ser un entero positivo'),
];

const validateResponder = [
  body('id_pregunta').isInt({ min: 1 }).withMessage('id_pregunta debe ser un entero positivo'),
  body('id_opcion').isInt({ min: 1 }).withMessage('id_opcion debe ser un entero positivo'),
];

// ── Contenido (administración) ───────────────────────────────────────────────

const validateCrearNodo = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio').trim()
    .isLength({ max: 200 }).withMessage('El nombre no puede superar 200 caracteres'),
];

const validateCrearMaterial = [
  body('id_nodo').isInt({ min: 1 }).withMessage('id_nodo debe ser un entero positivo.'),
  body('titulo').trim().notEmpty().withMessage('El título es obligatorio.')
    .isLength({ max: 200 }).withMessage('El título no puede superar 200 caracteres.'),
  body('contenido').optional({ values: 'null' }).isString(),
  body('tipo').optional({ values: 'falsy' }).isIn(['texto', 'video', 'pdf', 'imagen', 'enlace', 'ejercicio'])
    .withMessage('Tipo inválido. Usa: texto, video, pdf, imagen, enlace o ejercicio.'),
  body('url').optional({ values: 'falsy' }).isURL().withMessage('La URL no es válida.'),
  body('orden').optional({ values: 'null' }).isInt({ min: 0 }),
];

const validateCrearPregunta = [
  body('id_nodo').isInt({ min: 1 }).withMessage('id_nodo debe ser un entero positivo.'),
  body('id_nivel').isInt({ min: 1 }).withMessage('id_nivel debe ser un entero positivo.'),
  body('enunciado').trim().notEmpty().withMessage('El enunciado es obligatorio.'),
  body('dificultad').optional({ values: 'falsy' }).isIn(['facil', 'media', 'dificil'])
    .withMessage('Dificultad inválida. Usa: facil, media o dificil.'),
  body('explicacion').optional({ values: 'null' }).isString(),
  body('opciones').isArray({ min: 2, max: 6 }).withMessage('Debes enviar entre 2 y 6 opciones.'),
  body('opciones.*.texto').trim().notEmpty().withMessage('Cada opción necesita texto.'),
  body('opciones.*.es_correcta').isBoolean().withMessage('Cada opción necesita es_correcta (true/false).'),
];

const validateEditarPregunta = [
  param('id').isInt({ min: 1 }).withMessage('Identificador inválido.'),
  body('enunciado').optional({ values: 'falsy' }).trim().notEmpty(),
  body('dificultad').optional({ values: 'falsy' }).isIn(['facil', 'media', 'dificil']),
  body('opciones').optional({ values: 'null' }).isArray({ min: 2, max: 6 }),
];

// ── Usuarios (administración) ────────────────────────────────────────────────

const validateIdParam = [
  param('id').isInt({ min: 1 }).withMessage('Identificador inválido.'),
];

const validateListarUsuarios = [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit debe estar entre 1 y 100.'),
  query('offset').optional().isInt({ min: 0 }).withMessage('offset debe ser 0 o mayor.'),
  query('rol').optional().isIn(['admin', 'estudiante']).withMessage('Rol inválido.'),
  query('activo').optional().isIn(['true', 'false']).withMessage('activo debe ser true o false.'),
];

const validateEstadoUsuario = [
  param('id').isInt({ min: 1 }).withMessage('Identificador inválido.'),
  body('activo').isBoolean().withMessage('activo debe ser true o false.'),
];

// ── Examen de nivel (RF-06) ──────────────────────────────────────────────────

const validateIniciarExamenNivel = [
  query('materia').isInt({ min: 1 }).withMessage('Debes indicar la materia.'),
];

const validateResponderExamenNivel = [
  body('id_examen').isInt({ min: 1 }).withMessage('id_examen debe ser un entero positivo.'),
  body('respuestas').isArray({ min: 1 }).withMessage('Debes enviar al menos una respuesta.'),
  body('respuestas.*.id_pregunta').isInt({ min: 1 }),
  body('respuestas.*.id_opcion').isInt({ min: 1 }),
];

module.exports = {
  validate,
  loginRules, registerRules, cambiarPasswordRules, actualizarPerfilRules,
  validateIniciarIntento, validateResponder,
  validateCrearNodo, validateCrearMaterial, validateCrearPregunta, validateEditarPregunta,
  validateIdParam, validateListarUsuarios, validateEstadoUsuario,
  validateIniciarExamenNivel, validateResponderExamenNivel,
};
