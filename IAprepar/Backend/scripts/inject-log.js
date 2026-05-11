require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');
const pool = new Pool({
  host:     process.env.PGHOST     || 'localhost',
  port:     parseInt(process.env.PGPORT || '5432', 10),
  database: process.env.PGDATABASE || 'PreparIA',
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
});

const sql = `
CREATE TABLE IF NOT EXISTS ia_log (
  id              SERIAL PRIMARY KEY,
  id_usuario      INTEGER REFERENCES usuario(id),
  accion          VARCHAR(50) NOT NULL,
  id_materia      INTEGER REFERENCES materia(id),
  id_nodo         INTEGER REFERENCES nodo_aprendizaje(id),
  dificultad      VARCHAR(20),
  cantidad_pedida INTEGER,
  cantidad_exitosa INTEGER,
  tokens_usados   INTEGER,
  duracion_ms     INTEGER,
  exitoso         BOOLEAN DEFAULT true,
  error_mensaje   TEXT,
  creado_en       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_log_usuario ON ia_log(id_usuario);
CREATE INDEX IF NOT EXISTS idx_ia_log_creado  ON ia_log(creado_en);
`;

pool.query(sql)
  .then(() => { console.log('Tabla ia_log creada con éxito.'); pool.end(); })
  .catch((err) => { console.error('Error:', err); pool.end(); });
