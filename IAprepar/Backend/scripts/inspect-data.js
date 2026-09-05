'use strict';
require('dotenv').config();
const { pool } = require('../src/config/db');

async function inspectData() {
  try {
    const tables = ['materia', 'nivel', 'nodo_aprendizaje', 'contenido_nodo', 'simulacro', 'pregunta', 'opcion_respuesta'];
    for (const table of tables) {
      const { rows } = await pool.query(`SELECT COUNT(*) as total FROM ${table}`);
      console.log(`📌 Tabla ${table}: ${rows[0].total} registros`);
    }

    const { rows: materias } = await pool.query('SELECT * FROM materia');
    console.log('\n📚 Materias:');
    materias.forEach(m => console.log(`   - ID ${m.id}: ${m.nombre}`));

    const { rows: nodos } = await pool.query('SELECT id, nombre, id_materia, id_padre FROM nodo_aprendizaje LIMIT 10');
    console.log('\n🌱 Primeros 10 nodos:');
    nodos.forEach(n => console.log(`   - ID ${n.id} (materia=${n.id_materia}, padre=${n.id_padre}): ${n.nombre}`));

    const { rows: simulacros } = await pool.query('SELECT id, titulo, id_materia, activo FROM simulacro LIMIT 10');
    console.log('\n🎯 Primeros 10 simulacros:');
    simulacros.forEach(s => console.log(`   - ID ${s.id} (materia=${s.id_materia}, activo=${s.activo}): ${s.titulo}`));

  } catch (err) {
    console.error('Error inspeccionando datos:', err.message);
  } finally {
    await pool.end();
  }
}

inspectData();
