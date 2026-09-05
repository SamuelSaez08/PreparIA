'use strict';

const router     = require('express').Router();
const examenCtrl = require('../controllers/examenNivel.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { validate, validateIniciarExamenNivel, validateResponderExamenNivel } = require('../utils/validators');

router.use(authenticate);

router.get('/resultado', validateIniciarExamenNivel, validate, examenCtrl.ultimoResultado);
router.get('/',          validateIniciarExamenNivel, validate, examenCtrl.obtener);
router.post('/responder', validateResponderExamenNivel, validate, examenCtrl.responder);

module.exports = router;
