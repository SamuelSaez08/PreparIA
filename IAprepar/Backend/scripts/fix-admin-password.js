'use strict';

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { pool } = require('../src/config/db');

async function fixAdminPassword() {
  try {
    const email = 'admin@preparia.co';
    const plainPassword = 'Admin2025!';
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

    // 1. Verificar si el usuario existe
    const { rows } = await pool.query(
      'SELECT id, email, password_hash FROM usuario WHERE email = $1',
      [email]
    );

    if (!rows.length) {
      console.log(`❌ Usuario "${email}" no encontrado en la base de datos.`);
      console.log('   Creando usuario admin...');

      const hash = await bcrypt.hash(plainPassword, saltRounds);
      await pool.query(
        `INSERT INTO usuario (nombre, apellido, email, password_hash, id_rol, activo, creado_en)
         VALUES ($1, $2, $3, $4, $5, true, NOW())`,
        ['Administrador', 'Principal', email, hash, 1]
      );
      console.log('✅ Usuario admin creado correctamente.');
    } else {
      const user = rows[0];
      console.log(`👤 Usuario encontrado: id=${user.id}, email=${user.email}`);
      console.log(`   Hash actual: ${user.password_hash ? user.password_hash.substring(0, 20) + '...' : '(vacío)'}`);

      // Probar si la contraseña actual funciona
      const currentMatch = await bcrypt.compare(plainPassword, user.password_hash || '');
      if (currentMatch) {
        console.log('✅ La contraseña ya es correcta. No se requiere actualización.');
        return;
      }

      console.log('❌ La contraseña NO coincide. Actualizando hash...');
      const newHash = await bcrypt.hash(plainPassword, saltRounds);
      await pool.query(
        'UPDATE usuario SET password_hash = $1 WHERE id = $2',
        [newHash, user.id]
      );
      console.log('✅ Contraseña actualizada correctamente.');
    }

    // Verificación final
    const { rows: verify } = await pool.query(
      'SELECT id, password_hash FROM usuario WHERE email = $1',
      [email]
    );
    const finalMatch = await bcrypt.compare(plainPassword, verify[0].password_hash);
    console.log(`\n🔑 Verificación final: bcrypt.compare("${plainPassword}") = ${finalMatch}`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

fixAdminPassword();
