'use strict';

const router = require('express').Router();
const progresoCtrl = require('../controllers/progreso.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/',            authenticate, progresoCtrl.getProgreso);
router.get('/nodos',       authenticate, progresoCtrl.getProgresoNodos);
router.get('/materia/:id', authenticate, progresoCtrl.getProgresoMateria);

module.exports = router;
