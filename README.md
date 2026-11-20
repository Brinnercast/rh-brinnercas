# RH BRINNERCAS — Plataforma Web de RRHH (Grupo Gastronómico Aurora S.A.C.)

Plataforma web de gestión laboral, legajos digitales, contratos oficiales (`Anexo N° 001` + 18 cláusulas D.Leg. 728), adendas DOCX, memorándums, actas, liquidaciones BB.SS., envío de correos corporativos, asistente Gemini IA y sincronización en vivo con Google Drive & Google Sheets.

## Enlaces en Producción (100% Gratuito)
- **Web Alojada en Firebase Hosting (Plan Spark):** https://rh-brinnercas.web.app
- **Consola Firebase:** https://console.firebase.google.com/project/rh-brinnercas/overview
- **Repositorio GitHub:** https://github.com/Brinnercast/rh-brinnercas

## Módulos Incluidos
1. **01 Panel Ejecutivo:** KPIs de nómina, planilla activa por área, proyección de datos `CONDICIÓN LABORAL (CONTRATO / RXH / OTROS)` y alertas D.Leg. 728.
2. **02 Legajos & 5 Docs:** Bóveda individual de 5 descargas (Contrato, Adendas, Memorándums, Liquidación BB.SS. y DNI).
3. **03 Primer Ingreso:** Ficha de alta laboral sincronizada con Google Sheets y generador automático de Contrato Oficial (`Anexo N° 001`).
4. **04 Adendas DOCX:** Generación individual y masiva en formato Aptos 11pt.
5. **05 Memos, Actas & Liq.:** Emisión de Memorándums RIT, Actas SUNAFIL, Liquidaciones BB.SS. y Perfiles MOF.
6. **06 Enviar por Correo:** Centro de despacho corporativo desde `admr.brinnercas@gmail.com`.
7. **07 Drive & Sheets:** Acceso directo a la Bóveda Cloud (integrada también dentro del Dock izquierdo).
8. **08 Gemini IA Assistant:** Consola completa y copiloto flotante con `gemini-4-hydrogen`.
9. **09 Editar Planilla:** Lista completa de toda la planilla con edición en ventana emergente sincronizada en tiempo real con Google Sheets.

## Ejecución Local
```bash
npm install
npm start
# Abre http://localhost:3005
```

## Despliegue en Firebase Hosting (Gratis)
```bash
npx -y firebase-tools@latest deploy --only hosting --project rh-brinnercas
```
