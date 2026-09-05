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

// ── Módulos ──────────────────────────────────────────────────────────────────
router.use('/auth',          require('./auth.routes'));
router.use('/usuarios',      require('./usuario.routes'));        // RF-03
router.use('/simulacros',    require('./simulacro.routes'));      // RF-05
router.use('/intentos',      require('./intento.routes'));
router.use('/progreso',      require('./progreso.routes'));       // RF-07
router.use('/nodos',         require('./nodo.routes'));
router.use('/material',      require('./material.routes'));       // RF-04
router.use('/preguntas',     require('./pregunta.routes'));       // RF-04
router.use('/examen-nivel',  require('./examenNivel.routes'));    // RF-06
router.use('/reportes',      require('./reporte.routes'));        // Caso de uso 4.7
router.use('/ia',            require('./ia.routes'));

// Catálogo (/materias, /niveles) y gamificación (/ranking) cuelgan de la raíz.
router.use('/', require('./catalogo.routes'));
router.use('/', require('./gamificacion.routes'));

module.exports = router;
