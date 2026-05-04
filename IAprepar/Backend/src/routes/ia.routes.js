'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/ia.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { body } = require('express-validator');
const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');
const { ROLES } = require('../utils/constants');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return fail(res, errors.array()[0].msg, 400, errors.array());
  }
  next();
};

router.use(authenticate);

router.get('/estado', ctrl.getEstado);
router.get('/historial', authorize(ROLES.ADMIN), ctrl.getHistorial);

router.post('/generar-preguntas',
  authorize(ROLES.ADMIN, ROLES.ESTUDIANTE),
  [
    body('id_nodo').isInt({ min: 1 }),
    body('id_nivel').isInt({ min: 1 }),
    body('dificultad').isIn(['facil', 'media', 'dificil']),
    body('cantidad').isInt({ min: 1, max: 10 }),
    body('contexto_adicional').optional().isString().isLength({ max: 300 }),
  ],
  validate,
  ctrl.generarPreguntas
);

router.post('/generar-simulacro',
  authorize(ROLES.ADMIN, ROLES.ESTUDIANTE),
  [
    body('id_materia').isInt({ min: 1 }),
    body('id_nivel').isInt({ min: 1 }),
    body('id_nodo').optional({ nullable: true }),
    body('cantidad').optional().isInt({ min: 5, max: 30 }),
    body('titulo').optional().isString().isLength({ max: 200 }),
    body('duracion_minutos').optional().isInt({ min: 10, max: 120 }),
    body('mezclar_dificultad').optional().isBoolean(),
  ],
  validate,
  ctrl.generarSimulacro
);

router.post('/mejorar-pregunta/:id', authorize(ROLES.ADMIN), ctrl.mejorarPregunta);
router.post('/generar-explicacion/:id', authorize(ROLES.ADMIN), ctrl.generarExplicacion);

module.exports = router;
