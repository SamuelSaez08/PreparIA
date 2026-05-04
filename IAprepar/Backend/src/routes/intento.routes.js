'use strict';

const router      = require('express').Router();
const intentoCtrl = require('../controllers/intento.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validateIniciarIntento, validateResponder } = require('../utils/validators');
const { validationResult } = require('express-validator');
const { fail } = require('../utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return fail(res, errors.array()[0].msg, 400, errors.array());
  next();
};

router.get('/',               authenticate, intentoCtrl.getHistorial);
router.post('/',              authenticate, validateIniciarIntento, validate, intentoCtrl.iniciarIntento);
router.post('/:id/responder', authenticate, validateResponder,      validate, intentoCtrl.responderPregunta);
router.post('/:id/finalizar', authenticate, intentoCtrl.finalizarIntento);

module.exports = router;
