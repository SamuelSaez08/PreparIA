'use strict';
require('dotenv').config();
const progresoRepo = require('../src/repositories/progreso.repo');

async function testProgresoController() {
  try {
    const idUsuario = 3; // samueldario@correo.com
    console.log(`Testing progreso query for user id=${idUsuario}...`);

    const [
      { rows: statsRows },
      { rows: materiaRows },
      { rows: actividadRows },
    ] = await Promise.all([
      progresoRepo.getStatsGlobales(idUsuario),
      progresoRepo.getProgresoMaterias(idUsuario),
      progresoRepo.getActividad30d(idUsuario),
    ]);

    console.log('statsRows:', statsRows);
    console.log('materiaRows:', materiaRows);
    console.log('actividadRows:', actividadRows);

    const actividad_semanal = actividadRows.map(r => {
      if (r.fecha instanceof Date) return r.fecha.toISOString().split('T')[0];
      return String(r.fecha);
    });
    console.log('actividad_semanal parsed:', actividad_semanal);

    const stats = statsRows[0] || {};
    const total_intentos = parseInt(stats.total_intentos || 0, 10);
    const promedio_global = parseFloat(stats.promedio_global || 0);
    const mejor_puntaje = parseFloat(stats.mejor_puntaje || 0);

    console.log('Success! Formatted result:', {
      total_intentos,
      promedio_global,
      mejor_puntaje
    });

  } catch (err) {
    console.error('CRASH IN PROGRESO CONTROLLER:', err);
  }
}

testProgresoController();
