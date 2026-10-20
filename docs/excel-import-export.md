# Importación y exportación Excel — GymTrack

GymTrack usa [SheetJS (xlsx)](https://sheetjs.com/) para leer y generar hojas de cálculo **dentro del navegador**, sin necesidad de un servidor. Toda la operación es local.

## Formato general

- Archivos en formato **`.xlsx`** (Office Open XML).
- Fechas en formato `YYYY-MM-DD` (ISO).
- Textos sin formato especial.
- Números en formato numérico plano (no dejes texto).
- Códigos de estado:
  - Alumnos: `active`, `inactive`, `suspended`
  - Pagos: `pending`, `paid`, `overdue`
- La primera fila siempre es la de encabezados.

## Plantillas

Puedes descargar plantillas pre-armadas desde **Datos y configuración → Excel → Plantillas**:

- **Plantilla alumnos**: `gymtrack_plantilla_alumnos.xlsx`
- **Plantilla mediciones**: `gymtrack_plantilla_mediciones.xlsx`

Ambas incluyen una fila de ejemplo (recomendable borrarla al subir datos reales).

## Alumnos

### Columnas (orden recomendado)

| Columna                              | Requerido | Descripción                              |
|--------------------------------------|-----------|------------------------------------------|
| `Nombre*`                            | sí        | Nombre del alumno.                       |
| `Apellido`                           | no        | Apellido.                                |
| `Email`                              | no        | Email.                                   |
| `Teléfono`                           | no        | Teléfono (texto).                        |
| `Fecha nacimiento (YYYY-MM-DD)`      | no        | Fecha de nacimiento.                     |
| `Fecha inscripción (YYYY-MM-DD)`     | sí        | Fecha de alta.                          |
| `Estado`                             | no        | `active`, `inactive`, `suspended`.       |
| `Objetivo principal`                 | no        | Texto libre.                             |
| `Meta semanal (sesiones)`            | no        | Entero (1–14).                          |
| `Horarios habituales`                | no        | Texto libre.                             |

### Proceso

1. **Datos y configuración → Excel → Plantilla alumnos**.
2. Completa la hoja respetando encabezados.
3. **Datos y configuración → Excel → Importar alumnos**.
4. Se mostrará un resumen: creados, omitidos (duplicados por nombre), errores por fila.

> Los duplicados se detectan por nombre + apellido. Si el alumno ya existe, se omite silenciosamente.

## Mediciones

### Columnas

| Columna                                | Requerido | Descripción                                           |
|----------------------------------------|-----------|-------------------------------------------------------|
| `ID Alumno*`                           | sí        | ID del alumno (o usa `Alumno (texto)` con su nombre). |
| `Alumno (texto)`                       | no        | Alternativa al ID: nombre completo.                   |
| `Fecha (YYYY-MM-DD)*`                  | sí        | Fecha de la medición.                                 |
| `Peso (kg)`                            | no        | Numérico.                                             |
| `Cintura (cm)`                         | no        | Numérico.                                             |
| `Cadera (cm)`                          | no        | Numérico.                                             |
| `Pecho (cm)`                           | no        | Numérico.                                             |
| `Brazo izquierdo (cm)`                 | no        | Numérico.                                             |
| `Brazo derecho (cm)`                   | no        | Numérico.                                             |
| `Muslo izquierdo (cm)`                 | no        | Numérico.                                             |
| `Muslo derecho (cm)`                   | no        | Numérico.                                             |
| `Calorías sesión (kcal)`               | no        | Numérico.                                             |
| `Notas`                                | no        | Texto libre.                                          |

> Todas las mediciones son opcionales excepto alumno y fecha. Una medición sin valores numéricos se registrará de todas formas para no perder la fecha.

## Exportaciones rápidas

Desde **Datos y configuración → Excel → Exportar** puedes descargar:

- `Alumnos` → `gymtrack_alumnos_<fecha>.xlsx`
- `Asistencias` → `gymtrack_asistencias_<fecha>.xlsx`
- `Mediciones` → `gymtrack_mediciones_<fecha>.xlsx`
- `Pagos` → `gymtrack_pagos_<fecha>.xlsx`
- `Entrenamientos` → `gymtrack_entrenamientos_<fecha>.xlsx` (con hojas Rutinas y Ejercicios)

## Cómo se comporta la importación

- **Nunca reemplaza automáticamente** tu base de datos. Sólo añade registros nuevos.
- Los registros se importan **uno por uno**, marcando los errores por fila (sin aplicar parcialmente).
- Si la hoja tiene errores críticos (formato inválido, falta de columnas requeridas), la importación se cancela.
- Para sobrescribir todos los datos y reemplazarlos por otro respaldo completo, usa **Restaurar desde archivo** en la sección de Respaldo.

## Fechas

La aplicación acepta fechas en:

- `YYYY-MM-DD` (preferido)
- `DD/MM/YYYY` o `DD-MM-YYYY`
- Números seriales de Excel (se convierten automáticamente)

Si la fecha es ambigua o no se reconoce, se marcará la fila como error.

## Limitaciones

- No hay sincronización permanente con Excel. Es un intercambio de archivos: **se descarga una copia nueva o se importa el archivo seleccionado**. Los cambios posteriores al archivo Excel no se reflejan en la app.
- El tamaño máximo del archivo depende del navegador, pero la app maneja normalmente varios miles de filas.
- SheetJS es muy tolerante con formatos; aún así se recomienda mantener el orden de columnas.

## Ejemplo de flujo: subir nuevos alumnos

1. Abre **Datos y configuración**.
2. Haz clic en **Plantilla alumnos** — se descarga `gymtrack_plantilla_alumnos.xlsx`.
3. Abre la plantilla en Excel u otra hoja de cálculo.
4. Completa las filas. La primera fila (ejemplo) puede eliminarse.
5. Guarda el archivo.
6. Regresa a GymTrack y haz clic en **Importar alumnos** → selecciona el archivo.
7. Verás un cuadro con la cantidad de registros creados, filas omitidas (duplicadas) y, si los hay, errores por fila.

## Ejemplo de flujo: registrar 30 mediciones

1. Descarga **Plantilla mediciones**.
2. Pega o escribe los valores. Asegúrate de que cada fila tenga al menos el ID del alumno (o nombre completo) y la fecha.
3. Importa el archivo y revisa el resumen. Las mediciones anteriores a la fecha actual también se admiten (carga histórica).
4. Al volver a la ficha del alumno verás las nuevas mediciones.

## Privacidad

Los archivos Excel nunca salen del navegador: las importaciones se procesan localmente y las exportaciones se descargan directamente desde la página. No se sube nada a ningún servidor.
