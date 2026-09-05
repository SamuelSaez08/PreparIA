# PreparIA — Frontend

Interfaz web de PreparIA. HTML, CSS y JavaScript sin frameworks ni proceso de
compilación: los archivos que ves son los que se sirven.

---

## Cómo ejecutarlo

El frontend necesita el backend corriendo (ver `Backend/README.md`).

**No abras los archivos con doble clic.** El protocolo `file://` bloquea las
peticiones a la API. Usa un servidor local:

- **VS Code** — instala la extensión *Live Server*, clic derecho sobre
  `index.html` → **Open with Live Server**. Queda en `http://127.0.0.1:5500`.
- **Con Node** — `npx serve .` desde esta carpeta.
- **Con Python** — `python -m http.server 5500`.

El origen que uses debe estar en la variable `CORS_ORIGIN` del `.env` del
backend. Por defecto ya vienen incluidos los puertos 5500 de Live Server.

---

## Estructura

```
Frontend/
├── index.html               ← Página de inicio (pública)
├── login.html               ← Inicio de sesión
├── registro.html            ← Registro de estudiantes (RF-02)
├── dashboard.html           ← Panel del estudiante
├── ciencias-sociales.html   ← Árbol de conocimiento de la materia
├── nodo.html                ← Detalle de un nodo y su material
├── simulacros.html          ← Simulacro cronometrado (RF-05)
├── estadisticas.html        ← Progreso y desempeño (RF-07)
├── ranking.html             ← Tabla de posiciones
├── admin.html               ← Panel de administración (RF-03, RF-04, 4.7)
├── 404.html
├── css/
│   ├── styles.css           ← Sistema de diseño y componentes
│   └── ranking.css
└── js/
    ├── config.js            ← Detecta entorno y fija la URL de la API
    ├── api.js               ← Cliente HTTP y clientes por módulo
    ├── state.js             ← Sesión, autenticación, estado local
    ├── ui.js                ← Toasts, modales, gráficas, validación
    ├── app.js               ← Enrutador: qué módulo inicializa cada página
    └── pages/               ← Un archivo por página (page-*.js)
```

Cada HTML carga solo su propio `page-*.js`. `app.js` mira el nombre del archivo
en la URL y llama al `init()` correspondiente.

---

## Configuración de la API

`js/config.js` decide sola a qué backend apuntar:

- `localhost`, `127.0.0.1` o `192.168.x.x` → `http://localhost:3000/api/v1`
- cualquier otro dominio → el backend desplegado

Si cambias el puerto del backend, cámbialo también aquí. Es la causa más común
de que la aplicación cargue pero no muestre datos.

---

## Panel de administración

`admin.html` es la interfaz del actor Administrador. Solo se abre con una cuenta
de rol `admin`; con cualquier otra muestra un aviso y devuelve al panel del
estudiante. Para crear la primera cuenta:

```bash
cd ../Backend
npm run admin -- admin@preparia.co "ClaveSegura123"
```

Contiene cuatro secciones:

- **Usuarios** — buscar, editar, activar/desactivar y eliminar cuentas (RF-03).
- **Preguntas** — crear, editar y retirar preguntas del banco (RF-04).
- **Material** — cargar y mantener el material de estudio de cada nodo (RF-04).
- **Reportes** — resumen de rendimiento, descarga en CSV e impresión a PDF
  desde el navegador (caso de uso 4.7).

---

## Integridad durante los simulacros

Mientras hay un simulacro en curso, `page-simulacros.js` desactiva copiar,
pegar, cortar, el menú contextual y la selección de texto, bloquea los atajos
de teclado más usados y registra los cambios de pestaña. La hoja de estilos
oculta además las preguntas al imprimir.

Es una barrera razonable, no una garantía: ninguna medida del lado del cliente
puede impedir del todo una captura de pantalla. La validación importante —el
vencimiento del tiempo— la hace el servidor.

---

## Notas de accesibilidad y responsividad

- Tamaño mínimo de texto: 14 px en escritorio, 16 px en móvil.
- Puntos de quiebre en 1024 px y 768 px.
- El cronómetro del simulacro se ancla a una hora de finalización absoluta, así
  que no se desfasa aunque la pestaña quede en segundo plano.
