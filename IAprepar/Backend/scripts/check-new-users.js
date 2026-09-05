'use strict';
require('dotenv').config();
const { pool } = require('../src/config/db');

async function inspectNewestUsers() {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, apellido, email, password_hash, id_rol, activo, creado_en 
       FROM usuario 
       ORDER BY id DESC 
       LIMIT 10`
    );

    console.log(`📋 Últimos ${rows.length} usuarios registrados en la BD:`);
    rows.forEach(u => {
      console.log(`   - ID ${u.id}: ${u.nombre} ${u.apellido} (${u.email}) | rol=${u.id_rol} | activo=${u.activo} | creado=${u.creado_en}`);
      console.log(`     hash: ${u.password_hash ? u.password_hash.substring(0, 25) + '...' : '(NULO/VACIO)'}`);
    });

  } catch (err) {
    console.error('Error al consultar usuarios:', err.message);
  } finally {
    await pool.end();
  }
}

inspectNewestUsers();
