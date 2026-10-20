# Modelo de datos — GymTrack

> Documentación del esquema completo de datos. La aplicación almacena todo en `localStorage` bajo la clave `gymtrack:db:v2` como un único objeto JSON. Esta página describe cada entidad, sus campos y las relaciones entre ellas.

## Ubicación

- **Clave:** `gymtrack:db:v2`
- **Formato:** JSON serializado (string). El objeto raíz contiene `meta`, `config` y todas las colecciones.
- **Persistencia local:** `localStorage` del navegador. Sin servidor.
- **Archivo de la versión anterior:** `gymtrack:archive:v1` (ver [Migración v1 → v2](#migración-v1--v2)).

## Los tres conceptos (+ la categoría)

La v2 separa tres cosas que antes estaban mezcladas, y la 2.1 agrega una cuarta capa **opcional**
por encima de los entrenamientos:

| Concepto | Colección | Pertenece a un alumno? |
|---|---|---|
| **Categoría de entrenamiento** | `trainingCategories` | No — sólo agrupa |
| **Catálogo de ejercicios** | `exercises` | No — es global y reutilizable |
| **Plantilla de entrenamiento** | `trainings` | No — la comparten todos los alumnos |
| **La sesión realmente realizada** | `attendances[].entries[]` | Sí — es el historial de ese alumno |

El punto donde se unen es el **formulario de asistencia**: eliges alumno + entrenamiento y la app
arma las filas con lo que ese alumno hizo la última vez.

```
trainingCategories ──< trainings.categoryId
                            │
exercises ──< trainings.exerciseIds[]        (N:M, el orden es el índice del array)
                            │
                            │ trainingId
                            ▼
students ──< attendances ──< entries[] ──> exercises  (snapshot: name + muscleGroups)
```

**Qué es y qué no es una categoría.** Es una etiqueta de agrupación para que una lista de
entrenamientos no sea una bolsa única: "Tren superior", "Tren inferior", "Full body", "Cardio".
No tiene ejercicios, ni series, ni semanas, ni progresión, ni fechas — **no es un plan**. Sólo
ordena y filtra. Un entrenamiento puede no tener categoría (`categoryId: null`) y queda bajo el
grupo **Sin categoría**, que siempre se muestra al final.

## Estructura raíz

```jsonc
{
  "meta":   { ... },                // Metadatos de la base
  "config": { ... },                // Configuración global
  "students":            [],        // Alumnos
  "attendances":         [],        // Asistencias registradas (cada una con entries[])
  "exercises":           [],        // Catálogo reutilizable de ejercicios
  "trainings":           [],        // Plantillas de entrenamiento (globales)
  "trainingCategories":  [],        // Agrupación de entrenamientos (añadida en 2.1)
  "measurements":        [],        // Mediciones físicas (peso, medidas, calorías)
  "goals":               [],        // Objetivos individuales
  "payments":            [],        // Pagos / mensualidades
  "notes":               []         // Notas internas del entrenador
}
```

**Eliminadas en v2:** `routines`, `routineExercises` y `performedSessions` (esta última nunca la
escribía ninguna vista).

## `meta`

```json
{
  "version": 2,                     // Versión del esquema de datos
  "appVersion": "2.0.0",            // Versión de la app con que se generó
  "appName": "GymTrack",
  "createdAt": "2026-10-20T...",    // ISO timestamp del primer arranque
  "lastExportAt": null,             // ISO timestamp de la última exportación JSON
  "lastImportAt": null,             // ISO timestamp de la última importación JSON
  "isDemo": false                   // true si se cargaron datos demo
}
```

## `config`

```json
{
  "weekStartDay": 1,                // 0=Domingo, 1=Lunes (configurable)
  "currency": "CLP",                // Moneda
  "defaultWeeklyGoal": 2,           // Frecuencia semanal por defecto
  "gymName": "GymTrack",            // Nombre que aparece en informes
  "theme": "dark"                   // Tema visual
}
```

## Entidades

### `students` — Alumnos

| Campo              | Tipo      | Descripción                                            |
|--------------------|-----------|--------------------------------------------------------|
| `id`               | string    | Identificador único e inmutable (`stu_xxxxxx`).       |
| `firstName`        | string    | Nombre.                                                |
| `lastName`         | string    | Apellido.                                              |
| `phone`            | string    | Teléfono (opcional).                                   |
| `email`            | string    | Email (opcional).                                      |
| `birthdate`        | string    | Fecha de nacimiento `YYYY-MM-DD` (opcional).           |
| `joinedAt`         | string    | Fecha de inscripción `YYYY-MM-DD`.                     |
| `status`           | string    | `active` · `inactive` · `suspended`.                  |
| `sex`              | string    | `F` · `M`. Se usa para los umbrales de índices (ICE, ICC). |
| `heightCm`         | number    | Estatura en cm. Necesaria para el IMC.                 |
| `mainGoal`         | string    | Objetivo principal declarado por el alumno.            |
| `weeklyGoal`       | number    | Frecuencia semanal objetivo (sesiones/sem). Por defecto: 2. |
| `preferredTimes`   | string    | Horarios habituales.                                   |
| `notes`            | string    | Notas internas (no compartibles por defecto).          |
| `membershipStart`  | string    | Inicio de la membresía actual (opcional).             |
| `membershipEnd`    | string    | Vencimiento de la membresía actual (opcional).        |
| `meta`             | object    | `createdAt`, `updatedAt`, `isDemo`.                  |

### `attendances` — Asistencias (con la ejecución)

| Campo       | Tipo     | Descripción                                                       |
|-------------|----------|-------------------------------------------------------------------|
| `id`        | string   | `att_xxxxxx`.                                                    |
| `studentId` | string   | FK → `students.id`.                                              |
| `trainingId`| string   | FK opcional → `trainings.id`. `null` si no se usó plantilla.      |
| `dateISO`   | string   | Fecha de la asistencia `YYYY-MM-DD`.                             |
| `timeISO`   | string   | Hora exacta ISO (timestamp). Desempata sesiones del mismo día.   |
| `type`      | string   | `regular` · `personalizada` · `evaluación`.                     |
| `notes`     | string   | Observaciones de la sesión (opcional).                           |
| `entries`   | object[] | Lo que se hizo. Ver `AttendanceEntry` abajo.                     |
| `meta`      | object   | `createdAt`, `isDemo` (opcional).                                |

> **Duplicidad:** mismo alumno + misma fecha + mismo tipo no puede repetirse. El formulario detecta
> el choque y cae en **modo edición** sobre el registro existente, en vez de descartar en silencio
> lo que el usuario acaba de escribir. La asimetría se resuelve con `timeISO`.

### `AttendanceEntry` — qué se hizo en una sesión

Embebida en `attendances[].entries[]` (no es una colección propia).

| Campo            | Tipo     | Descripción                                                          |
|------------------|----------|----------------------------------------------------------------------|
| `id`             | string   | `ent_xxxxxx`.                                                        |
| `exerciseId`     | string   | FK → `exercises.id`.                                                 |
| `order`          | number   | Posición dentro de la sesión (índice del array).                     |
| `extra`          | boolean  | `true` si **no venía** del entrenamiento: se añadió sólo para hoy.  |
| `name`           | string   | **Snapshot** del nombre al guardar.                                  |
| `muscleGroups`   | string[] | **Snapshot** de los grupos musculares al guardar.                    |
| `sets`           | string   | Series. Texto libre (`4`, `3-4`) — admite rangos.                    |
| `reps`           | string   | Repeticiones o tiempo (`8-10`, `45s`).                               |
| `weightKg`       | number\|null | Peso en kg. `null` = peso corporal (dominadas, plancha…).        |
| `implement`      | string   | `peso_corporal` · `barra` · `mancuernas` · `kettlebell` · `cable` · `maquina` · `bandas` · `otro`. |
| `observation`    | string   | Nota del entrenador sobre ese ejercicio en esa sesión.               |
| `lastWeightKg`   | number\|null | Peso de la sesión anterior del mismo alumno para ese ejercicio. Línea base del delta. |

**Por qué hay snapshots.** `name` y `muscleGroups` están duplicados a propósito: si el ejercicio se
renombra, se le cambian los grupos o se borra del catálogo, el historial sigue mostrando lo que se
hizo ese día. Borrar un ejercicio es un *soft delete* (`status: 'archived'`), nunca un borrado físico.

**`extra` y la plantilla.** Un ejercicio con `extra: true` se añadió en esa sesión concreta.
Editar la lista de ejercicios de un entrenamiento **no toca** las asistencias ya registradas: cada
asistencia guarda su propia copia.

### `exercises` — Catálogo de ejercicios

Global y reutilizable: la misma fila la usan todos los alumnos y todos los entrenamientos.

| Campo          | Tipo     | Descripción                                                       |
|----------------|----------|-------------------------------------------------------------------|
| `id`           | string   | `exc_xxxxxx`.                                                    |
| `name`         | string   | Nombre del ejercicio.                                            |
| `observation`  | string   | Notas técnicas (opcional).                                       |
| `muscleGroups` | string[] | Uno o varios de la lista cerrada. Ver abajo.                     |
| `status`       | string   | `active` · `archived`.                                           |
| `createdAt`    | string   | `YYYY-MM-DD`.                                                    |
| `meta`         | object   | `createdAt`, `isDemo`.                                           |

**Grupos musculares** — lista cerrada en `config.js` (`MUSCLE_GROUPS`):

| value | Etiqueta | color |
|---|---|---|
| `piernas` | Piernas | `accent` |
| `core` | Core | `info` |
| `espalda` | Espalda | `success` |
| `brazos` | Brazos | `warning` |

Un ejercicio puede estar en **varios** a la vez (Dominadas → `espalda` + `brazos`), cosa que el
modelo v1 no podía expresar porque guardaba un único string.

### `trainingCategories` — Categorías de entrenamiento (2.1)

Colección **gestionable** (CRUD completo desde *Entrenamientos → Categorías*), no una lista fija en
config. Agrupa rutinas; no lleva ejercicios ni datos de ejecución.

| Campo         | Tipo     | Descripción                                                              |
|---------------|----------|--------------------------------------------------------------------------|
| `id`          | string   | `cat_xxxxxx`.                                                            |
| `name`        | string   | Etiqueta ("Tren superior"). Se recorta a 60 caracteres.                  |
| `observation` | string   | Nota descriptiva de la categoría.                                        |
| `color`       | string   | Tono de badge: `accent` · `info` · `success` · `warning` · `muted`.     |
| `status`      | string   | `active` · `archived`.                                                   |
| `createdAt`   | string   | `YYYY-MM-DD`.                                                            |
| `meta`        | object   | `createdAt`, `isDemo`.                                                   |

`trainings.categoryId` es un FK opcional a esta colección; `null` significa "Sin categoría".

**Al borrar una categoría** se archiva (`status: 'archived'`) y se pone `categoryId: null` en los
entrenamientos que la referencian. **Nunca se borra un entrenamiento por reagrupar**: todos caen al
grupo "Sin categoría", que sigue siendo visible y editable.

Un `categoryId` que apunta a una categoría ya borrada a mano (editando el JSON) no rompe nada: la
agrupación lo trata como `null` en vez de dejar el entrenamiento invisible.

### `trainings` — Entrenamientos (plantillas)

Plantillas **globales**. No tienen `studentId`: la misma la usan todos los alumnos que quieran.

| Campo         | Tipo     | Descripción                                                       |
|---------------|----------|-------------------------------------------------------------------|
| `id`          | string   | `trn_xxxxxx`.                                                    |
| `name`        | string   | Nombre del entrenamiento.                                         |
| `categoryId`  | string?  | FK → `trainingCategories.id`. `null` = Sin categoría.             |
| `objective`   | string   | Objetivo (Hipertrofia, Resistencia, Potencia…).                  |
| `observation` | string   | Indicaciones generales para la sesión.                           |
| `exerciseIds` | string[] | FKs → `exercises.id`. **El índice del array es el orden.**        |
| `status`      | string   | `active` · `archived`.                                           |
| `createdAt`   | string   | `YYYY-MM-DD`.                                                    |
| `meta`        | object   | `createdAt`, `isDemo`.                                           |

> No hay campo `order` para los ejercicios: el orden es la posición en `exerciseIds`. Agregar al
> final, mover con los botones ↑ ↓.

`listTrainings({ categoryId })` filtra por categoría. Ojo con el sentinel: **`categoryId: null` es un
filtro real** ("Sin categoría"), por eso la función sólo omite el filtro cuando la clave no viene
en el objeto de opciones.

**Al borrar un entrenamiento** se pone `trainingId: null` en las asistencias que lo referencian y
se conservan sus `entries`. El historial no se pierde; sólo el título del entrenamiento pasa a
leerse como "Entrenamiento eliminado".

### `measurements` — Mediciones físicas

Cada medición lleva todos los campos opcionales; se admiten nulos.

| Campo          | Tipo     | Unidad | Descripción                          |
|----------------|----------|--------|--------------------------------------|
| `id`           | string   | —      | `mea_xxxxxx`.                       |
| `studentId`    | string   | —      | FK → `students.id`.                 |
| `date`         | string   | —      | Fecha `YYYY-MM-DD`.                 |
| `weightKg`     | number   | kg     | Peso corporal.                       |
| `waistCm`      | number   | cm     | Cintura.                            |
| `hipCm`        | number   | cm     | Cadera.                              |
| `chestCm`      | number   | cm     | Pecho.                               |
| `armLeftCm`    | number   | cm     | Brazo izquierdo.                    |
| `armRightCm`   | number   | cm     | Brazo derecho.                      |
| `thighLeftCm`  | number   | cm     | Muslo izquierdo.                    |
| `thighRightCm` | number   | cm     | Muslo derecho.                      |
| `sessionKcal`  | number   | kcal   | Calorías estimadas de una sesión.   |
| `notes`        | string   | —      | Notas de la medición.               |
| `meta`         | object   | —      | `createdAt`, `isDemo`.             |

> Las mediciones nunca se interpolan. Si falta un valor, el gráfico deja un hueco para mantener la integridad del registro.

### `goals` — Objetivos

| Campo         | Tipo     | Descripción                                |
|---------------|----------|--------------------------------------------|
| `id`          | string   | `goal_xxxxxx`.                            |
| `studentId`   | string   | FK → `students.id`.                       |
| `type`        | string   | `weight` · `measurement` · `attendance` · `custom`. |
| `title`       | string   | Título del objetivo.                       |
| `description` | string   | Descripción libre.                          |
| `targetValue` | number   | Valor numérico (si aplica).                |
| `unit`        | string   | `kg` · `cm` · `%` · `sesiones/sem` · `otro`. |
| `targetDate`  | string   | Fecha objetivo `YYYY-MM-DD`.              |
| `status`      | string   | `active` · `achieved` · `abandoned`.     |
| `createdAt`   | string   | Fecha de creación.                        |

### `payments` — Pagos / Mensualidades

| Campo        | Tipo     | Descripción                                            |
|--------------|----------|--------------------------------------------------------|
| `id`         | string   | `pay_xxxxxx`.                                        |
| `studentId`  | string   | FK → `students.id`.                                   |
| `period`     | string   | Texto libre (`"Marzo 2026"`).                         |
| `amount`     | number   | Monto en CLP.                                         |
| `dueDate`    | string   | `YYYY-MM-DD`.                                        |
| `status`     | string   | `pending` · `paid` · `overdue`.                     |
| `paidAt`     | string   | ISO timestamp cuando se marcó como pagado.           |
| `method`     | string   | Texto libre (`"Transferencia"`, `"Efectivo"`...).    |
| `notes`      | string   | Notas.                                                |
| `meta`       | object   | `createdAt`.                                          |

> El sistema recalcula automáticamente el estado `overdue` al abrir la app, comparando `dueDate` con la fecha actual. Los pagos `pending` con `dueDate` pasada pasan a `overdue` automáticamente.

### `notes` — Notas internas

| Campo       | Tipo     | Descripción                                              |
|-------------|----------|----------------------------------------------------------|
| `id`        | string   | `nt_xxxxxx`.                                           |
| `studentId` | string   | FK → `students.id`.                                     |
| `author`    | string   | Autor (típicamente `admin`).                            |
| `category`  | string   | `general` · `progreso` · `salud` · `técnica` · `otro`. |
| `body`      | string   | Texto de la nota.                                       |
| `shared`    | boolean  | Si es `true` puede incluirse en informes compartibles.  |
| `createdAt` | string   | ISO timestamp.                                          |
| `updatedAt` | string   | ISO timestamp.                                          |

> Por defecto las notas NO aparecen en los informes compartidos con alumnos; sólo cuando el administrador marca explícitamente la sección "Notas del entrenador" al construir el informe.

## Precarga desde el historial

Al abrir el formulario de asistencia con alumno + entrenamiento + fecha, la app arma una fila por
ejercicio del entrenamiento. Toda la lógica vive en `services/entries.js`, que es **puro** (sin DOM
ni `localStorage`) y por eso se testea headless con `node tests/entries.mjs`.

### `priorEntriesIndex(attendances, { studentId, beforeISO, excludeAttendanceId })`

Devuelve `Map<exerciseId, entry>` con la última ejecución conocida de cada ejercicio. Reglas:

- Sólo asistencias del mismo `studentId`.
- **Estrictamente anteriores:** `dateISO < beforeISO`. El formato `YYYY-MM-DD` ordena
  lexicográficamente, así que la comparación de strings es correcta.
- Los empates dentro del mismo día se resuelven por `timeISO`.
- `excludeAttendanceId` evita la autorreferencia al editar una sesión existente.
- Gana la más reciente (el primero que se encuentra al recorrer de más nuevo a más viejo).

### `buildDraftEntries({ attendances, exercises, training, studentId, dateISO, excludeAttendanceId })`

Genera las filas del formulario:

- Recorre `training.exerciseIds` **en orden**.
- La **prescripción** (series, reps, peso, implemento) viene **del historial**, nunca del catálogo.
  El catálogo no prescribe nada: describe el ejercicio, no lo que este alumno puede levantar hoy.
- La **identidad** (`name`, `muscleGroups`) viene del catálogo si el ejercicio sigue ahí; si no, del
  snapshot de la última ejecución.
- `lastWeightKg` = el peso de la sesión anterior para ese ejercicio, o `null` en la primera vez.
- Sin entrenamiento elegido no hay filas: el entrenador añade lo que corresponda.

## Delta de peso

`weightDelta(current, previous)` → `{ kg, pct, text, tone }`. Es **la única** fuente de verdad del
delta: la usan el formulario, la pestaña Entrenamientos de la ficha, los informes y la exportación
Excel. El Excel no puede contradecir a la pantalla porque llama a la misma función.

| Caso | Texto | Tono |
|---|---|---|
| Sin peso actual o sin registro previo | `— sin registro previo` | apagado |
| Sin cambio | `0 kg · sin cambio` | apagado |
| Subió | `+5 kg · +8%` | verde |
| Bajó | `-2.5 kg · -3%` | rojo |
| Previo = 0 | `+5 kg` (sin porcentaje) | verde |

Reglas de formato, deliberadas:

- **Punto decimal, no coma.** `toLocaleString('es-CL')` rinde `2,5`; para los números que se
  comparan con el input y con el Excel tiene que ser `2.5`.
- **Porcentaje entero** (`Math.round`), no con decimales: `+8%` se lee de un vistazo, `+8,33%` no.
- **Sin porcentaje si el previo es 0** (división por cero).

**`lastWeightKg` se recalcula al guardar, no se congela al crear.** `saveAttendance()` vuelve a
indexar el historial antes de cada escritura. Así, si registras una sesión con fecha retroactiva
—hoy, para la semana pasada— y después vuelves a guardar la sesión que estaba después, su línea
base se corrige sola. Congelarla produciría deltas mentirosos justo en el caso donde más importan.

## Sistema de niveles (gamificación)

GymTrack premia exclusivamente la constancia. Hay cinco niveles: Principiante, Constante, Comprometido, Disciplinado y Referente. Los umbrales están en `assets/js/config.js` en la constante `LEVELS`. Cada nivel exige simultáneamente:

- `totalAttendances` acumulado
- `streakWeeks` (semanas consecutivas cumpliendo la meta)
- `weeklyCompliance` (proporción de semanas cumplidas, considerando 12 semanas cerradas)

Reglas importantes:

- Una asistencia válida se cuenta una sola vez.
- Las semanas futuras nunca cuentan como incumplidas.
- Solo se otorgan niveles cuando **todos** los umbrales del nivel se cumplen.
- La medición física (peso, medidas) **nunca** afecta el nivel.
- Las rachas comienzan a contarse desde la semana más reciente con asistencia, retrocediendo mientras la semana haya cumplido la meta.

## Insignias (badges)

Independientes del nivel. Lista en `config.js`:

- `Primer paso`: primera asistencia.
- `10 / 50 sesiones`: hitos de cantidad.
- `Racha 4 / 8 / 12 semanas`: constancia consecutiva.
- `Medición 3`: tres mediciones registradas.
- `Objetivo fijado`: el alumno tiene al menos un objetivo.

## Migración v1 → v2

Es una migración **destructiva por diseño**. La v1 ataba el entrenamiento al alumno y no guardaba
la ejecución; la v2 separa los tres conceptos. Convertir automáticamente sería inventar datos que
el usuario nunca registró, así que la app **no lo intenta**.

Al arrancar la v2 con una base v1 presente, `archiveLegacyIfPresent()` hace exactamente una vez:

1. Lee `gymtrack:db:v1`.
2. Guarda en `gymtrack:archive:v1` un sobre `{ app, archivedAt, fromSchema, reason, counts, raw }`
   donde **`raw` es el string original byte-idéntico**.
3. Borra `gymtrack:db:v1`.
4. La v2 se crea vacía y se muestra un modal one-shot con los conteos y un botón de descarga.

Si `gymtrack:db:v2` ya existe, **nunca** se toca la v1 (arrancar dos veces no rompe nada).

### Gestión del archivo

Desde **Datos y configuración → Archivo de la versión anterior (v1)**, sólo visible si hay archivo:

| Acción | Efecto |
|---|---|
| **Descargar copia v1** | `gymtrack_v1_<fecha>.json` con el contenido byte-idéntico. |
| **Restaurar clave v1** | Reescribe `gymtrack:db:v1` para abrirla con GymTrack 1.x. **No toca la v2.** |
| **Eliminar archivo** | Borra `gymtrack:archive:v1`. Irreversible. |

`importJSON()` rechaza respaldos con `schemaVersion < 2` y dice explícitamente dónde está la copia
en vez de intentar una conversión imposible.

## Respaldo

La exportación a JSON guarda todas las colecciones más `meta` y `config`. El archivo contiene además `app`, `schemaVersion`, `appVersion`, `exportedAt` para validar identidad.

La importación valida:

1. Que sea JSON parseable.
2. Que `app === "GymTrack"`.
3. Que `schemaVersion` sea un número y no sea mayor a la versión actual.
4. Que exista la sección `data` y todas las colecciones requeridas.

Si el esquema es más nuevo (futuro), se rechaza. Si es más viejo (v1), se rechaza con un mensaje
que apunta al bloque de archivo histórico. Dentro de la misma versión, las colecciones que falten
se rellenan vacías al cargar.

## Privacidad

La aplicación no envía datos a ningún servidor. Toda la información reside en el navegador donde se utiliza. Borrar los datos del sitio, cambiar de navegador o de dispositivo puede implicar la pérdida de información si no se ha descargado un respaldo.
