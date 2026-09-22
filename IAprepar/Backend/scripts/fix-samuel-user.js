'use strict';
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

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

async function fixSamuelUser() {
  try {
    const email = process.argv[2] || process.env.USER_EMAIL;
    const newPassword = pedirPassword('NEW_PASSWORD');
    const saltRounds = 12;

    const { rows } = await pool.query('SELECT id, email, password_hash FROM usuario WHERE email = $1', [email]);
    if (!rows.length) {
      console.log('Usuario no encontrado');
      return;
    }

    const user = rows[0];
    console.log(`Usuario id=${user.id}, email=${user.email}`);
    
    const hash = await bcrypt.hash(newPassword, saltRounds);
    await pool.query('UPDATE usuario SET password_hash = $1 WHERE id = $2', [hash, user.id]);

    console.log(`✅ Contraseña de ${email} actualizada.`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixSamuelUser();
