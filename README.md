# ALPHA-FIT

Plataforma de administración y seguimiento para gimnasios. Permite registrar alumnos, controlar asistencia, llevar un catálogo de ejercicios y plantillas de entrenamiento compartibles, seguir progreso físico, gestionar mensualidades, generar informes imprimibles y respaldar toda la información — todo desde el navegador, sin backend.

## Características

- 👥 Gestión completa de alumnos con perfil, objetivos y notas
- 📅 Registro de asistencia **con la ejecución de la sesión** (series, reps, peso, implemento)
- 🏋️ Catálogo reutilizable de ejercicios + plantillas de entrenamiento compartibles entre alumnos
- 🗂️ Categorías de entrenamiento gestionables, con filtro y agrupación en la lista y selector en el registro de asistencia
- 🔁 Precarga desde el historial: al registrar una sesión, los pesos se autocompletan con lo último que hizo ese alumno
- 📈 Delta de peso en vivo (`+5 kg · +8%`) junto al campo de peso
- ✏️ Ejercicios añadidos o quitados **sólo para esa asistencia**, sin tocar la plantilla
- 📏 Mediciones físicas (peso, medidas, calorías) con gráficos históricos
- 🎯 Objetivos individuales configurables
- 💳 Pagos, mensualidades, vencimientos e ingresos
- 🏆 Sistema de niveles por constancia e insignias por hitos
- 🗓️ Semanas justificadas (feriados, cierres, enfermedad) que no rompen la racha ni el cumplimiento
- 📊 Dashboard con indicadores reales (no ficticios)
- 📄 Informes individuales imprimibles / exportables a PDF
- 💾 Respaldo y restauración JSON completa
- 📊 Importación y exportación Excel (varias entidades)
- 🌙 Identidad visual propia "Sport Premium" en oscuro
- 📱 Diseño responsive

## Stack

- HTML5 + CSS3 + JavaScript ES6+ (módulos)
- localStorage para persistencia
- [Chart.js 4](https://www.chartjs.org/) — gráficos
- [SheetJS (xlsx)](https://sheetjs.com/) — import/export Excel
- [Lucide](https://lucide.dev/) — iconografía
- [Google Fonts](https://fonts.google.com/) — Inter, Manrope, JetBrains Mono

Sin frameworks. Sin backend. Sin build step.

## Estructura del proyecto

```
/
├── index.html
├── favicon.svg            Ícono del navegador (marca ALPHA-FIT)
├── README.md
├── docs/
│   ├── data-model.md
│   └── excel-import-export.md
└── assets/
    ├── css/
    │   ├── tokens.css        Sistema de diseño (colores, tipografía, espaciado)
    │   ├── layout.css        Sidebar, topbar, grid principal
    │   ├── components.css    Botones, tarjetas, tablas, modales, formularios
    │   ├── views.css         Estilos por vista
    │   └── print.css         Informe PDF
    ├── img/
    │   ├── logo.svg          Marca en blanco (interfaz oscura)
    │   ├── logo-ink.svg      Marca en tinta (informe impreso, fondo claro)
    │   └── logo-lockup.svg   Marca completa con wordmark
    └── js/
        ├── config.js         Constantes, niveles por defecto
        ├── storage.js        Capa de persistencia localStorage
        ├── utils.js          Utilidades (fecha, formato, DOM, IDs)
        ├── icons.js          Lucide helpers
        ├── state.js          Estado en memoria + pub/sub
        ├── router.js         Router por hash
        ├── app.js            Punto de entrada
        ├── services/
        │   ├── exercises.js     Catálogo de ejercicios
        │   ├── categories.js    Categorías de entrenamiento (agrupación)
        │   ├── trainings.js     Plantillas de entrenamiento
        │   ├── entries.js       Precarga y delta de peso (lógica pura)
        │   └── …                students, attendance, payments, levels, …
        └── views/
            ├── attendance-form.js  Modal compartido de registro de asistencia
            └── …               dashboard, students, workouts, settings, …
```

### Modelo de datos (esquema v2)

Tres conceptos separados que se unen al registrar una asistencia, más una capa de agrupación
por encima de las plantillas:

```
trainingCategories → agrupación     { id, name, observation, color, status }  (opcional)
exercises          → catálogo        { id, name, observation, muscleGroups[] }
trainings          → plantillas      { id, name, categoryId, observation, exerciseIds[] }  (sin studentId)
attendances        → la sesión       { id, studentId, trainingId, dateISO, entries[] }
              └─ entries[] = { exerciseId, order, extra, name, muscleGroups[],
                               sets, reps, weightKg, implement, observation,
                               lastWeightKg }
closures           → justificaciones { id, dateISO, endISO, name }  (global: feriado / cierre)
students.exemptWeeks[]               (individual: enfermedad, viaje, permiso)
```

- Una **categoría no es un plan**: sólo agrupa y filtra los entrenamientos ("Tren superior",
  "Full body", "Cardio"). No lleva ejercicios, semanas ni progresión.
- Un **entrenamiento no pertenece a un alumno**: la misma plantilla la usan todos.
- Cada **entrada** guarda un snapshot de nombre y grupos musculares, así que el historial
  sobrevive aunque el ejercicio se renombre o se borre del catálogo.
- `lastWeightKg` es la línea base del delta y se **recalcula cada vez que se guarda**,
  no queda congelada al crear (así registrar una sesión con fecha retroactiva no miente).
- Borrar una **categoría nunca borra entrenamientos**: quedan como "Sin categoría".
- Una **semana justificada** no cuenta ni a favor ni en contra: no suma a la racha, no la corta, y
  sale del cumplimiento. Un feriado no es una falta de constancia.

Ver [docs/data-model.md](docs/data-model.md) para el detalle completo.

## Ejecutar localmente

La aplicación es 100% estática. Para abrirla:

```bash
# Opción 1 — con Python
python -m http.server 8080

# Opción 2 — con Node (si tienes npx)
npx serve .
```

Luego abre [http://localhost:8080](http://localhost:8080).

> **Importante:** abrir `index.html` directamente con `file://` no funcionará porque la aplicación usa módulos ES. Necesitas servirlo por HTTP.

## Publicar en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube toda la carpeta (`index.html`, `assets/`, `docs/`).
3. En **Settings → Pages**, elige la rama principal y la raíz (`/`).
4. Espera 1–2 minutos. Tu app quedará disponible en `https://<usuario>.github.io/<repositorio>/`.

No se necesita build, ni Node, ni nada extra.

## Datos y respaldos

- Los datos se guardan en `localStorage` bajo la clave `gymtrack:db:v2`.
- Toda la app se ejecuta en este navegador. Cambiar de navegador o borrar datos del sitio elimina la información.
- Usa **Datos y configuración → Exportar base de datos** para descargar un JSON completo antes de borrar datos o cambiar de equipo.
- Puedes cargar datos demo desde la misma pantalla (se identifican claramente y pueden borrarse después).

### Desde la v1 (2.0)

El esquema v2 separa catálogo, plantillas y ejecución real, así que **no hay migración automática**:
la primera vez que abres ALPHA-FIT 2.0, tu base v1 se archiva tal cual en `gymtrack:archive:v1`
y la v2 empieza vacía. Desde **Datos y configuración** aparece un bloque
*"Archivo de la versión anterior (v1)"* con tres acciones:

| Acción | Qué hace |
|---|---|
| **Descargar copia v1** | Guarda `gymtrack_v1_<fecha>.json` en tu equipo. Hazlo antes de nada. |
| **Restaurar clave v1** | Vuelve a escribir la base antigua en `gymtrack:db:v1` para abrirla con ALPHA-FIT 1.x. Tus datos v2 no se tocan. |
| **Eliminar archivo** | Borra el archivo. Irreversible. |

Los respaldos v1 no se pueden importar en la v2: el modelo es incompatible, no un formato.

### Desde la 2.0 (2.1)

La 2.1 agrega las **categorías de entrenamiento**. Es un cambio **aditivo**: `SCHEMA_VERSION` sigue
en 2 porque las bases existentes se rellenan solas con `trainingCategories: []`. Tus entrenamientos
actuales aparecen bajo **Sin categoría** hasta que les asignes una. No hay nada que migrar a mano.

## Documentación adicional

- [Modelo de datos](docs/data-model.md)
- [Importación y exportación Excel](docs/excel-import-export.md)

## Limitaciones

- Aplicación local (no multiusuario)
- Sin sincronización entre dispositivos (solo vía respaldo JSON)
- Datos atados al navegador (limpieza de datos = pérdida)
- Sin envío automático de informes (descarga + envío manual)
- Sin autenticación (uso administrador único)

## Privacidad

- No se envía información a ningún servidor.
- No se almacenan contraseñas ni datos bancarios.
- Los archivos Excel/JSON descargados quedan en tu equipo.
