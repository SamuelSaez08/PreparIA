'use strict';
require('dotenv').config();
const { pool } = require('../src/config/db');

async function checkTables() {
  try {
    const { rows } = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log(`📊 Tablas existentes en la BD (${rows.length}):`);
    rows.forEach(r => console.log(`   ✅ ${r.tablename}`));

    // Check what's in schema.sql
    const expectedTables = [
      'rol', 'usuario', 'perfil_estudiante', 'sesion_usuario',
      'materia', 'nivel', 'nodo', 'material_nodo',
      'simulacro', 'pregunta', 'opcion', 'intento', 'respuesta_intento',
      'examen_nivelacion', 'pregunta_examen_nivel', 'respuesta_examen_nivel',
      'logro', 'logro_usuario', 'reporte',
      'user_stats', 'daily_activity', 'streak_shields', 'ranking_snapshots', 'point_transactions'
    ];

    const existing = rows.map(r => r.tablename);
    const missing = expectedTables.filter(t => !existing.includes(t));
    
    if (missing.length) {
      console.log(`\n❌ Tablas FALTANTES (${missing.length}):`);
      missing.forEach(t => console.log(`   ❌ ${t}`));
    } else {
      console.log('\n✅ Todas las tablas esperadas existen.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

checkTables();
