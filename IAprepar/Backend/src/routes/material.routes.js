'use strict';

const router       = require('express').Router();
const materialCtrl = require('../controllers/material.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const { validate, validateCrearMaterial, validateIdParam } = require('../utils/validators');

router.use(authenticate);

// Lectura: cualquier estudiante autenticado (caso de uso 4.3).
router.get('/',    materialCtrl.listar);
router.get('/:id', validateIdParam, validate, materialCtrl.detalle);

// Mantenimiento: solo administradores (RF-04).
router.post('/',      authorize(ROLES.ADMIN), validateCrearMaterial, validate, materialCtrl.crear);
router.put('/:id',    authorize(ROLES.ADMIN), validateIdParam, validate, materialCtrl.editar);
router.delete('/:id', authorize(ROLES.ADMIN), validateIdParam, validate, materialCtrl.eliminar);

module.exports = router;
