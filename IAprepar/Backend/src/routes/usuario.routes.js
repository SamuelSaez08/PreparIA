'use strict';

const router      = require('express').Router();
const usuarioCtrl = require('../controllers/usuario.controller');
const gamCtrl     = require('../controllers/gamificacion.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { ROLES } = require('../utils/constants');
const {
  validate, actualizarPerfilRules, validateIdParam,
  validateListarUsuarios, validateEstadoUsuario,
} = require('../utils/validators');

router.use(authenticate);

// ── Perfil propio (cualquier usuario autenticado) ────────────────────────────
router.get('/perfil', usuarioCtrl.getPerfil);
router.put('/perfil', actualizarPerfilRules, validate, usuarioCtrl.updatePerfil);

// ── Estadísticas públicas de un usuario (gamificación) ───────────────────────
router.get('/:id/stats', validateIdParam, validate, gamCtrl.getStatsUsuario);

// ── Administración (RF-03) ───────────────────────────────────────────────────
router.get('/',       authorize(ROLES.ADMIN), validateListarUsuarios, validate, usuarioCtrl.listar);
router.get('/:id',    authorize(ROLES.ADMIN), validateIdParam, validate, usuarioCtrl.detalle);
router.put('/:id',    authorize(ROLES.ADMIN), validateIdParam, actualizarPerfilRules, validate, usuarioCtrl.actualizar);
router.patch('/:id/estado', authorize(ROLES.ADMIN), validateEstadoUsuario, validate, usuarioCtrl.cambiarEstado);
router.delete('/:id', authorize(ROLES.ADMIN), validateIdParam, validate, usuarioCtrl.eliminar);

module.exports = router;
