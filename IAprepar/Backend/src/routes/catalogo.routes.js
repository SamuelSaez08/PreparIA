'use strict';

const router       = require('express').Router();
const catalogoCtrl = require('../controllers/catalogo.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/materias', authenticate, catalogoCtrl.getMaterias);
router.get('/niveles',  authenticate, catalogoCtrl.getNiveles);

module.exports = router;
