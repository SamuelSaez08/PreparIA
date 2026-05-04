'use strict';

const simulacroRepo = require('../repositories/simulacro.repo');
const { ok, fail }  = require('../utils/response');

const getSimulacros = async (req, res, next) => {
  try {
    const { materia } = req.query;
    const { rows } = await simulacroRepo.findAll({ materia });
    return ok(res, 'Simulacros obtenidos.', rows);
  } catch (err) { next(err); }
};

const getSimulacro = async (req, res, next) => {
  try {
    const { rows } = await simulacroRepo.findById(req.params.id);
    if (!rows.length) return fail(res, 'Simulacro no encontrado.', 404);
    return ok(res, 'Simulacro obtenido.', rows[0]);
  } catch (err) { next(err); }
};

module.exports = { getSimulacros, getSimulacro };
