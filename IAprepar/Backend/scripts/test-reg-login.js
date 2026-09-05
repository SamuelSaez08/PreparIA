'use strict';
require('dotenv').config();

const authService = require('../src/services/auth.service');
const { pool } = require('../src/config/db');

async function testRegisterAndLogin() {
  const testEmail = `test_${Date.now()}@preparia.co`;
  const testPassword = 'Password123!';

  try {
    console.log(`1. Registrando nuevo usuario de prueba: ${testEmail}...`);
    const regResult = await authService.register({
      nombre: 'Test',
      apellido: 'User',
      email: testEmail,
      password: testPassword,
      id_rol: 2
    });
    console.log('✅ Registro exitoso:', regResult.usuario);

    console.log(`2. Intentando iniciar sesión con ${testEmail}...`);
    const loginResult = await authService.login({
      email: testEmail,
      password: testPassword,
      ip: '127.0.0.1',
      userAgent: 'TestScript'
    });
    console.log('✅ Login exitoso:', loginResult.usuario);

    // Limpiar usuario de prueba
    await pool.query('DELETE FROM usuario WHERE email = $1', [testEmail]);
    console.log('🧹 Usuario de prueba eliminado de la BD.');

  } catch (err) {
    console.error('❌ ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

testRegisterAndLogin();
