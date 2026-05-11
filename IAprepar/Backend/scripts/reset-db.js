const fs = require('fs');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'PreparIA',
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
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
