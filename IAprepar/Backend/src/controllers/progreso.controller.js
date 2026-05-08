'use strict';

const progresoRepo = require('../repositories/progreso.repo');
const { ok, fail } = require('../utils/response');

const getProgreso = async (req, res, next) => {
  try {
    const idUsuario = req.user.id_usuario;

    const [
      { rows: statsRows },
      { rows: materiaRows },
      { rows: actividadRows },
    ] = await Promise.all([
      progresoRepo.getStatsGlobales(idUsuario),
      progresoRepo.getProgresoMaterias(idUsuario),
      progresoRepo.getActividad30d(idUsuario),
    ]);

    const actividad_semanal = actividadRows.map(r => r.fecha.toISOString().split('T')[0]);

    // Calculate streak
    let racha_actual = 0;
    const sorted = [...actividad_semanal].reverse();
    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date();
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (sorted[i] === expectedStr) {
        racha_actual++;
      } else break;
    }

    const stats = statsRows[0];

    return ok(res, 'Progreso obtenido.', {
      estadisticas: {
        total_intentos:  parseInt(stats.total_intentos, 10),
        promedio_global: parseFloat(stats.promedio_global),
        mejor_puntaje:   parseFloat(stats.mejor_puntaje),
      },
      progreso_por_materia: materiaRows,
      racha_actual,
      actividad_semanal,
    });
  } catch (err) { next(err); }
};

const getProgresoMateria = async (req, res, next) => {
  try {
    const { rows } = await progresoRepo.getByMateria(req.user.id_usuario, req.params.id);
    return ok(res, 'Progreso de materia obtenido.', rows[0] || null);
  } catch (err) { next(err); }
};

module.exports = { getProgreso, getProgresoMateria };
