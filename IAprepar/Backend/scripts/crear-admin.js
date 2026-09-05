#!/usr/bin/env node
'use strict';

/**
 * Crea (o promueve) una cuenta de administrador.
 *
 *   npm run admin -- correo@ejemplo.com "MiClaveSegura123" "Nombre" "Apellido"
 *
 * Si el correo ya existe, solo lo asciende a administrador y, si se envía
 * contraseña, la actualiza. Pensado para que el docente pueda entrar al panel
 * de administración recién instalado el proyecto.
 */

require('dotenv').config();
require('../src/config/env');

const bcrypt = require('bcryptjs');
const db = require('../src/config/db');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

const [, , emailArg, passwordArg, nombreArg, apellidoArg] = process.argv;

const email    = (emailArg    || process.env.ADMIN_EMAIL    || '').toLowerCase().trim();
const password =  passwordArg || process.env.ADMIN_PASSWORD || '';
const nombre   =  nombreArg   || 'Administrador';
const apellido =  apellidoArg || 'PreparIA';

const salir = (mensaje, codigo = 1) => {
  console.error(`\n${mensaje}\n`);
  process.exit(codigo);
};

(async () => {
  if (!email)                salir('Falta el correo.\n\nUso: npm run admin -- correo@ejemplo.com "ClaveSegura123"');
  if (!password)             salir('Falta la contraseña.\n\nUso: npm run admin -- correo@ejemplo.com "ClaveSegura123"');
  if (password.length < 8)   salir('La contraseña debe tener al menos 8 caracteres.');

  const conectado = await db.testConnection();
  if (!conectado) salir('No se pudo conectar a la base de datos. Revisa el archivo .env');

  try {
    const { rows: rolRows } = await db.query("SELECT id FROM rol WHERE nombre = 'admin'");
    if (!rolRows.length) {
      salir("No existe el rol 'admin'. Ejecuta primero: psql -f schema.sql  y luego  npm run migrate");
    }
    const idRolAdmin = rolRows[0].id;

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows: existe } = await db.query('SELECT id FROM usuario WHERE email = $1', [email]);

    if (existe.length) {
      await db.query(
        'UPDATE usuario SET id_rol = $2, password_hash = $3, activo = true WHERE id = $1',
        [existe[0].id, idRolAdmin, hash]
      );
      console.log(`\n✅ La cuenta ${email} ahora es administradora y su contraseña fue actualizada.\n`);
    } else {
      const { rows } = await db.query(
        `INSERT INTO usuario (nombre, apellido, email, password_hash, id_rol, activo, creado_en)
         VALUES ($1,$2,$3,$4,$5,true,NOW()) RETURNING id`,
        [nombre, apellido, email, hash, idRolAdmin]
      );
      console.log(`\n✅ Administrador creado (id=${rows[0].id}): ${email}\n`);
    }

    console.log('   Entra en el panel con esas credenciales: Frontend/admin.html\n');
  } catch (err) {
    salir(`Error: ${err.message}`);
  } finally {
    await db.pool.end();
  }
})();
