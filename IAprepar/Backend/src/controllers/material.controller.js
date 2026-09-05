'use strict';

/**
 * RF-04 — Carga, edición y retiro de material de estudio.
 * Caso de uso 4.8 "Gestionar contenidos".
 */

const logger = require('../utils/logger');
const materialRepo = require('../repositories/material.repo');
const { ok, created, fail } = require('../utils/response');

const listar = async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit || '50', 10), 100);
    const offset = parseInt(req.query.offset || '0', 10);
    const idNodo = req.query.nodo ? parseInt(req.query.nodo, 10) : null;

    const [{ rows }, { rows: totalRows }] = await Promise.all([
      materialRepo.listar({ idNodo, limit, offset }),
      materialRepo.contar({ idNodo }),
    ]);

    return ok(res, 'Material obtenido.', rows, { total: totalRows[0].total, limit, offset });
  } catch (err) { next(err); }
};

const detalle = async (req, res, next) => {
  try {
    const { rows } = await materialRepo.findById(req.params.id);
    if (!rows.length) return fail(res, 'Material no encontrado.', 404);
    return ok(res, 'Material obtenido.', rows[0]);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const { id_nodo, titulo, contenido, tipo, url, orden } = req.body;

    const { rows } = await materialRepo.insertar({
      idNodo:    id_nodo,
      titulo:    titulo.trim(),
      contenido,
      tipo,
      url,
      orden,
      creadoPor: req.user.id_usuario,
    });

    logger.info(`Material ${rows[0].id} creado por el administrador ${req.user.id_usuario}`);
    return created(res, 'Material creado.', rows[0]);
  } catch (err) {
    if (err.code === '23503') return fail(res, 'El nodo indicado no existe.', 400);
    next(err);
  }
};

const editar = async (req, res, next) => {
  try {
    const { titulo, contenido, tipo, url, orden } = req.body;
    const { rows } = await materialRepo.actualizar(req.params.id, { titulo, contenido, tipo, url, orden });
    if (!rows.length) return fail(res, 'Material no encontrado.', 404);

    logger.info(`Material ${req.params.id} editado por el administrador ${req.user.id_usuario}`);
    return ok(res, 'Material actualizado.', rows[0]);
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    const { rows } = await materialRepo.desactivar(req.params.id);
    if (!rows.length) return fail(res, 'Material no encontrado.', 404);

    logger.info(`Material ${req.params.id} retirado por el administrador ${req.user.id_usuario}`);
    return ok(res, 'Material retirado.', rows[0]);
  } catch (err) { next(err); }
};

module.exports = { listar, detalle, crear, editar, eliminar };
