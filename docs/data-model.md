# Modelo de datos — GymTrack

> Documentación del esquema completo de datos. La aplicación almacena todo en `localStorage` bajo la clave `gymtrack:db:v1` como un único objeto JSON. Esta página describe cada entidad, sus campos y las relaciones entre ellas.

## Ubicación

- **Clave:** `gymtrack:db:v1`
- **Formato:** JSON serializado (string). El objeto raíz contiene `meta`, `config` y todas las colecciones.
- **Persistencia local:** `localStorage` del navegador. Sin servidor.

## Estructura raíz

```jsonc
{
  "meta":   { ... },                // Metadatos de la base
  "config": { ... },                // Configuración global
  "students":            [],        // Alumnos
  "attendances":         [],        // Asistencias registradas
  "routines":            [],        // Plantillas de rutina
  "routineExercises":    [],        // Ejercicios que componen cada rutina
  "performedSessions":   [],        // Sesiones efectivamente realizadas (historial)
  "measurements":        [],        // Mediciones físicas (peso, medidas, calorías)
  "goals":               [],        // Objetivos individuales
  "payments":            [],        // Pagos / mensualidades
  "notes":               []         // Notas internas del entrenador
}
```

## `meta`

```json
{
  "version": 1,                     // Versión del esquema de datos
  "appVersion": "1.0.0",            // Versión de la app con que se generó
  "appName": "GymTrack",
  "createdAt": "2026-10-14T...",    // ISO timestamp del primer arranque
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
| `mainGoal`         | string    | Objetivo principal declarado por el alumno.            |
| `weeklyGoal`       | number    | Frecuencia semanal objetivo (sesiones/sem). Por defecto: 2. |
| `preferredTimes`   | string    | Horarios habituales.                                   |
| `notes`            | string    | Notas internas (no compartibles por defecto).          |
| `membershipStart`  | string    | Inicio de la membresía actual (opcional).             |
| `membershipEnd`    | string    | Vencimiento de la membresía actual (opcional).        |
| `meta`             | object    | `createdAt`, `updatedAt`, `isDemo`.                  |

### `attendances` — Asistencias

| Campo       | Tipo   | Descripción                                                  |
|-------------|--------|--------------------------------------------------------------|
| `id`        | string | `att_xxxxxx`.                                               |
| `studentId` | string | FK → `students.id`.                                         |
| `dateISO`   | string | Fecha de la asistencia `YYYY-MM-DD`.                        |
| `timeISO`   | string | Hora exacta ISO (timestamp).                                |
| `type`      | string | `regular` · `personalizada` · `evaluación`.                |
| `notes`     | string | Observaciones (opcional).                                   |
| `meta`      | object | `createdAt`, `isDemo` (opcional).                           |

> La duplicidad (mismo alumno + misma fecha + mismo tipo) se evita automáticamente.

### `routines` — Rutinas (plantillas)

| Campo       | Tipo   | Descripción                                                  |
|-------------|--------|--------------------------------------------------------------|
| `id`        | string | `rut_xxxxxx`.                                               |
| `studentId` | string | FK → `students.id` (puede ser null = plantilla global).      |
| `name`      | string | Nombre de la rutina.                                         |
| `objective` | string | Objetivo (Hipertrofia, Resistencia, etc.).                   |
| `status`    | string | `active` · `archived`.                                     |
| `createdAt` | string | `YYYY-MM-DD`.                                              |
| `meta`      | object | `createdAt`, `isDemo`.                                     |

### `routineExercises` — Ejercicios de una rutina

| Campo          | Tipo   | Descripción                                        |
|----------------|--------|----------------------------------------------------|
| `id`           | string | `exr_xxxxxx`.                                     |
| `routineId`    | string | FK → `routines.id`.                               |
| `name`         | string | Nombre del ejercicio.                              |
| `muscleGroup`  | string | Grupo muscular (Pecho, Espalda, etc.).            |
| `sets`         | string | Series (texto libre: `4`, `3-4`).                 |
| `reps`         | string | Repeticiones / tiempo (`8-10`, `45s`).           |
| `durationSec`  | string | Duración si aplica (segundos).                    |
| `weightKg`     | string | Peso (texto libre).                                |
| `restSec`      | string | Descanso (segundos).                               |
| `instructions` | string | Notas técnicas.                                    |
| `notes`        | string | Notas libres.                                      |
| `order`        | number | Posición dentro de la rutina.                      |

### `performedSessions` — Sesiones realizadas

| Campo          | Tipo     | Descripción                                  |
|----------------|----------|----------------------------------------------|
| `id`           | string   | `ses_xxxxxx`.                              |
| `studentId`    | string   | FK → `students.id`.                         |
| `routineId`    | string   | FK opcional a `routines.id`.                |
| `name`         | string   | Nombre de la sesión.                        |
| `date`         | string   | `YYYY-MM-DD` en que se realizó.             |
| `durationMin`  | string   | Duración en minutos.                        |
| `notes`        | string   | Notas.                                       |
| `entries`      | object[] | Ejercicios efectivamente realizados.         |

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

## Respaldo

La exportación a JSON guarda todas las colecciones más `meta` y `config`. El archivo contiene además `app`, `schemaVersion`, `appVersion`, `exportedAt` para validar identidad.

La importación valida:

1. Que sea JSON parseable.
2. Que `app === "GymTrack"`.
3. Que `schemaVersion` no sea mayor a la versión actual.
4. Que existan todas las colecciones requeridas.

Si la versión del esquema es más antigua y compatible, se aplican migraciones mínimas (rellenar campos faltantes). Si la versión es del futuro, se rechaza la importación.

## Privacidad

La aplicación no envía datos a ningún servidor. Toda la información reside en el navegador donde se utiliza. Borrar los datos del sitio, cambiar de navegador o de dispositivo puede implicar la pérdida de información si no se ha descargado un respaldo.
