'use strict';

const router      = require('express').Router();
const reporteCtrl = require('../controllers/reporte.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const { validate, validateIdParam } = require('../utils/validators');

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/',    reporteCtrl.generar);      // ?tipo=&desde=&hasta=&formato=json|csv
router.get('/historial', reporteCtrl.historial);
router.get('/:id', validateIdParam, validate, reporteCtrl.detalle);

module.exports = router;
