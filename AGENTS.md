# Reglas y Arquitectura de Proyecto para Antigravity IDE: **RH BRINNERCAS**

Este archivo provee memoria persistente y reglas de desarrollo automáticas al abrir la carpeta `RH BRINNERCAS/` en **Antigravity IDE**.

---

## 1. Identidad Empresarial y Autenticación
- **Entidad:** GRUPO GASTRONÓMICO AURORA S.A.C. (RUC: `20615117111`).
- **Representante Legal:** Gladys Verónica Carbajal Urquizo (Gerente General, DNI `42892738`).
- **Domicilio Fiscal:** Av. Víctor Larco Herrera N.º 2164, Urb. San Andrés V Etapa, Víctor Larco, Trujillo, La Libertad.
- **Acceso Web (Login Control):**
  - Credenciales autorizadas (`AUTH_USERS` en `server.js`): `admr.brinnercas@gmail.com`, `brinnercas@gmail.com` y `gerencia@aurora.pe` (Contraseña: `Aurora2026!`).
  - PIN Rápido Gerencial: `1234` o `2026`.

---

## 2. Arquitectura del Proyecto (`RH BRINNERCAS/`)

- `server.js` — Servidor HTTP nativo Node.js (Puerto `3005`, sin dependencias externas aparte de `jszip`) con APIs y servidor de archivos estáticos.
- `public/index.html` — Interfaz Glassmorphism con Login Control, Dock flotante inferior (`nav.glass-dock`), Spotlight de 5 documentos por colaborador, tabla responsiva, formulario de Primer Ingreso, generador de adendas/memos/actas/liquidaciones y modales `<dialog>`.
- `public/styles.css` — Sistema Glassmorphism (`#121913`, `#1E291F`, `#F0EADF`, `#C5A059`), fuentes `Holland`, `Sylfaen` y `Manrope`, Dock flotante, botón `.glass-read-more-btn` y estilos de `@container` para tablas responsivas.
- `public/app.js` — Controlador de estado, Login, navegación Dock, toggle universal `renderExpandableText` / `toggleReadMore` («Leer más / Leer menos»), Bóveda de 5 descargas y envío Base64 + JSON hacia Drive/Sheets.
- `services/`:
  - `audit_engine.js` — Cálculo de planilla activa, optimización mensual y estado semáforo del padrón.
  - `sheets_drive_sync.js` — Alta de Primer Ingreso (`registrarNuevoIngreso`): guarda DNI en Drive, genera contrato inicial `.docx`, sube a Drive, actualiza `padron_personal_aurora_2026.json` y agrega filas en tiempo real a ambos Google Sheets.
  - `contrato_engine.js` — Generador de Contrato Individual inicial en Word (`.docx`, `Aptos 11pt`).
  - `adenda_engine.js` — Generador de adendas individuales y masivas en Word (`.docx`, `Aptos 11pt`, reglas modelo Castro Brinner).
  - `memo_engine.js` y `acta_engine.js` — Emisores de memorándums (RIT) y actas de entrega.
  - `liquidacion_engine.js` — Calculadora legal D.Leg. 728 / Ley 27735 / Ley 30334 (CTS, vacaciones y gratificación truncas).
  - `assistant_ai.js` — Asistente IA de consultas sobre nómina, fechas de cese, MOF y D.Leg. 728.
- `data/padron_personal_aurora_2026.json` — Base auditable de colaboradores (`27` registros: `9` activos, `13` cesados incluyendo Andrea Cueva al `31/05/2026` y Diego Minchón al `31/10/2026`, y `5` RxH/Apoyo).
- `data/drive_manifest.json` — IDs oficiales y URLs de Google Drive y Google Sheets sincronizados.
- `scripts/sync_drive_rh_brinnercas.js` — Sincronizador completo hacia Google Drive (`gdrive` CLI) y Google Sheets (`gsheets` CLI).

---

## 3. Mapa de Endpoints del Servidor (`http://localhost:3005`)

- `POST /api/auth/login` — Autenticación por correo/contraseña o PIN.
- `GET /api/audit` — Auditoría completa de planilla, resumen por áreas, manifest Cloud y lista de colaboradores con URLs de documentos.
- `GET /api/docs/:tipo/:id` — Descarga directa o vista previa (`?inline=1`) de los 5 documentos por colaborador (`dni`, `contrato`, `adenda`, `memo`, `liquidacion`).
- `GET /api/liquidacion/calc/:id` — Cálculo detallado + HTML imprimible de liquidación BB.SS.
- `POST /api/personal/nuevo` — Alta de primer ingreso + subida a Drive + registro en Google Sheets.
- `POST /api/adenda/generate/:id` & `POST /api/adenda/generate-all` — Generación de adendas `.docx`.
- `POST /api/memo/generate` & `POST /api/acta/generate` — Generación de memorándums y actas HTML.
- `GET /api/excel/resumen` — Descarga del libro Excel contable `RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx`.
- `GET /api/mof`, `GET /api/memo-motivos`, `POST /api/chat` — MOF, motivos predefinidos y asistente IA.

---

## 4. Integración Google Drive y Google Sheets (`admr.brinnercas@gmail.com`)

- **Carpeta Raíz Drive:** `RH BRINNERCAS - GRUPO GASTRONOMICO AURORA SAC` (`ID: 1i_K5OJHe5vvnQTrMnwEm0e2CQIT4MGuT`)
  - `01_CONTRATOS_PERSONAL_PDF`: `1NrM4vQ8S8YBh1Gs5BiK9VcGib1DSgZ7V`
  - `02_ADENDAS_MODALIDAD_DOCX`: `1Li_ya6fsK_ipu7ZJmfQ3x4hDRg4krVKJ`
  - `03_FOTOS_DNI_IDENTIDAD_PDF`: `18iMe_-p5JAyd1HE3ToMvmkwp0O8B73qp`
  - `04_MEMORANDUMS_Y_ACTAS`: `10Yf4rxBWqkmyGDWMsNZk6_FoP93E_22_`
  - `05_LIQUIDACIONES_Y_BOLETAS`: `15wbYdD_0CoAezbCxo4Kio89O7yiAvSyJ`
  - `06_BASE_DATOS_SHEETS_Y_EXCEL`: `1AK8EUGRgkXQKK_xdkexG8E-qg0nJpFZo`
- **Google Sheet Maestro:** `BD_MAESTRA_RH_BRINNERCAS_AURORA_2026` (`ID: 1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk`)
- **Google Sheet Histórico:** `REGISTRO DEL PERSONAL DE AURORA` (`ID: 1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM`)

---

## 5. Estándares Obligatorios al Editar Código

1. **Estética y Componentes UI:** Preservar el sistema Glassmorphism y la paleta Aurora (`#121913`, `#1E291F`, `#F0EADF`, `#C5A059`), manteniendo el Dock inferior flotante y los botones «Leer más / Leer menos» en textos extensos.
2. **Accesibilidad Web Moderna:** Mantener `<dialog class="glass-dialog" closedby="any">`, validación post-interacción (`:user-invalid` + `.user-invalid-fallback` + `#validation-announcer`), autocompletado de login (`username` / `current-password`) y tablas responsivas con `data-label`.
3. **Adendas D.Leg. 728:** Respetar el título universal `ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD`, tipografía `Aptos 11pt` justificada, negritas exactas del modelo Castro Brinner y domicilios verificados del padrón.
