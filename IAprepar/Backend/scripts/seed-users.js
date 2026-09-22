const authService = require('./src/services/auth.service');
const { pool } = require('./src/config/db');

// Las contrasenas del seed llegan por variables de entorno, nunca en el codigo:
// SEED_DEMO_PASSWORD y SEED_ADMIN_PASSWORD.
const passDemo  = process.env.SEED_DEMO_PASSWORD;
const passAdmin = process.env.SEED_ADMIN_PASSWORD;
if (!passDemo || !passAdmin) {
  console.error('Define SEED_DEMO_PASSWORD y SEED_ADMIN_PASSWORD antes de ejecutar el seed.');
  process.exit(1);
}


async function seed() {
  try {
    console.log('Registering demo user...');
    await authService.register({
      nombre: 'Estudiante',
      apellido: 'Demo',
      email: 'demo@preparia.co',
      password: passDemo,
      id_rol: 2
    });
    
    console.log('Registering admin user...');
    await authService.register({
      nombre: 'Administrador',
      apellido: 'Principal',
      email: 'admin@preparia.co',
      password: passAdmin,
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
