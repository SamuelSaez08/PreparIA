'use strict';

const router   = require('express').Router();
const nodoCtrl = require('../controllers/nodo.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateCrearNodo } = require('../utils/validators');
const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, errors.array());
  next();
};

router.get('/',               authenticate, nodoCtrl.getNodos);
router.post('/',              authenticate, validateCrearNodo, validate, nodoCtrl.crearNodo);
router.delete('/:id',         authenticate, nodoCtrl.deleteNodo);
router.patch('/:id',          authenticate, nodoCtrl.updateNombre);
router.get('/arbol/:idMateria', authenticate, nodoCtrl.getArbol);
router.get('/:id/material',     authenticate, nodoCtrl.getMaterialNodo);
router.get('/:id',            authenticate, nodoCtrl.getNodo);

module.exports = router;
