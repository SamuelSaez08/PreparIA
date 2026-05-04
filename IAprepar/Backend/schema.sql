-- ============================================================
--  PreparIA — Schema PostgreSQL
--  Base de datos: PreparIA
--  Normalización: 3FN
-- ============================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── ENUMS ────────────────────────────────────────────────────────────────────
CREATE TYPE dificultad_enum AS ENUM ('facil', 'media', 'dificil');
CREATE TYPE tipo_pregunta_enum AS ENUM ('seleccion_multiple', 'verdadero_falso', 'completar');
CREATE TYPE tipo_material_enum AS ENUM ('texto', 'video', 'pdf', 'imagen', 'enlace', 'ejercicio');
CREATE TYPE estado_intento_enum AS ENUM ('en_curso', 'completado', 'abandonado');
CREATE TYPE estado_examen_enum  AS ENUM ('en_curso', 'completado');
CREATE TYPE tipo_reporte_enum   AS ENUM ('progreso_general', 'por_materia', 'simulacros', 'usuarios_activos');

-- ── TABLAS BASE ───────────────────────────────────────────────────────────────

CREATE TABLE rol (
    id      SERIAL PRIMARY KEY,
    nombre  VARCHAR(50) UNIQUE NOT NULL,
    descripcion TEXT
);

INSERT INTO rol (nombre, descripcion) VALUES
    ('admin',      'Administrador con acceso total'),
    ('estudiante', 'Estudiante con acceso a contenido y simulacros');

CREATE TABLE usuario (
    id             SERIAL PRIMARY KEY,
    nombre         VARCHAR(100) NOT NULL,
    apellido       VARCHAR(100) NOT NULL,
    email          VARCHAR(150) UNIQUE NOT NULL,
    password_hash  TEXT NOT NULL,
    id_rol         INTEGER NOT NULL REFERENCES rol(id) DEFAULT 2,
    activo         BOOLEAN NOT NULL DEFAULT true,
    creado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuario_email  ON usuario(email);
CREATE INDEX idx_usuario_id_rol ON usuario(id_rol);

CREATE TABLE perfil_estudiante (
    id_usuario    INTEGER PRIMARY KEY REFERENCES usuario(id) ON DELETE CASCADE,
    grado         VARCHAR(30),
    institucion   VARCHAR(150),
    ciudad        VARCHAR(100),
    foto_url      TEXT,
    creado_en     TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sesion_usuario (
    id          SERIAL PRIMARY KEY,
    id_usuario  INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64),
    ip          VARCHAR(45),
    user_agent  TEXT,
    activa      BOOLEAN NOT NULL DEFAULT true,
    iniciada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expira_en   TIMESTAMPTZ,
    cerrada_en  TIMESTAMPTZ
);

CREATE INDEX idx_sesion_usuario     ON sesion_usuario(id_usuario);
CREATE INDEX idx_sesion_activa      ON sesion_usuario(id_usuario, activa);

-- ── CATÁLOGOS ─────────────────────────────────────────────────────────────────

CREATE TABLE nivel (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(50) NOT NULL,
    descripcion TEXT,
    orden       INTEGER NOT NULL DEFAULT 1
);

INSERT INTO nivel (nombre, descripcion, orden) VALUES
    ('Básico',    'Conceptos fundamentales',     1),
    ('Intermedio','Comprensión y aplicación',     2),
    ('Avanzado',  'Análisis y síntesis complejos',3);

CREATE TABLE materia (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    icono       VARCHAR(10) DEFAULT '📚',
    activa      BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO materia (nombre, descripcion, icono) VALUES
    ('Ciencias Sociales', 'Historia, Geografía, Política y Economía', '🌍'),
    ('Matemáticas',       'Álgebra, Geometría, Estadística',           '📐'),
    ('Lenguaje',          'Comprensión lectora y escritura',           '📖'),
    ('Ciencias Naturales','Biología, Química, Física',                 '🔬'),
    ('Inglés',            'Comprensión y producción en inglés',        '🇬🇧');

-- ── NODOS DE APRENDIZAJE ──────────────────────────────────────────────────────

CREATE TABLE nodo_aprendizaje (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    descripcion TEXT,
    id_materia  INTEGER NOT NULL REFERENCES materia(id),
    id_nivel    INTEGER REFERENCES nivel(id),
    id_padre    INTEGER REFERENCES nodo_aprendizaje(id),
    orden       INTEGER DEFAULT 0,
    activo      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_nodo_materia ON nodo_aprendizaje(id_materia);
CREATE INDEX idx_nodo_padre   ON nodo_aprendizaje(id_padre);
CREATE INDEX idx_nodo_nivel   ON nodo_aprendizaje(id_nivel);

-- ── MATERIAL DE ESTUDIO ───────────────────────────────────────────────────────

CREATE TABLE material_estudio (
    id             SERIAL PRIMARY KEY,
    id_nodo        INTEGER NOT NULL REFERENCES nodo_aprendizaje(id),
    titulo         VARCHAR(200) NOT NULL,
    tipo           tipo_material_enum NOT NULL DEFAULT 'texto',
    contenido      TEXT NOT NULL,
    url            TEXT,
    orden          INTEGER DEFAULT 0,
    activo         BOOLEAN NOT NULL DEFAULT true,
    creado_por     INTEGER REFERENCES usuario(id),
    creado_en      TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_material_nodo ON material_estudio(id_nodo);

-- ── PREGUNTAS ─────────────────────────────────────────────────────────────────

CREATE TABLE pregunta (
    id             SERIAL PRIMARY KEY,
    id_nodo        INTEGER NOT NULL REFERENCES nodo_aprendizaje(id),
    id_nivel       INTEGER NOT NULL REFERENCES nivel(id),
    enunciado      TEXT NOT NULL,
    dificultad     dificultad_enum NOT NULL DEFAULT 'media',
    tipo           tipo_pregunta_enum NOT NULL DEFAULT 'seleccion_multiple',
    explicacion    TEXT,
    activa         BOOLEAN NOT NULL DEFAULT true,
    creado_por     INTEGER REFERENCES usuario(id),
    creado_en      TIMESTAMPTZ DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ
);

CREATE INDEX idx_pregunta_nodo       ON pregunta(id_nodo);
CREATE INDEX idx_pregunta_nivel      ON pregunta(id_nivel);
CREATE INDEX idx_pregunta_dificultad ON pregunta(dificultad);

CREATE TABLE opcion_respuesta (
    id           SERIAL PRIMARY KEY,
    id_pregunta  INTEGER NOT NULL REFERENCES pregunta(id) ON DELETE CASCADE,
    texto        TEXT NOT NULL,
    letra        CHAR(1) NOT NULL,
    es_correcta  BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (id_pregunta, letra)
);

CREATE INDEX idx_opcion_pregunta ON opcion_respuesta(id_pregunta);

-- ── SIMULACROS ────────────────────────────────────────────────────────────────

CREATE TABLE simulacro (
    id                SERIAL PRIMARY KEY,
    titulo            VARCHAR(200) NOT NULL,
    descripcion       TEXT,
    id_materia        INTEGER NOT NULL REFERENCES materia(id),
    id_nivel          INTEGER REFERENCES nivel(id),
    duracion_minutos  INTEGER NOT NULL DEFAULT 30 CHECK (duracion_minutos > 0),
    activo            BOOLEAN NOT NULL DEFAULT true,
    creado_por        INTEGER REFERENCES usuario(id),
    creado_en         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_simulacro_materia ON simulacro(id_materia);

CREATE TABLE simulacro_pregunta (
    id            SERIAL PRIMARY KEY,
    id_simulacro  INTEGER NOT NULL REFERENCES simulacro(id) ON DELETE CASCADE,
    id_pregunta   INTEGER NOT NULL REFERENCES pregunta(id),
    orden         INTEGER NOT NULL DEFAULT 1,
    UNIQUE (id_simulacro, id_pregunta)
);

CREATE INDEX idx_sp_simulacro ON simulacro_pregunta(id_simulacro);

-- ── INTENTOS ──────────────────────────────────────────────────────────────────

CREATE TABLE intento_simulacro (
    id               SERIAL PRIMARY KEY,
    id_usuario       INTEGER NOT NULL REFERENCES usuario(id),
    id_simulacro     INTEGER NOT NULL REFERENCES simulacro(id),
    estado           estado_intento_enum NOT NULL DEFAULT 'en_curso',
    puntaje_obtenido INTEGER CHECK (puntaje_obtenido >= 0 AND puntaje_obtenido <= 100),
    correctas        INTEGER DEFAULT 0,
    incorrectas      INTEGER DEFAULT 0,
    total_preguntas  INTEGER NOT NULL DEFAULT 0,
    iniciado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalizado_en    TIMESTAMPTZ,
    expira_en        TIMESTAMPTZ
);

CREATE INDEX idx_intento_usuario   ON intento_simulacro(id_usuario);
CREATE INDEX idx_intento_simulacro ON intento_simulacro(id_simulacro);
CREATE INDEX idx_intento_estado    ON intento_simulacro(estado);

CREATE TABLE respuesta_intento (
    id                 SERIAL PRIMARY KEY,
    id_intento         INTEGER NOT NULL REFERENCES intento_simulacro(id) ON DELETE CASCADE,
    id_pregunta        INTEGER NOT NULL REFERENCES pregunta(id),
    id_opcion_elegida  INTEGER NOT NULL REFERENCES opcion_respuesta(id),
    es_correcta        BOOLEAN NOT NULL,
    respondida_en      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (id_intento, id_pregunta)
);

CREATE INDEX idx_respuesta_intento  ON respuesta_intento(id_intento);

-- ── PROGRESO ──────────────────────────────────────────────────────────────────

CREATE TABLE progreso_estudiante (
    id_usuario              INTEGER NOT NULL REFERENCES usuario(id),
    id_materia              INTEGER NOT NULL REFERENCES materia(id),
    simulacros_completados  INTEGER DEFAULT 0,
    total_correctas         INTEGER DEFAULT 0,
    total_preguntas         INTEGER DEFAULT 0,
    puntaje_promedio        NUMERIC(5,2) DEFAULT 0,
    ultimo_simulacro_en     TIMESTAMPTZ,
    actualizado_en          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id_usuario, id_materia)
);

CREATE INDEX idx_progreso_usuario ON progreso_estudiante(id_usuario);

-- ── EXAMEN DE NIVEL ───────────────────────────────────────────────────────────

CREATE TABLE examen_nivel (
    id                SERIAL PRIMARY KEY,
    id_usuario        INTEGER NOT NULL REFERENCES usuario(id),
    id_materia        INTEGER NOT NULL REFERENCES materia(id),
    id_nivel_asignado INTEGER REFERENCES nivel(id),
    estado            estado_examen_enum NOT NULL DEFAULT 'en_curso',
    puntaje           INTEGER,
    creado_en         TIMESTAMPTZ DEFAULT NOW(),
    finalizado_en     TIMESTAMPTZ
);

CREATE INDEX idx_examen_usuario ON examen_nivel(id_usuario);

CREATE TABLE resultado_examen_nivel (
    id                 SERIAL PRIMARY KEY,
    id_examen          INTEGER NOT NULL REFERENCES examen_nivel(id) ON DELETE CASCADE,
    id_pregunta        INTEGER NOT NULL REFERENCES pregunta(id),
    id_opcion_elegida  INTEGER REFERENCES opcion_respuesta(id),
    es_correcta        BOOLEAN,
    orden              INTEGER NOT NULL DEFAULT 1,
    respondida_en      TIMESTAMPTZ,
    UNIQUE (id_examen, id_pregunta)
);

-- ── REPORTES ──────────────────────────────────────────────────────────────────

CREATE TABLE reporte (
    id           SERIAL PRIMARY KEY,
    id_usuario   INTEGER NOT NULL REFERENCES usuario(id),
    tipo         tipo_reporte_enum NOT NULL,
    descripcion  TEXT,
    fecha_inicio DATE,
    fecha_fin    DATE,
    datos_json   JSONB,
    creado_en    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reporte_tipo ON reporte(tipo);

-- ── VISTA DE PROGRESO ─────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW v_progreso_estudiante AS
SELECT
    u.id                                   AS id_usuario,
    u.nombre || ' ' || u.apellido          AS estudiante,
    m.nombre                               AS materia,
    pe.simulacros_completados,
    pe.puntaje_promedio,
    pe.ultimo_simulacro_en,
    CASE
        WHEN pe.puntaje_promedio >= 80 THEN 'Excelente'
        WHEN pe.puntaje_promedio >= 60 THEN 'Bueno'
        WHEN pe.puntaje_promedio >= 40 THEN 'Regular'
        ELSE 'Necesita mejorar'
    END AS categoria_rendimiento
FROM progreso_estudiante pe
JOIN usuario u ON u.id = pe.id_usuario
JOIN materia m ON m.id = pe.id_materia;
