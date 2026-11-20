/**
 * ASISTENTE GEMINI IA DE RECURSOS HUMANOS - GRUPO GASTRONÓMICO AURORA S.A.C.
 * Modelo oficial: gemini-4-hydrogen (Interactions API v1) + Motor Experto Local D.Leg. 728
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { calcularAuditoria, cargarPadron } = require('./audit_engine');

const dataDir = path.join(__dirname, '..', 'data');
const mofPath = path.join(dataDir, 'mof_puestos_aurora.json');
const mofData = JSON.parse(fs.readFileSync(mofPath, 'utf8'));

function buildSystemInstruction(auditoria) {
  const colsResumen = auditoria.colaboradores.map(c =>
    `- ID ${c.id}: ${c.nombre} | DNI: ${c.dni} | Cargo: ${c.cargo} (${c.area}) | Estado: ${c.estado} | Sueldo: S/ ${c.sueldo} | Vigencia/Cese: ${c.vigenciaHasta} | Correo: ${c.correo}`
  ).join('\n');

  return [
    'Eres Gemini HR Assistant, el copiloto oficial de Recursos Humanos y Legal de GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111, Aurora Restaurant en Trujillo, Perú).',
    'Responde siempre en español de forma clara, ejecutiva y precisa.',
    `Resumen actual: ${auditoria.resumen.totalColaboradores} colaboradores registrados (${auditoria.resumen.activosCount} activos en planilla modal, ${auditoria.resumen.cesadosCount} cesados, ${auditoria.resumen.rxhApoyoCount} RxH/Apoyo).`,
    `Masa salarial activa: S/ ${auditoria.resumen.totalNominaActiva.toFixed(2)}/mes. Ahorro frente a febrero 2026 (S/ 40,880.00): S/ ${auditoria.resumen.ahorroMensual.toFixed(2)} (${auditoria.resumen.porcentajeOptimizacion}%).`,
    'Padrón auditado de colaboradores:',
    colsResumen
  ].join('\n');
}

function callGeminiInteractionsApi(apiKey, prompt, systemInstruction, previousInteractionId) {
  return new Promise((resolve, reject) => {
    const payload = {
      model: 'gemini-4-hydrogen',
      input: prompt,
      system_instruction: systemInstruction
    };
    if (previousInteractionId) {
      payload.previous_interaction_id = previousInteractionId;
    }

    const bodyStr = JSON.stringify(payload);
    const req = https.request({
      hostname: 'generativelanguage.googleapis.com',
      path: '/v1/interactions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
        'Content-Length': Buffer.byteLength(bodyStr)
      },
      timeout: 15000
    }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (res.statusCode >= 200 && res.statusCode < 300) {
            let textOut = parsed.output_text || '';
            if (!textOut && Array.isArray(parsed.steps)) {
              for (const step of parsed.steps) {
                if (step.type === 'model_output' && Array.isArray(step.content)) {
                  for (const part of step.content) {
                    if (part.type === 'text' && part.text) textOut += part.text;
                  }
                }
              }
            }
            if (textOut) {
              return resolve({ reply: textOut, interactionId: parsed.id || null, model: 'gemini-4-hydrogen' });
            }
          }
          reject(new Error(parsed.error?.message || `HTTP ${res.statusCode}`));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Timeout conectando a Gemini API'));
    });
    req.write(bodyStr);
    req.end();
  });
}

async function responderConsulta(pregunta, options = {}) {
  const query = String(pregunta || '').toLowerCase().trim();
  const auditoria = calcularAuditoria();
  const padron = cargarPadron();
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

  // Si hay API Key de Gemini disponible, consultar gemini-4-hydrogen via Interactions API v1
  if (apiKey) {
    try {
      const sys = buildSystemInstruction(auditoria);
      const gemRes = await callGeminiInteractionsApi(apiKey, pregunta, sys, options.previousInteractionId);
      if (gemRes && gemRes.reply) {
        return gemRes.reply;
      }
    } catch (e) {
      // Fallback transparente al motor experto local con toda la data de Drive/Padron
    }
  }

  // 1. Solicitud de redactar correo
  if (query.includes('correo') || query.includes('email') || query.includes('redact')) {
    return `**Borrador de Correo Corporativo (Gemini HR Assistant):**\n\n` +
      `**Asunto:** Remisión de Documentación Laboral / Resumen — Grupo Gastronómico Aurora S.A.C.\n\n` +
      `Estimado(a) colaborador(a) / Gerencia:\n\n` +
      `Por medio del presente, la Administración de **Grupo Gastronómico Aurora S.A.C. (RUC 20615117111)** remite la documentación laboral actualizada desde nuestra Bóveda Cloud RH BRINNERCAS.\n\n` +
      `- **Planilla Activa Actual:** ${auditoria.resumen.activosCount} colaboradores (S/ ${auditoria.resumen.totalNominaActiva.toLocaleString('es-PE', { minimumFractionDigits: 2 })}/mes)\n` +
      `- **Carpeta Google Drive:** ${auditoria.manifest?.drive?.rootFolder?.url || 'Disponible en vista Drive'}\n` +
      `- **Google Sheet Maestro:** ${auditoria.manifest?.sheets?.masterSheetUrl || 'Disponible en vista Drive'}\n\n` +
      `*(Puedes enviarlo directamente con 1 clic desde el menú **06 Centro de Correos** en el Dock izquierdo).*`;
  }

  // 2. Pregunta sobre personal, resumen o nómina
  if (query.includes('cuanto') || query.includes('cuánto') || query.includes('total') || query.includes('planilla') || query.includes('sueldos') || query.includes('nómina') || query.includes('nomina') || query.includes('resumen') || query.includes('ahorro')) {
    const areaMatch = Object.keys(auditoria.resumen.porArea).find(area => query.includes(area.toLowerCase()));
    if (areaMatch) {
      const infoArea = auditoria.resumen.porArea[areaMatch];
      return `La planilla mensual del área de **${areaMatch}** asciende a **S/ ${infoArea.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}**, correspondiente a ${infoArea.count} colaborador(es): ${infoArea.colaboradores.join(', ')}.`;
    }
    return `**Resumen Ejecutivo de Planilla — Grupo Gastronómico Aurora S.A.C.**\n\n` +
      `• **Total Padrón Auditado:** ${auditoria.resumen.totalColaboradores} colaboradores.\n` +
      `• **Planilla Activa (Modal D.Leg. 728):** ${auditoria.resumen.activosCount} colaboradores por **S/ ${auditoria.resumen.totalNominaActiva.toLocaleString('en-US', { minimumFractionDigits: 2 })} / mes**.\n` +
      `• **Ahorro Mensual vs. Febrero 2026:** **S/ ${auditoria.resumen.ahorroMensual.toLocaleString('en-US', { minimumFractionDigits: 2 })}** (${auditoria.resumen.porcentajeOptimizacion}% de optimización sobre S/ 40,880.00).\n` +
      `• **Personal RxH / Apoyo:** ${auditoria.resumen.rxhApoyoCount} colaboradores.\n` +
      `• **Personal Cesado / Liquidado:** ${auditoria.resumen.cesadosCount} colaboradores.`;
  }

  // 3. Consulta por colaborador específico
  const colabEncontrado = padron.colaboradores.find(c => {
    const tokens = c.nombre.toLowerCase().split(' ');
    return tokens.some(t => t.length > 3 && query.includes(t)) || (c.dni && query.includes(c.dni));
  });

  if (colabEncontrado) {
    let detalle = `### Ficha Laboral Gemini: ${colabEncontrado.nombre}\n\n`;
    detalle += `- **DNI:** ${colabEncontrado.dni} | **Edad:** ${colabEncontrado.edad || 'N/A'}\n`;
    detalle += `- **Puesto Actual:** ${colabEncontrado.cargoActual} (${colabEncontrado.area}) — ${colabEncontrado.condicionLaborable || 'FULL TIME'}\n`;
    detalle += `- **Estado:** ${colabEncontrado.estado}\n`;
    detalle += `- **Remuneración:** S/ ${(colabEncontrado.remuneracionActual || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    detalle += `- **Vigencia / Cese:** ${colabEncontrado.vigenciaActualHasta || colabEncontrado.fechaCese || 'N/A'}\n`;
    detalle += `- **Correo:** ${colabEncontrado.correo || 'No registrado'} | **Celular:** ${colabEncontrado.celular || 'No registrado'}\n`;
    detalle += `- **Banco / Cuenta:** ${colabEncontrado.banco || 'N/A'} (${colabEncontrado.numeroCuenta || 'N/A'})\n`;
    detalle += `- **Domicilio Verificado:** ${colabEncontrado.domicilio || 'No especificado'}\n`;
    if (colabEncontrado.adendas && colabEncontrado.adendas.length > 0) {
      detalle += `\n**Historial de Adendas (${colabEncontrado.adendas.length}):**\n`;
      colabEncontrado.adendas.forEach(a => {
        detalle += `  • *${a.numero}* (${a.inicio} al ${a.fin}) - ${a.concepto}\n`;
      });
    }
    return detalle;
  }

  // 4. Pregunta sobre fecha de renovación o adendas
  if (query.includes('adenda') || query.includes('renovac') || query.includes('octubre') || query.includes('vence')) {
    const activosNombres = auditoria.colaboradores.filter(c => c.estado === 'ACTIVO').map(c => c.nombre);
    return `**Renovación de Contratos y Adendas (Grupo Gastronómico Aurora S.A.C.)**\n\n` +
      `• **Colaboradores activos en planilla modal (${auditoria.resumen.activosCount}):** ${activosNombres.join(', ')}.\n` +
      `• **Período de prórroga estándar:** 3 meses adicionales (del **01 de noviembre de 2026** al **31 de enero de 2027**).\n` +
      `• **Estándar documental:** Título universal \`<ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD>\`, tipografía Aptos 11pt justificado.\n` +
      `• **Ceses auditados:** Andrea Ximena Cueva Huamán (31/05/2026) y Diego Leonardo Minchón Álvarez (31/10/2026).`;
  }

  // 5. Preguntas sobre funciones de puestos (MOF)
  const puestoEncontrado = mofData.puestos.find(p => query.includes(p.puesto.toLowerCase()) || query.includes(p.id));
  if (puestoEncontrado) {
    let mofDetalle = `### Perfil MOF: ${puestoEncontrado.puesto}\n\n`;
    mofDetalle += `• **Área:** ${puestoEncontrado.area}\n`;
    mofDetalle += `• **Superior Inmediato:** ${puestoEncontrado.superiorInmediato}\n`;
    mofDetalle += `• **Misión del Puesto:** ${puestoEncontrado.mision}\n\n`;
    mofDetalle += `**Principales Funciones:**\n`;
    puestoEncontrado.funciones.forEach((f, idx) => {
      mofDetalle += `${idx + 1}. ${f}\n`;
    });
    return mofDetalle;
  }

  // 6. Marco legal peruano (D.Leg 728)
  if (query.includes('728') || query.includes('despido') || query.includes('periodo de prueba') || query.includes('vacacion') || query.includes('gratificacion') || query.includes('cts')) {
    return `**Normativa Laboral D.Leg. 728 — Grupo Gastronómico Aurora S.A.C.**\n\n` +
      `• **Período de Prueba:** 3 meses ordinarios (superado por todo el personal con adenda vigente).\n` +
      `• **CTS (D.S. 001-97-TR):** 1 remuneración computable anual + 1/6 de gratificación, depositada en mayo y noviembre.\n` +
      `• **Gratificaciones (Ley 27735):** Julio y Diciembre + Bonificación Extraordinaria del 9% (EsSalud).\n` +
      `• **Vacaciones Truncas:** Se liquidan en doceavos y treintavos por cada mes y día efectivamente laborado.`;
  }

  return `Hola, soy **Gemini HR Assistant** (\`gemini-4-hydrogen\`) integrado en **RH BRINNERCAS**.\n\n` +
    `Tengo acceso en tiempo real a los **${auditoria.resumen.totalColaboradores} colaboradores**, contratos, adendas, fotos de DNI en Google Drive, Google Sheets y centro de correos:\n` +
    `1. **Consultar cualquier trabajador por nombre o DNI** (ej: *"Ficha de Wilmer Brinner"* o *"Resumen de Diego Minchón"*).\n` +
    `2. **Analizar costos de planilla y ahorro** (ej: *"¿Cuál es la planilla activa y el ahorro?"*).\n` +
    `3. **Redactar y preparar correos** con adendas, contratos, memorándums o el resumen general del personal.\n` +
    `4. **Consultar el MOF y D.Leg. 728** (CTS, gratificaciones, vacaciones truncas).\n\n` +
    `¿Qué deseas consultar o gestionar ahora?`;
}

module.exports = {
  responderConsulta
};
