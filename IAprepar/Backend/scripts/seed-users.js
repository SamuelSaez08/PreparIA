const authService = require('./src/services/auth.service');
const { pool } = require('./src/config/db');

async function seed() {
  try {
    console.log('Registering demo user...');
    await authService.register({
      nombre: 'Estudiante',
      apellido: 'Demo',
      email: 'demo@preparia.co',
      password: 'Demo2025!',
      id_rol: 2
    });
    
    console.log('Registering admin user...');
    await authService.register({
      nombre: 'Administrador',
      apellido: 'Principal',
      email: 'admin@preparia.co',
      password: 'Admin2025!',
      id_rol: 1
    });

    console.log('Seed completed.');
  } catch (err) {
    if (err.statusCode !== 409) {
      console.error(err);
    } else {
      console.log('Users already exist.');
    }
  } finally {
    pool.end();
  }
}
seed();
