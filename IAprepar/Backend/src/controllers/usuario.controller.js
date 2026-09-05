'use strict';

/**
 * RF-03 — Gestión de perfiles.
 * Perfil propio para cualquier usuario autenticado; listado, edición,
 * activación/desactivación y eliminación para administradores.
 */

const db = require('../config/db');
const logger = require('../utils/logger');
const usuarioRepo = require('../repositories/usuario.repo');
const { ok, fail } = require('../utils/response');

// ── Perfil propio ────────────────────────────────────────────────────────────

const getPerfil = async (req, res, next) => {
  try {
    const { rows } = await usuarioRepo.getPerfil(req.user.id_usuario);
    if (!rows.length) return fail(res, 'Usuario no encontrado.', 404);
    return ok(res, 'Perfil obtenido.', rows[0]);
  } catch (err) { next(err); }
};

const updatePerfil = async (req, res, next) => {
  try {
    const idUsuario = req.user.id_usuario;
    const { nombre, apellido, grado, institucion, ciudad, telefono } = req.body;

    await db.transaction(async (client) => {
      if (nombre !== undefined || apellido !== undefined) {
        await usuarioRepo.updateDatosBasicos(client, idUsuario, { nombre, apellido });
      }
      if (grado !== undefined || institucion !== undefined || ciudad !== undefined || telefono !== undefined) {
        await usuarioRepo.createPerfil(client, idUsuario, {
          grado:       grado ?? null,
          institucion: institucion ?? null,
          ciudad:      ciudad ?? null,
          telefono:    telefono ?? null,
        });
      }
    });

    const { rows } = await usuarioRepo.getPerfil(idUsuario);
    logger.info(`Perfil actualizado: usuario id=${idUsuario}`);
    return ok(res, 'Perfil actualizado.', rows[0]);
  } catch (err) { next(err); }
};

// ── Administración ───────────────────────────────────────────────────────────

const listar = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '25', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const filtros = {
      busqueda: req.query.q ? String(req.query.q).trim() : null,
      rol:      req.query.rol || null,
      activo:   req.query.activo === undefined ? null : req.query.activo === 'true',
    };

    const [{ rows }, { rows: totalRows }] = await Promise.all([
      usuarioRepo.listar({ ...filtros, limit, offset }),
      usuarioRepo.contar(filtros),
    ]);

    return ok(res, 'Usuarios obtenidos.', rows, {
      total: totalRows[0].total,
      limit,
      offset,
    });
  } catch (err) { next(err); }
};

const detalle = async (req, res, next) => {
  try {
    const { rows } = await usuarioRepo.getPerfil(req.params.id);
    if (!rows.length) return fail(res, 'Usuario no encontrado.', 404);
    return ok(res, 'Usuario obtenido.', rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nombre, apellido, grado, institucion, ciudad, telefono } = req.body;

    const { rows: existe } = await usuarioRepo.findById(id);
    if (!existe.length) return fail(res, 'Usuario no encontrado.', 404);

    await db.transaction(async (client) => {
      await usuarioRepo.updateDatosBasicos(client, id, { nombre, apellido });
      if (grado !== undefined || institucion !== undefined || ciudad !== undefined || telefono !== undefined) {
        await usuarioRepo.createPerfil(client, id, {
          grado:       grado ?? null,
          institucion: institucion ?? null,
          ciudad:      ciudad ?? null,
          telefono:    telefono ?? null,
        });
      }
    });

    const { rows } = await usuarioRepo.getPerfil(id);
    logger.info(`Administrador ${req.user.id_usuario} actualizó al usuario ${id}`);
    return ok(res, 'Usuario actualizado.', rows[0]);
  } catch (err) { next(err); }
};

/** Activar / desactivar cuenta (el SRS lo pide explícitamente en RF-03). */
const cambiarEstado = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { activo } = req.body;

    if (id === req.user.id_usuario && activo === false) {
      return fail(res, 'No puedes desactivar tu propia cuenta de administrador.', 400);
    }

    const { rows } = await usuarioRepo.setActivo(id, activo);
    if (!rows.length) return fail(res, 'Usuario no encontrado.', 404);

    // Al desactivar, cerramos cualquier sesión abierta de esa persona.
    if (activo === false) await usuarioRepo.closeSessions(id);

    logger.info(`Administrador ${req.user.id_usuario} ${activo ? 'activó' : 'desactivó'} al usuario ${id}`);
    return ok(res, activo ? 'Cuenta activada.' : 'Cuenta desactivada.', rows[0]);
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (id === req.user.id_usuario) {
      return fail(res, 'No puedes eliminar tu propia cuenta.', 400);
    }

    try {
      const { rows } = await usuarioRepo.eliminar(id);
      if (!rows.length) return fail(res, 'Usuario no encontrado.', 404);
      logger.warn(`Administrador ${req.user.id_usuario} eliminó al usuario ${id} (${rows[0].email})`);
      return ok(res, 'Usuario eliminado.', rows[0]);
    } catch (err) {
      // 23503 = violación de clave foránea: el usuario tiene historial.
      if (err.code === '23503') {
        return fail(
          res,
          'Este usuario tiene historial de simulacros y no puede eliminarse sin perder esos datos. Desactiva la cuenta en su lugar.',
          409
        );
      }
      throw err;
    }
  } catch (err) { next(err); }
};

module.exports = { getPerfil, updatePerfil, listar, detalle, actualizar, cambiarEstado, eliminar };
