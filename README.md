# PreparIA 🎓

Plataforma web con inteligencia artificial para ayudar a estudiantes colombianos a prepararse para el examen **ICFES Saber 11**, con enfoque inicial en el módulo de **Ciencias Sociales y Ciudadanas**.

---

## ✨ Características

- **Simulacros generados con IA**: preguntas estilo ICFES con bloques de contexto (`texto_base`) creadas con la API de Google Gemini.
- **Distribución por competencias**:
  - Pensamiento social: 30%
  - Interpretación y análisis de perspectivas: 40%
  - Pensamiento reflexivo y sistémico: 30%
- **Distribución temática**:
  - Historia y Geografía: 35%
  - Política y Constitución: 30%
  - Relaciones Espaciales y Ambientales: 20%
  - Ética y Ciudadanía: 15%
- **Árbol de nodos de aprendizaje**: cuatro niveles jerárquicos, con 84 registros de contenido distribuidos en 28 nodos hoja.
- **Análisis de fallos** (`analizarFallos()`): agrupa los errores por competencia y tema, con retroalimentación por pregunta y por competencia.
- **Gamificación**: puntos, rachas y rankings (función `fn_complete_simulation`).
- **Autenticación con JWT** y control de acceso por roles.
- **Fallback de modelos Gemini**: `gemini-2.5-flash → gemini-2.0-flash → gemini-2.5-flash-lite`.

---

## 🧱 Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML, CSS y JavaScript vanilla (desplegado en **Vercel**) |
| Backend | Node.js + Express (arquitectura MVC, Repository Pattern) |
| Despliegue backend | Google Cloud Run (`preparia-api`, us-east1) |
| Base de datos | PostgreSQL en **Supabase** (esquema en 3NF, 16 tablas, triggers, vistas y funciones almacenadas) |
| IA | Google Gemini API |

**Diseño:** estética Neobrutalismo/Claymorphism, fondo oscuro, verde ácido `#AAFF00` / `#BFFF00` y tipografía Plus Jakarta Sans.

---

## 🔐 Seguridad

- Hash de tokens con SHA-256.
- Rate limiting con `express-rate-limit`.
- Validación de entradas.
- CORS restringido a los orígenes autorizados.
- Credenciales y claves de API solo mediante variables de entorno (nunca en el repositorio).

---

## 🚀 Instalación local

### Requisitos

- Node.js 18 o superior
- PostgreSQL (local o una instancia de Supabase)
- Una clave de API de Google Gemini

### Pasos

1. **Clonar el repositorio**

   ```bash
   git clone https://github.com/SamuelSaez08/PreparIA.git
   cd PreparIA
   ```

2. **Instalar dependencias del backend**

   ```bash
   cd backend
   npm install
   ```

3. **Configurar variables de entorno**

   Crea un archivo `.env` dentro de `backend/`:

   ```env
   PORT=3000
   DATABASE_URL=postgresql://usuario:contraseña@host:5432/basedatos
   JWT_SECRET=una_clave_larga_y_segura
   GEMINI_API_KEY=tu_clave_de_gemini
   CORS_ORIGIN=http://localhost:5500
   ```

4. **Crear la base de datos**

   Ejecuta el script del esquema (tablas, triggers, vistas y funciones) en tu instancia de PostgreSQL:

   ```bash
   psql "$DATABASE_URL" -f database/schema.sql
   ```

5. **Iniciar el backend**

   ```bash
   npm start
   ```

6. **Abrir el frontend**

   Sirve la carpeta del frontend con cualquier servidor estático (por ejemplo, la extensión Live Server de VS Code) y abre `index.html`.

---

## 📁 Estructura del proyecto

```
PreparIA/
├── frontend/          # Páginas HTML, estilos y scripts
├── backend/
│   ├── controllers/   # Lógica de las rutas
│   ├── repositories/  # Acceso a datos (Repository Pattern)
│   ├── routes/        # Definición de endpoints
│   ├── middlewares/   # Autenticación, validación, rate limiting
│   └── services/      # Integración con Gemini y reglas de negocio
├── database/          # Esquema SQL y scripts de datos
└── README.md
```

---

## ☁️ Despliegue

- **Frontend:** Vercel, conectado al repositorio.
- **Backend:** Google Cloud Run (`preparia-api`, región us-east1), configurando las variables de entorno en el servicio.
- **Base de datos:** Supabase, usando el Session Pooler para las conexiones.

---

## 🗺️ Hoja de ruta

- Ampliar el contenido a los demás módulos del Saber 11.
- Modelo de negocio: freemium B2C → licenciamiento institucional B2B2C.
- Panel para docentes e instituciones.

---

## 👥 Autores

- **Samuel Dario Saez González** — [@SamuelSaez08](https://github.com/SamuelSaez08)
- **Gabriel Arboleda Caballero**

Proyecto desarrollado en la Universidad de Córdoba (UNICÓRDOBA), Montería, Colombia, y presentado en el semillero INNOVARIUM y en CONASIE 2026.

---

## 📄 Licencia

Define aquí la licencia del proyecto (por ejemplo, MIT).
