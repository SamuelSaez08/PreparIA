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

/**
 * Dominio por nodo, para pintar la ruta de aprendizaje.
 * Un nodo se considera:
 *   dominado    → 80% o más de aciertos
 *   en progreso → ya respondió algo pero no llega al 80%
 *   disponible  → tiene material o preguntas, aún sin practicar
 *   vacio       → todavía no tiene contenido cargado
 */
const getProgresoNodos = async (req, res, next) => {
  try {
    const idMateria = parseInt(req.query.materia || '1', 10);
    const { rows } = await progresoRepo.getProgresoNodos(req.user.id_usuario, idMateria);

    const nodos = rows.map((n) => {
      const porcentaje = n.respondidas > 0
        ? Math.round((n.correctas / n.respondidas) * 100)
        : 0;

      let estado;
      if (n.preguntas === 0 && n.materiales === 0) estado = 'vacio';
      else if (n.respondidas === 0)               estado = 'disponible';
      else if (porcentaje >= 80)                  estado = 'dominado';
      else                                        estado = 'en_progreso';

      return {
        id: n.id,
        nombre: n.nombre,
        id_padre: n.id_padre,
        preguntas: n.preguntas,
        materiales: n.materiales,
        respondidas: n.respondidas,
        correctas: n.correctas,
        porcentaje,
        estado,
        ultima_practica: n.ultima_practica,
      };
    });

    const conContenido = nodos.filter(n => n.estado !== 'vacio');
    const dominados    = nodos.filter(n => n.estado === 'dominado').length;

    return ok(res, 'Progreso por nodo obtenido.', {
      nodos,
      resumen: {
        total: nodos.length,
        con_contenido: conContenido.length,
        dominados,
        en_progreso: nodos.filter(n => n.estado === 'en_progreso').length,
        porcentaje_ruta: conContenido.length
          ? Math.round((dominados / conContenido.length) * 100)
          : 0,
      },
    });
  } catch (err) { next(err); }
};

module.exports = { getProgreso, getProgresoMateria, getProgresoNodos };
