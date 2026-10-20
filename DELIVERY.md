# GymTrack — Resumen de entrega

## 0.bis. Corrección en 2.1.1 — las rachas

Las rachas se calculaban, no se guardan (`computeStudentMetrics()` deriva todo de `attendances[]` en
cada render). El algoritmo estaba mal por partida triple:

| Bug | Síntoma | Causa |
|---|---|---|
| **Zona horaria** | La racha salía una semana corta, o en 0 | `new Date('2026-03-02')` parsea como **medianoche UTC**, pero `startOfWeek()` lo lee en hora **local**. En Chile (UTC−3) el lunes se convertía en domingo → `startOfWeek` retrocedía otra semana → clave ausente en `weekMap` → cuenta 0 → racha cortada. En UTC pasaba; en todo el hemisferio negativo fallaba. |
| **Racha muerta** | Un alumno que abandonó conservaba su racha para siempre | El bucle arrancaba en la última semana **con asistencia**, no en la actual. Perdonaba todos los huecos, no sólo la semana en curso. |
| **Cumplimiento inflado** | Quien abandonaba sacaba 100% | La ventana se armaba sobre las últimas 12 semanas **que tenían asistencia**, no las últimas 12 semanas. |

Los tres contradecían el comportamiento que el propio código documentaba. Ahora:

- La racha se ancla en la **semana actual** y camina hacia atrás. La semana en curso está **abierta**
  (no cumplirla todavía no cuesta nada), pero cualquier semana vacía anterior sí la rompe.
- El cumplimiento usa una ventana de **12 semanas calendario**, con las vacías contando como fallo, y
  nunca retrocede antes de que el alumno estuviera en el gimnasio. Ese tope es **el más temprano entre
  `joinedAt` y su primera asistencia**: una ficha creada hoy con seis semanas de historial
  retroactivo se juzga sobre esas seis semanas, no sobre una.
- Todas las conversiones de fecha pasan por `fromISODate()` (hora local). Nada vuelve a usar
  `new Date()` con una cadena `YYYY-MM-DD`.

**Consecuencia visible:** al contar las semanas vacías, **el cumplimiento baja y algunos alumnos
bajan de nivel**. No es una regresión: es el número que antes estaba inflado. Los umbrales de
`LEVELS` no se tocaron.

## 0. Novedades en 2.1.0 (categorías de entrenamiento)

La 2.1 agrega una **capa de agrupación** encima de los entrenamientos, a pedido explícito: *"igual
es bueno tener una categoría adicional que agrupe entrenamientos"*. La precisión que delimita el
pedido es que **una categoría no es un plan**: no tiene ejercicios, semanas, progresión ni fechas.
Sólo ordena y filtra rutinas ya existentes.

| Decisión | Valor |
|---|---|
| Modelo | Colección gestionable `trainingCategories[]` con CRUD propio en *Entrenamientos → Categorías* |
| Agrupación | La lista de entrenamientos se renderiza en bloques por categoría |
| Filtro | Select "Categoría" con **Todas** / cada categoría / **Sin categoría** (con conteos) |
| En la asistencia | Selector en cascada **Categoría → Entrenamiento** |
| Cambio de esquema | **Ninguno.** `SCHEMA_VERSION` sigue en 2: es aditivo y `load()` rellena la colección |

Garantías que la implementación asegura:

- **Borrar una categoría nunca borra un entrenamiento.** Se archiva la categoría y sus
  entrenamientos caen a "Sin categoría".
- Un `categoryId` colgante (categoría borrada a mano en el JSON) degrada a "Sin categoría" en vez
  de hacer desaparecer el entrenamiento de la lista.
- La categoría se escribe **una sola vez** en el `attendances`: nunca se copia al snapshot, porque
  la asistencia referencia el entrenamiento, y el entrenamiento referencia la categoría.

Archivos tocados: `services/categories.js` (nuevo), `services/trainings.js`, `services/seed.js`,
`services/excel.js`, `services/reports.js`, `storage.js`, `config.js`, `views/workouts.js`,
`views/attendance-form.js`, `views/student-detail.js`, `views/settings.js`, `css/views.css`.

## 0.b. Novedades en 2.0.0 (esquema v2)

La entrega anterior ataba el entrenamiento al alumno y guardaba la ejecución en una colección que
ninguna vista escribía. La 2.0 separa los tres conceptos y los vuelve a unir en el único punto
donde el profesor los necesita: **el formulario de asistencia**.

| Antes (v1) | Ahora (v2) |
|---|---|
| `routines` atadas a un `studentId` | `trainings` **globales**, compartidas por todos los alumnos |
| `routineExercises` con un `muscleGroup` (string) | `exercises` de catálogo con `muscleGroups[]` (lista cerrada) |
| `performedSessions` que nadie escribía | `attendances[].entries[]` — la ejecución real, embebida |
| Marcas de presencia sin ejercicio ni peso | Cada asistencia lleva series, reps, peso e implemento |
| Registro manual de pesos, cada vez | **Precarga desde el historial** del alumno |
| Sin comparación entre sesiones | **Delta en vivo** `+5 kg · +8%` junto al campo de peso |
| Ejercicios sólo en la plantilla | **Añadir/quitar por sesión**, sin tocar la plantilla |
| Una rutina por alumno (duplicados) | Una plantilla, muchos alumnos |

Además corrige dos bugs latentes:

- `removeDemo()` filtraba `routineExercises` por un campo `studentId` inexistente, así que los datos
  demo no se limpiaban del todo. Ahora filtra catálogos por `meta.isDemo` y lo demás por alumno.
- El registro de asistencia **descartaba en silencio** lo que el usuario acababa de escribir si ya
  existía una del mismo día. Ahora esa flujo cae en modo edición sobre el registro existente.

### Migración v1 → v2

Es una migración **destructiva por diseño**: el modelo cambió de forma incompatible, así que no hay
conversión automática. Al abrir la 2.0 con una base v1 presente, el cliente:

1. Mueve `gymtrack:db:v1` a `gymtrack:archive:v1` **byte-idéntico** (con `counts` + `raw`).
2. Crea `gymtrack:db:v2` vacío.
3. Muestra un modal one-shot con los conteos v1 y un botón **Descargar copia v1**.
4. **Datos y configuración** expone después un bloque *"Archivo de la versión anterior (v1)"*
   con Descargar / Restaurar clave v1 / Eliminar archivo.

`importJSON()` rechaza respaldos `schemaVersion < 2` con un mensaje que apunta a ese bloque.

## 1. Lo que se implementó

Una aplicación web estática para la administración completa de un gimnasio. **Sin backend, sin frameworks pesados, sin build step**. Todo se ejecuta en el navegador y persiste en `localStorage`.

### Identidad visual

Diseño propio "Sport Premium" — fondo midnight navy (`#0a1124`), acento dorado-ámbar (`#f4c662`), superficie elevada con sombras suaves. Tipografía: **Inter** (UI), **Manrope** (display), **JetBrains Mono** (números). Iconografía coherente con Lucide en todo el sistema.

### Módulos funcionales entregados

| Módulo | Estado | Descripción |
|---|---|---|
| **Dashboard** | ✅ | Cabecera contextual (saludo, fecha, accesos rápidos), 4 KPIs principales (alumnos activos, asistencia hoy, ingresos del mes, cumplimiento), gráfico principal de asistencia semanal, actividad reciente, sección "necesitan atención", gráfico de alumnos activos (6 meses), ingresos por período (6 meses), distribución de niveles (doughnut), barra de pagos y próximos vencimientos |
| **Alumnos** | ✅ | Listado en grid con búsqueda, filtros (estado, nivel, pagos) y creación/edición. Avatares con iniciales, niveles visuales, próximas mensualidades, frecuencia semanal |
| **Ficha de alumno** | ✅ | Cabecera con datos, 4 KPIs, pestañas: Resumen · Asistencia · Entrenamientos · Progreso físico · Objetivos · Pagos · Notas · Nivel y logros. La pestaña Entrenamientos es el historial de sesiones con pesos y delta contra la anterior |
| **Asistencia (global)** | ✅ | KPIs (hoy, semana, mes, top asistentes del mes), gráfico de 30 días, panel "hoy en el gimnasio", historial con búsqueda, registro rápido, exportación Excel |
| **Registro de asistencia** | ✅ | Modal compartido por los 3 puntos de entrada. Precarga desde el historial del alumno, **delta de peso en vivo**, añadir/quitar ejercicios sólo para esa sesión, reordenar, implemento y nota por ejercicio, y selector en cascada Categoría → Entrenamiento |
| **Entrenamientos** | ✅ | Tres pestañas: **Entrenamientos** (plantillas globales, agrupadas y filtrables por categoría), **Categorías** (CRUD de la capa de agrupación) y **Catálogo de ejercicios** (nombre, observación, grupos musculares múltiples). Ejercicios ordenables dentro de la plantilla |
| **Progreso físico** | ✅ | Gráficos globales de peso promedio y calorías por sesión, tabla "último registro por alumno" |
| **Mediciones en ficha** | ✅ | Gráfico histórico por métrica, selector, comparativa entre primera y última lectura, tabla historial completa |
| **Objetivos** | ✅ | CRUD por alumno, con tipo, valor meta, unidad, fecha objetivo, estado |
| **Pagos (global)** | ✅ | KPIs (ingresos, pendiente, vencido, total), gráfico de ingresos 6 meses, tabla con filtros y pago directo |
| **Informes individuales** | ✅ | Constructor con selección de alumno, período, secciones a incluir y comentario del entrenador. Vista previa imprimible. Estilos específicos para impresión (`print.css`). Listas para guardar como PDF desde el navegador |
| **Datos y configuración** | ✅ | Estado del almacenamiento, exportación JSON, restauración con validación y resumen, exportar/importar Excel (varias entidades), plantillas, datos de demostración instalables y removibles, bloque "Archivo v1" (descargar / restaurar clave / eliminar), zona peligrosa |
| **Sistema de niveles** | ✅ | 5 niveles (Principiante → Referente). Evaluación exclusiva por **constancia** (total, racha, cumplimiento). Mediciones nunca afectan el nivel. Progreso al siguiente nivel. Insignias (8) por hitos |
| **Respaldo** | ✅ | JSON completo, validación, metadatos de versión, rechazo explícito de respaldos v1 |

## 2. Estructura del proyecto

```
/
├── index.html                              # Shell con sidebar + main + modales/toasts
├── README.md                               # Guía rápida de uso y despliegue
├── DELIVERY.md                             # Este documento
├── docs/
│   ├── data-model.md                       # Modelo de datos completo
│   └── excel-import-export.md              # Plantillas y columnas
├── assets/
│   ├── css/
│   │   ├── tokens.css                      # Sistema de diseño (colores, tipografía, espaciado, radios, sombras)
│   │   ├── layout.css                      # Sidebar + topbar + grid responsive
│   │   ├── components.css                  # Botones, tarjetas, tablas, modales, formularios, toasts, badges, progress, kpi, levels
│   │   ├── views.css                       # Estilos específicos por vista
│   │   └── print.css                       # Estilos @media print para informes
│   └── js/
│       ├── config.js                       # Constantes: niveles, badges, grupos musculares, implementos, tonos de categoría
│       ├── utils.js                        # Helpers: fechas, IDs, formato, DOM, validación
│       ├── storage.js                      # Capa única de persistencia localStorage + archivo v1
│       ├── icons.js                        # Lucide helpers
│       ├── router.js                       # Hash router
│       ├── charts.js                       # Wrapper Chart.js con tema oscuro
│       ├── components.js                   # Toasts y modales
│       ├── app.js                          # Bootstrap y registro de rutas
│       ├── services/
│       │   ├── students.js                 # CRUD alumnos
│       │   ├── exercises.js                # CRUD catálogo de ejercicios (borrado suave)
│       │   ├── categories.js               # CRUD categorías + agrupación de entrenamientos
│       │   ├── trainings.js                # CRUD plantillas + resolución contra el catálogo
│       │   ├── entries.js                  # Precarga desde historial + delta de peso (puro, sin DOM)
│       │   ├── attendance.js               # CRUD asistencia + draft + saveAttendance
│       │   ├── measurements.js             # Mediciones + agregaciones
│       │   ├── payments.js                 # Pagos + estado vencido
│       │   ├── goals.js                    # Objetivos
│       │   ├── notes.js                    # Notas internas
│       │   ├── levels.js                   # Motor de niveles y badges (lógica pura)
│       │   ├── reports.js                  # Constructor de informes individuales
│       │   ├── seed.js                     # Generador de datos demo
│       │   ├── excel.js                    # Import/export xlsx (SheetJS)
│       │   └── backup.js                   # (integrado en storage.js)
│       └── views/
│           ├── dashboard.js                # Dashboard completo
│           ├── students.js                 # Listado + creación de alumnos
│           ├── student-detail.js           # Ficha + 8 pestañas
│           ├── attendance.js               # Vista global de asistencia
│           ├── attendance-form.js          # Modal compartido de registro (3 call sites)
│           ├── workouts.js                 # Entrenamientos + categorías + catálogo de ejercicios
│           ├── progress.js                 # Vista global de progreso físico
│           ├── payments.js                 # Vista global de pagos
│           ├── reports.js                  # Generador de informes imprimibles
│           └── settings.js                 # Datos, respaldo, Excel, demo, archivo v1
└── tests/
    ├── smoke.mjs                           # Smoke test (módulos importables)
    ├── entries.mjs                         # Tests puros de precarga y delta (20 asserts)
    ├── logic.mjs                           # Niveles, pagos, seed + 61 asserts de esquema v2 y categorías
    ├── audit-imports.mjs                   # Todos los imports resuelven a exports reales
    ├── globals.mjs                         # Ninguna vista llama a un helper sin importarlo
    ├── css-classes.mjs                     # Toda clase literal en JS existe en el CSS
    ├── browser-link.mjs                    # Todos los módulos son importables sin errores
    ├── sample-structure.mjs                # Estructura de un alumno de ejemplo
    └── backup.mjs                          # Test de backup/restore con validación
```

**Total:** 9 módulos JS base + 15 servicios + 10 vistas + 5 CSS + 2 docs + 8 tests.

## 3. Cómo ejecutarla localmente

La aplicación es **100% estática** pero usa módulos ES — necesita servirse por HTTP, no `file://`.

**Con Python (incluido en Windows por defecto):**
```bash
python -m http.server 8080
```
Abre [http://localhost:8080](http://localhost:8080).

**Con Node (si tienes `npx`):**
```bash
npx serve .
```

**Importante:** abrir `index.html` directamente con doble clic no funcionará porque los módulos ES requieren un origen HTTP. Usa siempre uno de los métodos anteriores.

## 4. Despliegue en GitHub Pages

1. Crea un repositorio en GitHub.
2. Sube **toda** la carpeta (incluidos `assets/`, `docs/`, `index.html`).
3. En **Settings → Pages**, elige la rama principal y la raíz (`/`).
4. Espera 1–2 minutos. Tu aplicación quedará disponible en `https://<usuario>.github.io/<repositorio>/`.

No requiere build, ni Node, ni configuración adicional. Los CDN externos (Chart.js, SheetJS, Lucide, Google Fonts) cargan directamente.

> **Privacidad del repositorio:** aunque tu repositorio sea público, **los datos viven en el navegador del administrador**, no en GitHub. Tu información nunca llega al servidor.

## 5. Documentación del modelo de datos

Ver [docs/data-model.md](docs/data-model.md). Incluye:

- Esquema raíz completo (`meta`, `config`, todas las colecciones del esquema v2).
- Tablas por entidad con tipo y descripción de cada campo.
- Reglas de precarga (`priorEntriesIndex`) y de delta de peso (`weightDelta`).
- Reglas del sistema de niveles (constantes en `LEVELS`).
- Reglas de migración, archivado v1 y validación de respaldos.
- Sección de privacidad.

## 6. Importación / exportación Excel

Ver [docs/excel-import-export.md](docs/excel-import-export.md). Cubre:

- Plantillas y columnas para alumnos y mediciones.
- Proceso paso a paso de importación y exportación.
- La exportación de **Entrenamientos** ahora produce 4 hojas: `Ejercicios`, `Categorías`,
  `Entrenamientos` y `Entrenamiento x Alumno` (una fila por ejercicio por sesión, con `Δ kg` y
  `Δ %` calculados por la **misma** función `weightDelta()` que usa la interfaz — el Excel no puede
  contradecir la pantalla).
- Validación aplicada (duplicados, errores por fila, sin reemplazo silencioso).
- Formatos de fecha aceptados.
- Limitaciones importantes (no hay sincronización bidireccional).

## 7. Respaldo y restauración

- **Exportar (JSON):** desde "Datos y configuración → Respaldo → Exportar base de datos". Genera un archivo `gymtrack_respaldo_<fecha>.json` con todas las colecciones + metadatos (`app`, `schemaVersion`, `appVersion`, `exportedAt`).
- **Restaurar (JSON):** desde "Datos y configuración → Respaldo → Restaurar desde archivo". La app valida origen, versión, formato y muestra un resumen antes de pedir confirmación explícita. Si algo falla, los datos existentes quedan intactos.
- **Respaldos v1:** rechazados con un mensaje explícito. La app no intenta convertirlos — el modelo
  es incompatible. La copia v1 vive en `gymtrack:archive:v1` y se gestiona desde el bloque
  "Archivo de la versión anterior (v1)" de Datos y configuración.

## 8. Limitaciones conocidas

- **Migración v1 → v2 destructiva.** No hay conversión automática de datos: la v1 se archiva tal
  cual y la v2 empieza vacía. Reconstruir el historial de la v1 es trabajo manual, aunque la copia
  queda disponible para abrirla con GymTrack 1.x.
- **Aplicación local.** No sincroniza entre dispositivos. Para mover la información entre dispositivos se usa el respaldo JSON.
- **Datos atados al navegador.** Si el usuario borra los datos del sitio (`localStorage.clear()`), cambia de navegador o de equipo, puede perder la información si no tiene un respaldo.
- **Sin autenticación multiusuario.** No hay roles ni inicio de sesión. Está diseñado para uso por un único administrador.
- **Sin secuencia fija de ejercicios por alumno.** En la v2 el alumno **no tiene un entrenamiento asignado**:
  se elige en cada asistencia. Es deliberado (una plantilla la usan todos), pero implica que nada
  impide que un alumno repita un entrenamiento distinto cada semana sin que el sistema avise.
- **Las categorías no planifican.** Agrupan y filtran; no guardan periodicidad, progresión ni
  objetivos por período. Si más adelante hace falta "esta categoría dura 8 semanas y sube 2,5 kg",
  eso es otra entidad, no un campo más de la categoría.
- **Informes vía impresión del navegador.** El envío a alumnos se hace manualmente (descargar PDF / imprimir y compartir). No hay integración automática con email o WhatsApp.
- **Reconocimiento inteligente no destructivo.** No interpolamos valores faltantes en gráficos de mediciones: si falta una fecha, el gráfico muestra un hueco honesto.
- **Hojas Excel:** se importan como copia; los cambios posteriores en el archivo Excel no se reflejan automáticamente.
- **Notas internas en informes compartidos:** están desactivadas por defecto. Solo aparecen si el administrador activa explícitamente la sección "Notas del entrenador" al construir el informe, y la nota tiene `shared: true`.

## 9. Pruebas realizadas

### Sintaxis
- `node --check` sobre **todos** los módulos JS. Resultado: **0 errores**.

### Lógica pura (Node, sin shims)
`tests/entries.mjs` ejecuta **20 asserts** sobre el núcleo del cambio:
- `priorEntriesIndex` — gana la más reciente, excluye la sesión editada, excluye el mismo día,
  desempata por `timeISO`.
- `buildDraftEntries` — conserva el orden del entrenamiento, toma la prescripción **del historial**
  (nunca del catálogo), `null` en la primera vez.
- `weightDelta` — `+5 kg · +8%`, `-2.5 kg · -3%` con **punto** decimal, `0` en tono apagado,
  sin porcentaje cuando el previo es 0, tolerante a strings.

Resultado: **ALL OK: 20 passed, 0 failed.**

### Lógica (Node + localStorage shim)
`tests/logic.mjs` ejecuta:
- Creación de alumno.
- 12 registros de asistencia distribuidos en 6 semanas (2/sem).
- Cálculo de métricas: **12 sesiones, racha 5, cumplimiento 100%**.
- Nivel resultante: **Constante** (cumple umbrales).
- Progreso al siguiente nivel: **87%**.
- Badges obtenidos: `Primer paso`, `10 sesiones`, `Racha 4 semanas`.
- Pago → marcar como pagado → consulta de `totalReceivedInMonth`.
- Generación de datos demo: **14 alumnos**.

Y **74 asserts** de esquema v2 (32 de categorías, 13 de rachas):
- Round-trip de entradas (snapshots de nombre/grupos, `extra`, `order`).
- Dupe del mismo día → edita el registro existente, no crea otro.
- `lastWeightKg` se **recalcula al guardar** (backdating) y es idempotente.
- El historial sobrevive al borrado del catálogo (borrado suave).
- `deleteTraining` nulifica `trainingId` y deja intactas las entradas.
- El borrador precarga desde la última sesión del alumno.
- CRUD de categorías: nombre recortado, tono inválido cae al primero de `BADGE_TONES`.
- `listTrainings({categoryId})`: **`null` es un filtro real** ("Sin categoría"), y omitir la clave no filtra.
- `updateTraining` sin `categoryId` conserva el anterior; con `categoryId: null` desasigna.
- `groupTrainingsByCategory`: ordena alfabéticamente, deja "Sin categoría" al final y **degrada a ese
  grupo un `categoryId` colgante** en vez de esconder el entrenamiento.
- `deleteCategory` archiva, **no borra ningún entrenamiento**, y los desasigna a `null`.
- El seed demo trae 3 categorías, 3 entrenamientos con categoría válida y 1 sin categoría.

**Rachas (13 asserts)**, todos los fixtures anclados a la semana en curso para que no dependan de la
fecha en que se ejecute:
- 5 semanas seguidas cerradas → 5. Una semana cumplida hoy → cuenta. Semana actual vacía → no rompe.
- **Racha abandonada hace 4+ semanas → 0** (antes salía 5).
- Hueco en medio → rompe y descarta todo lo anterior.
- Una sesión por semana contra meta 2 → 0. Dos contra meta 3 → 0.
- Guarda de zona horaria: una sesión de esta semana lee 1 sea cual sea el offset del host.
- Cumplimiento: 3 semanas de 12 → 25% (antes 100%); 0 asistencias → 0%; la ventana arranca en la
  inscripción.

Resultado: **ALL OK: 74 passed, 0 failed.**

### Integridad de módulos
- `tests/browser-link.mjs` → **30/30 módulos importables** (todos los archivos JS del navegador).
- `tests/audit-imports.mjs` → **OK — all imports resolve to real exports** (atrapa imports colgados
  a servicios que ya no existen, el error típico tras un refactor).
- `tests/globals.mjs` → **OK — 32 módulos sin llamadas a helpers sin importar**. Este chequeo
  encontró un `$$()` sin importar en la vista de entrenamientos: la vista entera habría fallado
  en el navegador y ningún test de Node lo detectaba, porque sólo se rompe al renderizar.
- `tests/css-classes.mjs` → **OK — 263 reglas CSS, toda clase literal en JS existe**. Encontró un
  `stack-1` inexistente (la utilidad real es `stack-2`), que degradaba el layout en silencio.

### Bugs corregidos durante la implementación

| Bug | Impacto |
|---|---|
| `$$()` sin importar en `views/workouts.js` | La vista de entrenamientos no renderizaba |
| Botones ↑ ↓ ✕ del formulario sin wiring (`dataset.i` vs `dataset.entry`) | No se podía reordenar ni quitar ejercicios |
| `exerciseIds` se guardaba en orden de catálogo | Editar un entrenamiento reordenaba el plan sin avisar |
| `$$`/`initialTab` a nivel de módulo | La pestaña del query string sólo funcionaba en la primera navegación |
| Listeners de clic acumulados en nodos que sobreviven al re-render | Guardar 2 veces → "Editar" abría 2 modales apilados |
| Grupos musculares mostraban el valor crudo (`piernas`) | El historial mostraba enums, no etiquetas |
| "Entrenamiento eliminado" también para sesiones libres | Etiqueta incorrecta cuando nunca hubo plantilla |
| `listTrainings({categoryId})` no distinguía `null` de "sin filtro" | El filtro "Sin categoría" devolvía la lista completa |
| Selector de categoría dejaba un entrenamiento invisible | Se seleccionaba un entrenamiento fuera del filtro y quedaba colgado; ahora cae a "Sesión libre" con aviso |
| Racha calculada con `new Date(isoString)` (UTC) mezclado con lecturas locales | Racha una semana corta o en 0 en Chile y el resto del hemisferio oeste; en UTC pasaba |
| Racha anclada en la última asistencia, no en la semana actual | Un alumno que dejaba de venir conservaba su racha indefinidamente |
| Cumplimiento semanal sobre las últimas 12 semanas *con asistencia* | Alumno abandonado con 100% de cumplimiento y, por tanto, nivel inflado |

### Backup/Restore (Node + localStorage shim)
`tests/backup.mjs` ejecuta:
- Export JSON (tamaño verificado).
- Wipe completo.
- Import del mismo archivo (alumno presente).
- Rechazo de archivo de otra app (`app !== "GymTrack"`).
- Rechazo de texto no JSON.

Resultado: **OK.**

### Servidor estático
Probado con `python -m http.server`. Todos los assets (`index.html`, `assets/css/*.css`, `assets/js/**/*.js`, `docs/*.md`) responden con **HTTP 200**.

### Cobertura pendiente (manual / navegador)
- Render visual del dashboard, ficha y formularios (recomendado: abrir en navegador, instalar datos demo desde "Datos y configuración", navegar entre secciones).
- Flujo completo de registro de asistencia: precarga → delta en vivo → añadir/quitar ejercicio → guardar → reabrir.
- **Categorías:** crear una → asignarla a un entrenamiento → comprobar el filtro y los bloques en la
  lista → elegirla en el registro de asistencia y verificar que sólo se ofrecen los de esa categoría →
  borrarla y confirmar que los entrenamientos siguen ahí bajo "Sin categoría".
- Exportación de PDF: usar "Informes → Vista previa → Imprimir / guardar PDF".
- Importación de un Excel de prueba (la app valida y muestra errores por fila).

## 10. Dependencias externas

Todas se cargan vía CDN con versiones fijas:

- **Chart.js 4.4.1** — gráficos (`views.css`/`charts.js`).
- **SheetJS (xlsx) 0.18.5** — import/export Excel.
- **Lucide 0.453.0** — iconografía SVG.
- **Google Fonts (Inter, Manrope, JetBrains Mono)** — tipografía.

Ninguna dependencia es requerida en el repositorio ni necesita build.

## 11. Privacidad y seguridad

- Cero envío de datos a servidores.
- Cero cookies de seguimiento.
- Cero almacenamiento de credenciales o datos bancarios.
- Los identificadores son generados localmente (no se exponen PII).
- Controles anti-XSS: las plantillas usan `esc()` para escapar HTML de entrada del usuario.
- Confirmaciones explícitas para acciones destructivas.
- Botones deshabilitados hasta que la operación sea válida.

---

**GymTrack** — software local de administración. Tus datos son tuyos.
