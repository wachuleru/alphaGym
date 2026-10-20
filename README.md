# GymTrack

Plataforma de administración y seguimiento para gimnasios. Permite registrar alumnos, controlar asistencia, asignar rutinas, seguir progreso físico, gestionar mensualidades, generar informes imprimibles y respaldar toda la información — todo desde el navegador, sin backend.

## Características

- 👥 Gestión completa de alumnos con perfil, objetivos y notas
- 📅 Registro y consulta de asistencia con historial detallado
- 🏋️ Rutinas, ejercicios y sesiones realizadas
- 📏 Mediciones físicas (peso, medidas, calorías) con gráficos históricos
- 🎯 Objetivos individuales configurables
- 💳 Pagos, mensualidades, vencimientos e ingresos
- 🏆 Sistema de niveles por constancia e insignias por hitos
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
    └── js/
        ├── config.js         Constantes, niveles por defecto
        ├── storage.js        Capa de persistencia localStorage
        ├── utils.js          Utilidades (fecha, formato, DOM, IDs)
        ├── icons.js          Lucide helpers
        ├── state.js          Estado en memoria + pub/sub
        ├── router.js         Router por hash
        ├── app.js            Punto de entrada
        ├── services/         Lógica de dominio (students, attendance, etc.)
        └── views/            Vistas (dashboard, students, etc.)
```

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

- Los datos se guardan en `localStorage` bajo la clave `gymtrack:db:v1`.
- Toda la app se ejecuta en este navegador. Cambiar de navegador o borrar datos del sitio elimina la información.
- Usa **Datos y configuración → Exportar base de datos** para descargar un JSON completo antes de borrar datos o cambiar de equipo.
- Puedes cargar datos demo desde la misma pantalla (se identifican claramente y pueden borrarse después).

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
