'use strict';

const { transaction } = require('../config/db');
const nodoRepo  = require('../repositories/nodo.repo');
const { ok, fail }    = require('../utils/response');
const { ROLES }       = require('../utils/constants');

const getArbol = async (req, res, next) => {
  try {
    const { rows } = await nodoRepo.findArbolByMateria(req.params.idMateria);

    // Build tree structure
    const nodeMap = {};
    const roots = [];

    rows.forEach(row => {
      nodeMap[row.id] = { ...row, hijos: [] };
    });

    rows.forEach(row => {
      if (row.id_padre) {
        if (nodeMap[row.id_padre]) {
          nodeMap[row.id_padre].hijos.push(nodeMap[row.id]);
        }
      } else {
        roots.push(nodeMap[row.id]);
      }
    });

    return ok(res, 'Árbol de nodos obtenido.', roots);
  } catch (err) { next(err); }
};

const getNodo = async (req, res, next) => {
  try {
    const { rows } = await nodoRepo.findById(req.params.id);
    if (!rows.length) return fail(res, 'Nodo no encontrado.', 404);
    return ok(res, 'Nodo obtenido.', rows[0]);
  } catch (err) { next(err); }
};

const getNodos = async (req, res, next) => {
  try {
    const { materia, nivel, padre } = req.query;
    const { rows } = await nodoRepo.findAll({ materia, nivel, padre });
    return ok(res, 'Nodos obtenidos.', rows);
  } catch (err) { next(err); }
};

const getMaterialNodo = async (req, res, next) => {
  try {
    const { rows } = await nodoRepo.findMaterial(req.params.id);
    return ok(res, 'Material obtenido.', rows);
  } catch (err) { next(err); }
};

const crearNodo = async (req, res, next) => {
  try {
    if (req.user && req.user.rol !== ROLES.ADMIN) {
      return fail(res, 'No autorizado para crear nodos.', 403);
    }

    const { id_padre, nombre, icono, contenido } = req.body;
    if (!nombre) return fail(res, 'El nombre es obligatorio', 400);

    const nuevoId = await transaction(async (client) => {
      // Obtener id_materia e id_nivel del padre para heredar
      let id_materia = 1; // Default Ciencias Sociales
      let id_nivel = null;
      if (id_padre && id_padre !== 'hist' && id_padre !== 'root') {
        const padreRes = await nodoRepo.findPadre(client, id_padre);
        if (padreRes.rows.length) {
          id_materia = padreRes.rows[0].id_materia;
          id_nivel   = padreRes.rows[0].id_nivel;
        }
      }

      const idPadreReal = (id_padre && id_padre !== 'hist' && id_padre !== 'root') ? id_padre : null;

      const nodoRes = await nodoRepo.insertNodo(client, {
        nombre,
        icono:     icono || '📌',
        idPadre:   idPadreReal,
        idMateria: id_materia,
        idNivel:   id_nivel,
      });

      const id = nodoRes.rows[0].id;

      if (contenido && contenido.trim() !== '') {
        await nodoRepo.insertMaterial(client, {
          idNodo:    id,
          nombre,
          contenido,
          idUsuario: req.user ? req.user.id : null,
        });
      }

      return id;
    });

    return ok(res, 'Nodo creado exitosamente.', { id: nuevoId });
  } catch (err) { next(err); }
};

const deleteNodo = async (req, res, next) => {
  try {
    if (req.user && req.user.rol !== ROLES.ADMIN) {
      return fail(res, 'No autorizado para eliminar nodos.', 403);
    }

    const { id } = req.params;

    await transaction(async (client) => {
      const { rows: descRows } = await nodoRepo.findDescendientes(client, id);

      if (descRows.length === 0) {
        const err = new Error('Nodo no encontrado.');
        err.statusCode = 404;
        throw err;
      }

      const descIds = descRows.map(r => r.id);

      await nodoRepo.softDeleteMateriales(client, descIds);
      await nodoRepo.softDeleteNodos(client, descIds);
    });

    return ok(res, 'Nodo y todo su contenido eliminado exitosamente.');
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

const updateNombre = async (req, res, next) => {
  try {
    if (req.user && req.user.rol !== ROLES.ADMIN) {
      return fail(res, 'No autorizado para editar nodos.', 403);
    }

    const { id } = req.params;
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return fail(res, 'El nombre no puede estar vacío.', 400);
    }

    const { rows } = await nodoRepo.updateNombre(id, nombre.trim());
    if (!rows.length) return fail(res, 'Nodo no encontrado.', 404);

    return ok(res, 'Nombre actualizado.', rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getArbol, getNodo, getNodos, getMaterialNodo, crearNodo, deleteNodo, updateNombre };
