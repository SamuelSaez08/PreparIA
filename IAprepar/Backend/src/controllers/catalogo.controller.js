'use strict';

const catalogoRepo = require('../repositories/catalogo.repo');
const { ok } = require('../utils/response');

const getMaterias = async (_req, res, next) => {
  try {
    const { rows } = await catalogoRepo.findMaterias();
    return ok(res, 'Materias obtenidas.', rows);
  } catch (err) { next(err); }
};

const getNiveles = async (_req, res, next) => {
  try {
    const { rows } = await catalogoRepo.findNiveles();
    return ok(res, 'Niveles obtenidos.', rows);
  } catch (err) { next(err); }
};

module.exports = { getMaterias, getNiveles };
