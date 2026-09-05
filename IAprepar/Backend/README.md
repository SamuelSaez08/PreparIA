# PreparIA — Backend API

API REST de la plataforma educativa **PreparIA**, para la preparación del examen de Estado ICFES (Saber 11) en Colombia.

Proyecto de aula — Ingeniería de Software, Universidad de Córdoba.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Base de datos | PostgreSQL 14 o superior (driver `pg`) |
| Migraciones | Knex |
| Autenticación | JWT + bcryptjs + sesiones en base de datos |
| Validación | express-validator |
| Seguridad | helmet, cors, express-rate-limit |
| IA generativa | Google Gemini (`@google/generative-ai`) |
| Logs | Logger propio con colores |

---

## Estructura real del proyecto

```
Backend/
├── server.js                  ← Punto de entrada (arranca Express)
├── start.js                   ← Arranque en producción (migra y luego sirve)
├── knexfile.js                ← Configuración de migraciones y seeds
├── schema.sql                 ← DDL base (tablas, enums, índices, datos iniciales)
├── .env.example               ← Plantilla de variables de entorno
├── migrations/                ← Cambios incrementales del esquema (Knex)
├── seeds/                     ← Datos de prueba
├── scripts/
│   └── crear-admin.js         ← Crea o promueve una cuenta de administrador
└── src/
    ├── app.js                 ← Express: middlewares, CORS, rutas, errores
    ├── config/
    │   ├── dbUrl.js           ← Resuelve la conexión y decide el SSL
    │   ├── db.js              ← Pool de PostgreSQL + helpers query/transaction
    │   ├── env.js             ← Validación de variables de entorno al arrancar
    │   └── gemini.js          ← Cliente de Google Gemini
    ├── controllers/           ← Capa HTTP
    │   ├── auth.controller.js
    │   ├── usuario.controller.js
    │   ├── catalogo.controller.js
    │   ├── nodo.controller.js
    │   ├── material.controller.js
    │   ├── pregunta.controller.js
    │   ├── simulacro.controller.js
    │   ├── intento.controller.js
    │   ├── examenNivel.controller.js
    │   ├── progreso.controller.js
    │   ├── gamificacion.controller.js
    │   ├── reporte.controller.js
    │   └── ia.controller.js
    ├── routes/                ← Definición de rutas (una por módulo)
    ├── services/              ← Lógica de negocio
    ├── repositories/          ← Acceso a datos (SQL parametrizado)
    ├── middlewares/           ← Autenticación, límites de tasa, errores
    ├── jobs/                  ← Tareas programadas (rankings)
    └── utils/                 ← Respuestas, logger, validadores, constantes
```

---

## Puesta en marcha

### 1. Requisitos

- Node.js 18 o superior
- PostgreSQL 14 o superior (o una base de datos en la nube)

### 2. Instalar dependencias

```bash
cd Backend
npm install
```

### 3. Crear la base de datos

```sql
CREATE DATABASE prepardb;
CREATE USER preparia_user WITH PASSWORD 'la_clave_que_elijas';
GRANT ALL PRIVILEGES ON DATABASE prepardb TO preparia_user;
```

Y, conectado ya **dentro** de `prepardb`:

```sql
GRANT ALL ON SCHEMA public TO preparia_user;
```

### 4. Configurar el entorno

```bash
cp .env.example .env      # en Windows: copy .env.example .env
```

Edita `.env`. Como mínimo necesitas los datos de la base de datos y `JWT_SECRET`.
Para generar el secreto:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Cargar el esquema

```bash
psql -U preparia_user -d prepardb -f schema.sql
npm run migrate
```

`schema.sql` crea las tablas base y `npm run migrate` aplica los cambios
posteriores (gamificación, columnas nuevas, tabla `contenido_nodo`).
**Los dos pasos son obligatorios y en ese orden.**

### 6. Crear una cuenta de administrador

```bash
npm run admin -- admin@preparia.co "ClaveSegura123"
```

### 7. Arrancar

```bash
npm run dev     # con recarga automática
npm start       # modo normal
```

La API queda en `http://localhost:3000/api/v1`.
Comprobación rápida: `http://localhost:3000/api/v1/health`.

---

## Scripts disponibles

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca con nodemon (recarga al guardar) |
| `npm run migrate` | Aplica las migraciones pendientes |
| `npm run migrate:rollback` | Deshace la última migración |
| `npm run migrate:status` | Muestra qué migraciones están aplicadas |
| `npm run seed` | Carga datos de prueba |
| `npm run admin -- <correo> <clave>` | Crea o promueve un administrador |

---

## Configuración de la base de datos

`src/config/dbUrl.js` acepta tres formas, en este orden de prioridad:

1. `DATABASE_URL` completa
2. `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`
3. `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`

El SSL **no** es fijo: se desactiva para `localhost` y se activa para
cualquier host remoto. Puedes forzarlo con `DB_SSL=true` o `DB_SSL=false`.
Esto permite usar el mismo código en una instalación local y en Supabase o
Render sin tocar nada.

---

## Endpoints

Base: `/api/v1`

### Autenticación

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/auth/register` | público | Registro de estudiante (RF-02) |
| POST | `/auth/login` | público | Inicio de sesión (RF-01) |
| POST | `/auth/logout` | sesión | Cierre de sesión |
| PUT | `/auth/password` | sesión | Cambio de contraseña |

### Usuarios y perfiles (RF-03)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/usuarios/perfil` | sesión | Perfil propio |
| PUT | `/usuarios/perfil` | sesión | Editar perfil propio |
| GET | `/usuarios` | admin | Listado con búsqueda, filtros y paginación |
| GET | `/usuarios/:id` | admin | Detalle de un usuario |
| PUT | `/usuarios/:id` | admin | Editar un usuario |
| PATCH | `/usuarios/:id/estado` | admin | Activar o desactivar la cuenta |
| DELETE | `/usuarios/:id` | admin | Eliminar la cuenta |
| GET | `/usuarios/:id/stats` | sesión | Estadísticas de gamificación |

### Contenido educativo (RF-04)

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/materias`, `/niveles` | sesión | Catálogo |
| GET | `/nodos`, `/nodos/:id`, `/nodos/arbol/:idMateria` | sesión | Árbol de conocimiento |
| POST/PATCH/DELETE | `/nodos…` | **admin** | Mantenimiento del árbol |
| GET | `/material` | sesión | Material de estudio |
| POST/PUT/DELETE | `/material…` | **admin** | Mantenimiento del material |
| GET/POST/PUT/DELETE | `/preguntas…` | **admin** | Banco de preguntas |

### Simulacros y exámenes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/simulacros`, `/simulacros/:id` | sesión | Simulacros disponibles (RF-05) |
| POST | `/intentos` | sesión | Iniciar un intento cronometrado |
| POST | `/intentos/:id/responder` | sesión | Responder una pregunta |
| POST | `/intentos/:id/finalizar` | sesión | Calificar y retroalimentar |
| GET | `/examen-nivel?materia=` | sesión | Examen estático de nivelación (RF-06) |
| POST | `/examen-nivel/responder` | sesión | Calificar el examen de nivel |
| GET | `/examen-nivel/resultado?materia=` | sesión | Último nivel asignado |

### Progreso y reportes

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/progreso` | sesión | Estadísticas del estudiante (RF-07) |
| GET | `/progreso/materia/:id` | sesión | Progreso en una materia |
| GET | `/ranking` | sesión | Tabla de posiciones |
| GET | `/reportes?tipo=&desde=&hasta=&formato=` | **admin** | Reporte global (JSON o CSV) |
| GET | `/reportes/historial` | **admin** | Reportes generados |

### Inteligencia artificial

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/ia/estado` | sesión |
| POST | `/ia/generar-preguntas` | sesión |
| POST | `/ia/generar-simulacro` | sesión |
| POST | `/ia/mejorar-pregunta/:id` | admin |

---

## Formato de las respuestas

```json
{
  "ok": true,
  "mensaje": "Descripción de lo ocurrido",
  "datos": { },
  "meta": { "total": 120, "limit": 25, "offset": 0 }
}
```

Y ante un error:

```json
{
  "ok": false,
  "mensaje": "Qué salió mal",
  "errores": [ ]
}
```

---

## Seguridad implementada

- Contraseñas con **bcrypt** (12 rondas configurables)
- **JWT** firmado, con sesión espejo en la tabla `sesion_usuario`
- **Cierre de sesión por inactividad** a los 30 minutos (`SESSION_IDLE_MINUTES`)
- Rutas de escritura de contenido restringidas por **rol de administrador**
- **SQL parametrizado** en el 100% de las consultas (sin concatenación)
- **helmet** para cabeceras de seguridad y **CORS** con lista de orígenes
- **Límite de peticiones**: 100 cada 15 min en general, 20 en `/auth`
- Validación de entrada en cliente **y** servidor

---

## Solución de problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `[env] No se puede arrancar` | Falta configuración en `.env` | El mensaje dice exactamente qué falta |
| `The server does not support SSL connections` | SSL activado contra un PostgreSQL local | Añade `DB_SSL=false` |
| `no pg_hba.conf entry … SSL off` | El servidor exige SSL | Añade `DB_SSL=true` |
| `password authentication failed` | Usuario o clave incorrectos | Revisa `DB_USER` y `DB_PASSWORD` |
| `ECONNREFUSED` | PostgreSQL apagado o puerto equivocado | Inicia el servicio y revisa `DB_PORT` |
| `relation "contenido_nodo" does not exist` | Faltan las migraciones | Ejecuta `npm run migrate` |
| La IA responde con error | Falta `GEMINI_API_KEY` | Consíguela en <https://aistudio.google.com/apikey> |
| El frontend no llega a la API | Puerto distinto | `PORT` debe coincidir con `Frontend/js/config.js` |

---

## Equipo

Manuel Esteban Díaz Restán · Samuel Darío Sáez González · Johan Andrés Parra Torres · Gabriel Esteban Arboleda Caballero

Universidad de Córdoba — Facultad de Ingeniería — Programa de Ingeniería de Sistemas
