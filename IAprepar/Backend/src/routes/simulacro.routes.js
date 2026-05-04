'use strict';

const router = require('express').Router();
const simCtrl = require('../controllers/simulacro.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.get('/',    authenticate, simCtrl.getSimulacros);
router.get('/:id', authenticate, simCtrl.getSimulacro);

module.exports = router;
