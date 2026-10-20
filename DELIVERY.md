# GymTrack — Resumen de entrega

## 1. Lo que se implementó

Una aplicación web estática para la administración completa de un gimnasio. **Sin backend, sin frameworks pesados, sin build step**. Todo se ejecuta en el navegador y persiste en `localStorage`.

### Identidad visual

Diseño propio "Sport Premium" — fondo midnight navy (`#0a1124`), acento dorado-ámbar (`#f4c662`), superficie elevada con sombras suaves. Tipografía: **Inter** (UI), **Manrope** (display), **JetBrains Mono** (números). Iconografía coherente con Lucide en todo el sistema.

### Módulos funcionales entregados

| Módulo | Estado | Descripción |
|---|---|---|
| **Dashboard** | ✅ | Cabecera contextual (saludo, fecha, accesos rápidos), 4 KPIs principales (alumnos activos, asistencia hoy, ingresos del mes, cumplimiento), gráfico principal de asistencia semanal, actividad reciente, sección "necesitan atención", gráfico de alumnos activos (6 meses), ingresos por período (6 meses), distribución de niveles (doughnut), barra de pagos y próximos vencimientos |
| **Alumnos** | ✅ | Listado en grid con búsqueda, filtros (estado, nivel, pagos) y creación/edición. Avatares con iniciales, niveles visuales, próximas mensualidades, frecuencia semanal |
| **Ficha de alumno** | ✅ | Cabecera con datos, 4 KPIs, pestañas: Resumen · Asistencia · Entrenamientos · Progreso físico · Objetivos · Pagos · Notas · Nivel y logros |
| **Asistencia (global)** | ✅ | KPIs (hoy, semana, mes, top asistentes del mes), gráfico de 30 días, panel "hoy en el gimnasio", historial con búsqueda, registro rápido, exportación Excel |
| **Entrenamientos** | ✅ | CRUD de rutinas y ejercicios. Asignación a alumnos. Ejercicios con series, reps, peso, descanso, instrucciones |
| **Progreso físico** | ✅ | Gráficos globales de peso promedio y calorías por sesión, tabla "último registro por alumno" |
| **Mediciones en ficha** | ✅ | Gráfico histórico por métrica, selector, comparativa entre primera y última lectura, tabla historial completa |
| **Objetivos** | ✅ | CRUD por alumno, con tipo, valor meta, unidad, fecha objetivo, estado |
| **Pagos (global)** | ✅ | KPIs (ingresos, pendiente, vencido, total), gráfico de ingresos 6 meses, tabla con filtros y pago directo |
| **Informes individuales** | ✅ | Constructor con selección de alumno, período, secciones a incluir y comentario del entrenador. Vista previa imprimible. Estilos específicos para impresión (`print.css`). Listas para guardar como PDF desde el navegador |
| **Datos y configuración** | ✅ | Estado del almacenamiento, exportación JSON, restauración con validación y resumen, exportar/importar Excel (varias entidades), plantillas, datos de demostración instalables y removibles, zona peligrosa |
| **Sistema de niveles** | ✅ | 5 niveles (Principiante → Referente). Evaluación exclusiva por **constancia** (total, racha, cumplimiento). Mediciones nunca afectan el nivel. Progreso al siguiente nivel. Insignias (8) por hitos |
| **Respaldo** | ✅ | JSON completo, validación, migración mínima, metadatos de versión |

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
│       ├── config.js                       # Constantes: niveles, badges, default weekly goal
│       ├── utils.js                        # Helpers: fechas, IDs, formato, DOM, validación
│       ├── storage.js                      # Capa única de persistencia localStorage
│       ├── icons.js                        # Lucide helpers
│       ├── router.js                       # Hash router
│       ├── charts.js                       # Wrapper Chart.js con tema oscuro
│       ├── components.js                   # Toasts y modales
│       ├── app.js                          # Bootstrap y registro de rutas
│       ├── services/
│       │   ├── students.js                 # CRUD alumnos
│       │   ├── attendance.js               # CRUD asistencia
│       │   ├── workouts.js                 # Rutinas, ejercicios, sesiones
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
│           ├── workouts.js                 # Vista global de rutinas
│           ├── progress.js                 # Vista global de progreso físico
│           ├── payments.js                 # Vista global de pagos
│           ├── reports.js                  # Generador de informes imprimibles
│           └── settings.js                 # Datos, respaldo, Excel, demo
└── tests/
    ├── smoke.mjs                           # Smoke test (módulos importables)
    ├── logic.mjs                           # Test de niveles, pagos, seed
    └── backup.mjs                          # Test de backup/restore con validación
```

**Total:** 9 módulos JS base + 12 servicios + 9 vistas + 5 CSS + 2 docs. Más de 9.000 líneas.

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

- Esquema raíz completo (`meta`, `config`, todas las colecciones).
- Tablas por entidad con tipo y descripción de cada campo.
- Reglas del sistema de niveles (constantes en `LEVELS`).
- Reglas de migración y validación para respaldos.
- Sección de privacidad.

## 6. Importación / exportación Excel

Ver [docs/excel-import-export.md](docs/excel-import-export.md). Cubre:

- Plantillas y columnas para alumnos y mediciones.
- Proceso paso a paso de importación y exportación.
- Validación aplicada (duplicados, errores por fila, sin reemplazo silencioso).
- Formatos de fecha aceptados.
- Limitaciones importantes (no hay sincronización bidireccional).

## 7. Respaldo y restauración

- **Exportar (JSON):** desde "Datos y configuración → Respaldo → Exportar base de datos". Genera un archivo `gymtrack_respaldo_<fecha>.json` con todas las colecciones + metadatos (`app`, `schemaVersion`, `appVersion`, `exportedAt`).
- **Restaurar (JSON):** desde "Datos y configuración → Restpaldo → Restaurar desde archivo". La app valida origen, versión, formato y muestra un resumen antes de pedir confirmación explícita. Si algo falla, los datos existentes quedan intactos.
- **Migración:** cuando el archivo es de una versión menor del esquema, se rellenan campos faltantes automáticamente.

## 8. Limitaciones conocidas

- **Aplicación local.** No sincroniza entre dispositivos. Para mover la información entre dispositivos se usa el respaldo JSON.
- **Datos atados al navegador.** Si el usuario borra los datos del sitio (`localStorage.clear()`), cambia de navegador o de equipo, puede perder la información si no tiene un respaldo.
- **Sin autenticación multiusuario.** No hay roles ni inicio de sesión. Está diseñado para uso por un único administrador.
- **Informes vía impresión del navegador.** El envío a alumnos se hace manualmente (descargar PDF / imprimir y compartir). No hay integración automática con email o WhatsApp.
- **Reconocimiento inteligente no destructivo.** No interpolamos valores faltantes en gráficos de mediciones: si falta una fecha, el gráfico muestra un hueco honesto.
- **Hojas Excel:** se importan como copia; los cambios posteriores en el archivo Excel no se reflejan automáticamente.
- **Notas internas en informes compartidos:** están desactivadas por defecto. Solo aparecen si el administrador activa explícitamente la sección "Notas del entrenador" al construir el informe, y la nota tiene `shared: true`.

## 9. Pruebas realizadas

### Sintaxis
- `node --check` sobre **todos** los módulos JS. Resultado: **0 errores**.

### Lógica (Node + localStorage shim)
`tests/logic.mjs` ejecuta:
- Creación de alumno.
- 12 registros de asistencia distribuidos en 6 semanas (2/sem).
- Cálculo de métricas: **12 sesiones, racha 5, cumplimiento 100%**.
- Nivel resultante: **Constante** (cumple umbrales).
- Progreso al siguiente nivel: **87%**.
- Badges obtenidos: `Primer paso`, `10 sesiones`, `Racha 4 semanas`.
- Pago → marcar como pagado → consulta de `totalReceivedInMonth`.
- Generación de datos demo: **14 alumnos, 265 asistencias**.

Resultado: **OK**.

### Backup/Restore (Node + localStorage shim)
`tests/backup.mjs` ejecuta:
- Export JSON (tamaño verificado).
- Wipe completo.
- Import del mismo archivo (alumno presente).
- Rechazo de archivo de otra app (`app !== "GymTrack"`).
- Rechazo de texto no JSON.

Resultado: **OK**.

### Servidor estático
Probado con `python -m http.server`. Todos los assets (`index.html`, `assets/css/*.css`, `assets/js/**/*.js`, `docs/*.md`) responden con **HTTP 200**.

### Cobertura pendiente (manual / navegador)
- Render visual del dashboard, ficha y formularios (recomendado: abrir en navegador, instalar datos demo desde "Datos y configuración", navegar entre secciones).
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
