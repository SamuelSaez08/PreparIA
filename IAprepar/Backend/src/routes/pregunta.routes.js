'use strict';

const router       = require('express').Router();
const preguntaCtrl = require('../controllers/pregunta.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const { validate, validateCrearPregunta, validateEditarPregunta, validateIdParam } = require('../utils/validators');

router.use(authenticate);

// Consultar el banco: administradores (el estudiante recibe preguntas
// únicamente a través de simulacros e intentos, nunca con la respuesta).
router.get('/',    authorize(ROLES.ADMIN), preguntaCtrl.listar);
router.get('/:id', authorize(ROLES.ADMIN), validateIdParam, validate, preguntaCtrl.detalle);

// Mantenimiento del banco (RF-04)
router.post('/',      authorize(ROLES.ADMIN), validateCrearPregunta, validate, preguntaCtrl.crear);
router.put('/:id',    authorize(ROLES.ADMIN), validateEditarPregunta, validate, preguntaCtrl.editar);
router.delete('/:id', authorize(ROLES.ADMIN), validateIdParam, validate, preguntaCtrl.eliminar);

module.exports = router;
