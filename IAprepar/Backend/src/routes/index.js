'use strict';

const router = require('express').Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    mensaje: 'PreparIA API funcionando correctamente.',
    version: 'v1',
    timestamp: new Date().toISOString(),
  });
});

// Mount routes
router.use('/auth',       require('./auth.routes'));
router.use('/simulacros', require('./simulacro.routes'));
router.use('/intentos',   require('./intento.routes'));
router.use('/progreso',   require('./progreso.routes'));
router.use('/nodos',      require('./nodo.routes'));
router.use('/ia',         require('./ia.routes'));
router.use('/',           require('./gamificacion.routes'));

module.exports = router;
