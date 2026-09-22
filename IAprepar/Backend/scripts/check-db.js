'use strict';
require('dotenv').config();

const { pool } = require('../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// La contrasena NO se escribe en el codigo: llega por argumento o por variable
// de entorno. Un script versionado con una contrasena dentro es una credencial
// publicada.
const pedirPassword = (variable) => {
  const valor = process.argv[3] || process.env[variable];
  if (!valor) {
    console.error(`Falta la contrasena. Uso: node ${process.argv[1]} <email> <password>`);
    console.error(`O define la variable de entorno ${variable}.`);
    process.exit(1);
  }
  return valor;
};

async function testEndpoints() {
  try {
    // 1. Login to get token
    const email = process.argv[2] || process.env.TEST_EMAIL || 'admin@preparia.co';
    const password = pedirPassword('TEST_PASSWORD');
    
    const { rows } = await pool.query(
      'SELECT u.id, u.nombre, u.email, u.password_hash, u.activo, r.nombre AS rol FROM usuario u JOIN rol r ON r.id = u.id_rol WHERE u.email = $1',
      [email]
    );
    
    if (!rows.length) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    const user = rows[0];
    console.log(`✅ Usuario: ${user.nombre} (${user.email}), rol=${user.rol}, activo=${user.activo}`);
    
    const match = await bcrypt.compare(password, user.password_hash);
    console.log(`🔑 Password match: ${match}`);

    // 2. Check nodos/arbol/1
    const { rows: nodos } = await pool.query(
      `SELECT n.id, n.nombre, n.id_padre, n.id_materia, n.nivel_profundidad
       FROM nodo n WHERE n.id_materia = 1 ORDER BY n.nivel_profundidad, n.nombre`
    );
    console.log(`\n📚 Nodos de materia 1 (Ciencias Sociales): ${nodos.length} nodos`);
    nodos.forEach(n => console.log(`   id=${n.id} | padre=${n.id_padre || 'raíz'} | nivel=${n.nivel_profundidad} | ${n.nombre}`));

    // 3. Check materias table
    const { rows: materias } = await pool.query('SELECT * FROM materia ORDER BY id');
    console.log(`\n📋 Materias en BD: ${materias.length}`);
    materias.forEach(m => console.log(`   id=${m.id} | ${m.nombre}`));

    // 4. Check simulacros
    const { rows: simulacros } = await pool.query('SELECT id, titulo, id_materia, activo FROM simulacro ORDER BY id LIMIT 10');
    console.log(`\n🎯 Simulacros en BD: ${simulacros.length}`);
    simulacros.forEach(s => console.log(`   id=${s.id} | ${s.titulo} | materia=${s.id_materia} | activo=${s.activo}`));

    // 5. Check preguntas
    const { rows: preguntas } = await pool.query('SELECT COUNT(*) as total FROM pregunta');
    console.log(`\n❓ Total preguntas: ${preguntas[0].total}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

testEndpoints();
