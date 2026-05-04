# PreparIA — Backend API

Backend REST para la plataforma educativa **PreparIA**, especializada en la preparación del examen nacional ICFES de Colombia.

---

## 🛠️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Base de datos | PostgreSQL 14+ (pg) |
| Autenticación | JWT + bcryptjs |
| Validación | express-validator |
| Seguridad | helmet, cors, rate limiter |
| Logs | Logger propio (colored + JSON) |

---

## 📁 Estructura del proyecto

```
preparia-backend/
├── server.js               ← Punto de entrada (levanta el servidor)
├── .env                    ← Variables de entorno
├── .env.example            ← Plantilla de variables
├── package.json
├── database/
│   ├── schema.sql          ← DDL completo (tablas, índices, enums, vista)
│   └── seed.sql            ← Datos iniciales (admin, demo, preguntas)
└── src/
    ├── app.js              ← Configuración Express (middlewares, rutas)
    ├── config/
    │   └── db.js           ← Pool PostgreSQL + helpers query/transaction
    ├── controllers/        ← Lógica HTTP por módulo
    │   ├── auth.controller.js
    │   ├── usuario.controller.js
    │   ├── materia.controller.js
    │   ├── nodo.controller.js
    │   ├── material.controller.js
    │   ├── pregunta.controller.js
    │   ├── simulacro.controller.js
    │   ├── progreso.controller.js
    │   ├── examenNivel.controller.js
    │   └── reporte.controller.js
    ├── routes/             ← Definición de rutas Express
    │   ├── index.js        ← Router raíz → /api/v1
    │   ├── auth.routes.js
    │   ├── usuario.routes.js
    │   ├── materia.routes.js
    │   ├── nivel.routes.js
    │   ├── nodo.routes.js
    │   ├── material.routes.js
    │   ├── pregunta.routes.js
    │   ├── simulacro.routes.js
    │   ├── intento.routes.js
    │   ├── progreso.routes.js
    │   ├── examenNivel.routes.js
    │   └── reporte.routes.js
    ├── middlewares/
    │   ├── auth.middleware.js        ← JWT authenticate + authorize por rol
    │   ├── error.middleware.js       ← Handler centralizado de errores
    │   └── rateLimiter.middleware.js ← Rate limiting global y de auth
    ├── services/
    │   ├── auth.service.js           ← Registro, login, logout, sesiones
    │   ├── simulacro.service.js      ← Iniciar, responder, finalizar intento
    │   └── examenNivel.service.js    ← Examen diagnóstico de nivel
    └── utils/
        ├── logger.js       ← Logger con niveles y colores
        ├── response.js     ← Respuestas JSON estandarizadas
        └── validators.js   ← Reglas express-validator reutilizables
```

---

## ⚡ Instalación rápida

### 1. Requisitos previos

- Node.js ≥ 18
- PostgreSQL 14+ corriendo en `localhost:5432`
- Base de datos `PreparIA` creada en pgAdmin4

### 2. Crear la base de datos

```sql
-- En pgAdmin4 o psql:
CREATE DATABASE "PreparIA";
CREATE USER prepar_user WITH PASSWORD '2005';
GRANT ALL PRIVILEGES ON DATABASE "PreparIA" TO prepar_user;
```

### 3. Ejecutar el schema y seed

```bash
psql -U prepar_user -d PreparIA -f database/schema.sql
psql -U prepar_user -d PreparIA -f database/seed.sql
```

### 4. Instalar dependencias

```bash
npm install
```

### 5. Configurar variables de entorno

El archivo `.env` ya está preconfigurado para desarrollo local. Ajusta si es necesario:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=PreparIA
PGUSER=prepar_user
PGPASSWORD=2005
JWT_SECRET=preparia_super_secret_key_cambiar_en_produccion
```

### 6. Arrancar el servidor

```bash
# Producción
npm start

# Desarrollo (con nodemon)
npm run dev
```

El servidor estará disponible en `http://localhost:3000`

---

## 🔐 Autenticación

La API usa **JWT Bearer Token**. Incluye el token en cada request:

```
Authorization: Bearer <token>
```

### Credenciales del seed

| Rol | Email | Password |
|---|---|---|
| Admin | admin@preparia.co | Admin2025! |
| Estudiante | demo@preparia.co | Demo2025! |

> **Nota:** Los hashes del seed son de ejemplo. Para producción, registra usuarios via `/auth/register`.

---

## 📡 Endpoints de la API

**Base URL:** `http://localhost:3000/api/v1`

### 🔑 Auth

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Registrar nuevo usuario |
| POST | `/auth/login` | ❌ | Iniciar sesión → devuelve JWT |
| POST | `/auth/logout` | ✅ | Cerrar sesión (invalida en BD) |

**Ejemplo login:**
```json
POST /api/v1/auth/login
{
  "email": "demo@preparia.co",
  "password": "Demo2025!"
}
```

**Respuesta:**
```json
{
  "ok": true,
  "mensaje": "Inicio de sesión exitoso.",
  "datos": {
    "token": "eyJhbGci...",
    "usuario": {
      "id": 2,
      "nombre": "Estudiante",
      "email": "demo@preparia.co",
      "rol": "estudiante"
    }
  }
}
```

---

### 👤 Usuarios

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | `/usuarios/perfil` | ✅ | todos | Ver perfil propio |
| PUT | `/usuarios/perfil` | ✅ | todos | Actualizar perfil |
| GET | `/usuarios` | ✅ | admin | Listar todos los usuarios |

---

### 📚 Materias y Niveles

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/materias` | ✅ | Listar materias activas |
| GET | `/materias/:id` | ✅ | Detalle de una materia |
| GET | `/niveles` | ✅ | Listar niveles |

---

### 🌳 Nodos de Aprendizaje

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/nodos` | ✅ | Listar nodos (filtros: `?materia=&nivel=&padre=`) |
| GET | `/nodos/:id` | ✅ | Nodo con hijos y materiales |
| GET | `/nodos/arbol/:idMateria` | ✅ | Árbol completo anidado de la materia |

**Ejemplo — árbol de Ciencias Sociales (materia id=1):**
```
GET /api/v1/nodos/arbol/1
```

---

### 📖 Material de Estudio

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | `/materiales` | ✅ | todos | Listar materiales (`?nodo=&tipo=`) |
| GET | `/materiales/:id` | ✅ | todos | Ver un material |
| POST | `/materiales` | ✅ | admin | Crear material |
| PUT | `/materiales/:id` | ✅ | admin | Editar material |
| DELETE | `/materiales/:id` | ✅ | admin | Eliminar (soft delete) |

---

### ❓ Banco de Preguntas

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | `/preguntas` | opcional | — | Listar preguntas (`?nodo=&nivel=&dificultad=`) |
| GET | `/preguntas/:id` | opcional | — | Ver pregunta (admin ve respuestas) |
| POST | `/preguntas` | ✅ | admin | Crear pregunta con opciones |
| PUT | `/preguntas/:id` | ✅ | admin | Actualizar pregunta |

**Ejemplo crear pregunta:**
```json
POST /api/v1/preguntas
{
  "id_nodo": 1,
  "id_nivel": 1,
  "enunciado": "¿Cuál es la capital de Colombia?",
  "dificultad": "facil",
  "tipo": "seleccion_multiple",
  "explicacion": "Bogotá es la capital y ciudad más poblada de Colombia.",
  "opciones": [
    { "texto": "Medellín",  "es_correcta": false },
    { "texto": "Bogotá",    "es_correcta": true  },
    { "texto": "Cali",      "es_correcta": false },
    { "texto": "Cartagena", "es_correcta": false }
  ]
}
```

---

### 🧪 Simulacros

| Método | Ruta | Auth | Rol | Descripción |
|---|---|---|---|---|
| GET | `/simulacros` | ✅ | todos | Listar simulacros |
| GET | `/simulacros/:id` | ✅ | todos | Detalle de simulacro |
| POST | `/simulacros` | ✅ | admin | Crear simulacro |
| PUT | `/simulacros/:id` | ✅ | admin | Editar simulacro |

---

### ▶️ Intentos de Simulacro

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/intentos` | ✅ | Historial de intentos del usuario |
| GET | `/intentos/:id` | ✅ | Detalle + retroalimentación |
| POST | `/intentos` | ✅ | Iniciar intento (`{ id_simulacro }`) |
| POST | `/intentos/:id/responder` | ✅ | Registrar respuesta (`{ id_pregunta, id_opcion }`) |
| POST | `/intentos/:id/finalizar` | ✅ | Finalizar → devuelve puntaje + retroalimentación |

**Flujo completo de un simulacro:**

```
1. POST /intentos          → { id_simulacro: 1 }  → obtener id_intento + preguntas
2. POST /intentos/5/responder  → { id_pregunta: 1, id_opcion: 3 }  (repetir por pregunta)
3. POST /intentos/5/finalizar  → puntaje, correctas, retroalimentación
```

---

### 📊 Progreso del Estudiante

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/progreso` | ✅ | Progreso en todas las materias + racha |
| GET | `/progreso/materia/:id` | ✅ | Progreso detallado por nodo en una materia |

---

### 🎯 Examen de Nivel

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/examen-nivel?materia=1` | ✅ | Obtener/crear examen diagnóstico |
| POST | `/examen-nivel/responder` | ✅ | Responder pregunta del examen |
| GET | `/examen-nivel/historial` | ✅ | Ver exámenes anteriores |

---

### 📋 Reportes (solo Admin)

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| GET | `/reportes` | ✅ admin | Listar reportes generados |
| POST | `/reportes` | ✅ admin | Generar nuevo reporte |
| GET | `/reportes/:id` | ✅ admin | Ver reporte con datos |
| GET | `/reportes/dashboard` | ✅ admin | Métricas globales del sistema |

**Tipos de reporte disponibles:**
```json
{ "tipo": "progreso_general" }
{ "tipo": "simulacros",    "fecha_inicio": "2025-01-01", "fecha_fin": "2025-12-31" }
{ "tipo": "usuarios_activos" }
{ "tipo": "por_materia" }
```

---

## 📦 Formato de respuesta estándar

Todas las respuestas siguen este formato:

```json
{
  "ok": true,
  "mensaje": "Descripción del resultado",
  "datos": { ... },
  "meta": {
    "total": 100,
    "pagina": 1,
    "porPagina": 20,
    "totalPaginas": 5
  }
}
```

**Errores:**
```json
{
  "ok": false,
  "mensaje": "Descripción del error",
  "errores": [
    { "campo": "email", "mensaje": "Correo electrónico inválido." }
  ]
}
```

---

## 🔒 Roles y permisos

| Recurso | Estudiante | Admin |
|---|---|---|
| Registro / Login | ✅ | ✅ |
| Ver materias, nodos, materiales | ✅ | ✅ |
| Ver preguntas (sin respuestas) | ✅ | — |
| Ver preguntas (con respuestas) | ❌ | ✅ |
| Crear/editar materiales, preguntas, simulacros | ❌ | ✅ |
| Iniciar/responder simulacros | ✅ | — |
| Ver propio progreso | ✅ | — |
| Reportes y dashboard admin | ❌ | ✅ |

---

## 🩺 Health check

```
GET http://localhost:3000/api/v1/health
```

```json
{
  "ok": true,
  "mensaje": "PreparIA API funcionando correctamente.",
  "version": "v1",
  "timestamp": "2025-10-15T14:32:00.000Z"
}
```

---

## 🚀 Integración con el frontend

El frontend (HTML/CSS/JS) se conecta a esta API así:

```javascript
// js/api.js en el frontend
const API_BASE = 'http://localhost:3000/api/v1';

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('preparia_token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  return res.json();
};

// Ejemplo de login:
const { datos } = await apiFetch('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email, password }),
});
localStorage.setItem('preparia_token', datos.token);
```

---

## 🔮 Preparado para IA

El sistema está diseñado para agregar fácilmente generación de preguntas con IA:

```javascript
// Futura integración en pregunta.service.js:
const generarConIA = async (nodo, dificultad, cantidad) => {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    // prompt con contexto del nodo y dificultad
    // parsear respuesta → insertar en BD vía createPregunta()
  });
};
```

---

## 📝 Licencia

Desarrollado para PreparIA — Colombia 🇨🇴
