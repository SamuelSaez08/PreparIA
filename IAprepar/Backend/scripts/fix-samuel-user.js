'use strict';
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function fixSamuelUser() {
  try {
    const email = 'samueldario@correo.com';
    const newPassword = 'Samuel2025!'; // Contraseña clara conocida
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

    console.log(`✅ Contraseña de ${email} actualizada exitosamente a: ${newPassword}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixSamuelUser();
