const fs = require('fs');
const { Pool } = require('pg');
const pool = new Pool({
  user: 'prepar_user',
  password: '2005',
  host: 'localhost',
  database: 'PreparIA',
  port: 5432
});

async function run() {
  try {
    const schema = fs.readFileSync('schema.sql', 'utf8');
    
    console.log('Dropping public schema...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO prepar_user; GRANT ALL ON SCHEMA public TO public;');
    
    console.log('Applying schema.sql...');
    await pool.query(schema);

    // Let's also insert a demo user since the user wants to login, just in case they don't register.
    // The schema file already inserts 'admin' and 'estudiante' roles.
    // We'll insert admin@preparia.co and demo@preparia.co directly via the auth service so it hashes correctly.
    console.log('Schema applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
