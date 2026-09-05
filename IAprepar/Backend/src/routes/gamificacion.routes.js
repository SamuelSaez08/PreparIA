'use strict';

const router           = require('express').Router();
const gamificacionCtrl = require('../controllers/gamificacion.controller');
const { authenticate } = require('../middlewares/auth.middleware');

// GET /api/v1/ranking?period=all_time|weekly|monthly
router.get('/ranking', authenticate, gamificacionCtrl.getRanking);

// Las estadísticas por usuario viven en usuario.routes.js
// (GET /api/v1/usuarios/:id/stats)

module.exports = router;
