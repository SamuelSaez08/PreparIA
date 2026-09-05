'use strict';

const router   = require('express').Router();
const nodoCtrl = require('../controllers/nodo.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validateCrearNodo } = require('../utils/validators');
const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');
const { ROLES } = require('../utils/constants');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, errors.array());
  next();
};

// Todas las rutas requieren sesión iniciada.
router.use(authenticate);

// ── Lectura: cualquier usuario autenticado ───────────────────────────────────
router.get('/',                 nodoCtrl.getNodos);
router.get('/arbol/:idMateria', nodoCtrl.getArbol);
router.get('/:id/material',     nodoCtrl.getMaterialNodo);
router.get('/:id',              nodoCtrl.getNodo);

// ── Escritura: solo administradores (RF-04) ──────────────────────────────────
router.post('/',      authorize(ROLES.ADMIN), validateCrearNodo, validate, nodoCtrl.crearNodo);
router.patch('/:id',  authorize(ROLES.ADMIN), nodoCtrl.updateNombre);
router.delete('/:id', authorize(ROLES.ADMIN), nodoCtrl.deleteNodo);

module.exports = router;
