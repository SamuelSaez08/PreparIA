'use strict';

const examenService = require('../services/examenNivel.service');
const { ok, fail } = require('../utils/response');

/** GET /api/v1/examen-nivel?materia=1 */
const obtener = async (req, res, next) => {
  try {
    const idMateria = parseInt(req.query.materia, 10);
    const resultado = await examenService.obtenerOCrear(req.user.id_usuario, idMateria);

    return ok(
      res,
      resultado.reanudado ? 'Examen en curso recuperado.' : 'Examen de nivel generado.',
      resultado
    );
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

/** POST /api/v1/examen-nivel/responder */
const responder = async (req, res, next) => {
  try {
    const { id_examen, respuestas } = req.body;
    const resultado = await examenService.responder(req.user.id_usuario, parseInt(id_examen, 10), respuestas);
    return ok(res, 'Examen calificado.', resultado);
  } catch (err) {
    if (err.statusCode) return fail(res, err.message, err.statusCode);
    next(err);
  }
};

/** GET /api/v1/examen-nivel/resultado?materia=1 */
const ultimoResultado = async (req, res, next) => {
  try {
    const idMateria = parseInt(req.query.materia, 10);
    const resultado = await examenService.ultimoResultado(req.user.id_usuario, idMateria);
    return ok(res, resultado ? 'Último resultado obtenido.' : 'Aún no has presentado el examen de nivel.', resultado);
  } catch (err) { next(err); }
};

module.exports = { obtener, responder, ultimoResultado };
