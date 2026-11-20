---
name: rh-brinnercas
description: >-
  Habilidad especialista para desarrollar, mantener y operar la plataforma web Glassmorphism RH BRINNERCAS de GRUPO GASTRONÓMICO AURORA S.A.C. (puerto 3005), conectada en tiempo real con Google Drive (carpeta 1i_K5OJHe5vvnQTrMnwEm0e2CQIT4MGuT) y Google Sheets (Hoja Maestra 1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk y Hoja Histórica 1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM). Activar SIEMPRE que se edite la app web de RRHH, el filtro de legajos/5 descargas, el formulario de primer ingreso, o las integraciones Drive/Sheets.
---

# RH BRINNERCAS — Plataforma Glassmorphism de RRHH Cloud

Esta habilidad documenta la arquitectura, comandos, endpoints y reglas de diseño del sistema **RH BRINNERCAS** (`RH BRINNERCAS/`) para trabajar directamente desde **Antigravity IDE**.

---

## 1. Comandos Rápidos en Antigravity IDE

* **Abrir Workspace dedicado:** Abrir `RH BRINNERCAS\RH_BRINNERCAS.code-workspace` (o en la raíz `RH_BRINNERCAS.code-workspace`).
* **Iniciar Portal Web (`http://localhost:3005`):**
  ```powershell
  cd "RH BRINNERCAS"
  node server.js
  ```
  *(También disponible con `F5`, vía Tarea de Compilación por defecto o doble clic en `INICIAR_RH_BRINNERCAS.bat`)*.
* **Sincronizar archivos locales, DNIs y padrón hacia Google Drive + Sheets:**
  ```powershell
  node "RH BRINNERCAS/scripts/sync_drive_rh_brinnercas.js"
  ```

---

## 2. Estructura Clave y Responsabilidades

| Ruta | Función |
| :--- | :--- |
| `server.js` | Servidor HTTP Node.js en puerto `3005` (APIs REST + archivos estáticos). |
| `public/index.html` | UI Glassmorphism: Login (`#login-screen`), Header, 7 vistas y Dock inferior (`nav.glass-dock`). |
| `public/styles.css` | Tokens Aurora (`#121913`, `#1E291F`, `#F0EADF`, `#C5A059`), Dock, `.glass-read-more-btn`, modales `<dialog>` y `@container`. |
| `public/app.js` | Control de acceso, Dock, Bóveda de 5 descargas (`renderSpotlight`), «Leer más / Leer menos», Onboarding Base64 -> Drive/Sheets. |
| `services/audit_engine.js` | Estadísticas en vivo del padrón (activos, cesados, RxH/Apoyo, ahorro vs. febrero 2026). |
| `services/sheets_drive_sync.js` | `registrarNuevoIngreso()`: genera contrato inicial `.docx`, sube Foto DNI y Contrato a Drive y escribe fila en Google Sheets. |
| `services/contrato_engine.js` | Generador OOXML (`.docx`) de contratos modales iniciales con `jszip` en `Aptos 11pt`. |
| `services/adenda_engine.js` | Generador OOXML (`.docx`) de adendas individuales y masivas en `Aptos 11pt`. |
| `services/liquidacion_engine.js` | Calculadora de Beneficios Sociales bajo D.Leg. 728 / Ley 27735 / Ley 30334. |
| `services/memo_engine.js` / `acta_engine.js` | Emisores de memorándums (RIT Aurora) y actas de entrega. |
| `services/assistant_ai.js` | Asistente virtual de consultas laborales del padrón y MOF. |
| `data/padron_personal_aurora_2026.json` | Fuente maestra auditable de colaboradores y URLs documentales. |
| `data/drive_manifest.json` | Mapa de IDs y URLs en Google Drive y Google Sheets (`admr.brinnercas@gmail.com`). |

---

## 3. Reglas Obligatorias de Continuidad

1. **Login Control:** `AUTH_USERS` (`admr.brinnercas@gmail.com`, `brinnercas@gmail.com`, `gerencia@aurora.pe` / pass `Aurora2026!` / PIN `1234` o `2026`) debe proteger siempre el acceso inicial.
2. **Bóveda de 5 Descargas por Personal:** Toda vista o filtro por trabajador debe ofrecer descarga y/o vista previa de: (1) Contrato, (2) Adendas, (3) Memorándums, (4) Liquidación BB.SS., y (5) Foto de DNI (PDF/JPG).
3. **Botón «Leer más / Leer menos»:** Conservar `renderExpandableText(text, maxLen)` en textos extensos (domicilios, observaciones, historial de adendas, MOF y chat).
4. **Sincronización Drive & Sheets:** Nunca cambiar los nombres de las pestañas de la Hoja Maestra (`1_PADRON_GENERAL`, `2_NUEVOS_INGRESOS`, `3_HISTORIAL_ADENDAS_Y_CESES`) ni de las 6 subcarpetas en Drive sin actualizar `scripts/sync_drive_rh_brinnercas.js` y `data/drive_manifest.json`.
