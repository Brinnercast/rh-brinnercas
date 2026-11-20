/**
 * MOTOR DE MEMORÁNDUMS Y COMUNICADOS - GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'data', 'padron_personal_aurora_2026.json');

function cargarPadron() {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

const MOTIVOS_PREDEFINIDOS = {
  llamada_atencion_tardanza: {
    tipo: "LLAMADA DE ATENCIÓN",
    asunto: "Reiterada impuntualidad en el horario de ingreso al turno",
    fundamento: "Conforme al Reglamento Interno de Trabajo (RIT) y las directivas del Administrador General, la puntualidad es indispensable para asegurar el correcto mise en place y la fluidez del servicio.",
    gravedad: "LEVE A MODERADA"
  },
  llamada_atencion_bpm: {
    tipo: "LLAMADA DE ATENCIÓN",
    asunto: "Incumplimiento de los Protocolos de Buenas Prácticas de Manufactura (BPM)",
    fundamento: "Se constató omisión en el correcto lavado de manos, uso de cofia/redilla o manipulación indebida de alimentos en área operativa, contraviniendo la normativa sanitaria y estándares de calidad de Aurora.",
    gravedad: "GRAVE"
  },
  llamada_atencion_uniforme: {
    tipo: "LLAMADA DE ATENCIÓN",
    asunto: "Presentación personal y descuido en el uniforme reglamentario",
    fundamento: "El estándar de imagen de Grupo Gastronómico Aurora exige calzado reglamentario cerrado antideslizante, uniforme completo limpio y planchado, cabello recogido y pulcritud absoluta en salón y cocina.",
    gravedad: "LEVE"
  },
  llamada_atencion_faltas: {
    tipo: "LLAMADA DE ATENCIÓN",
    asunto: "Faltas injustificadas al centro de labores",
    fundamento: "Se registra inasistencia injustificada sin aviso previo ni sustento documentado dentro del plazo de ley establecido en el Reglamento Interno de Trabajo y D.Leg. 728.",
    gravedad: "GRAVE"
  },
  felicitacion_desempeno: {
    tipo: "MEMORÁNDUM DE RECONOCIMIENTO",
    asunto: "Felicitación por excelencia operativa y compromiso en el servicio",
    fundamento: "Se destaca y reconoce públicamente su proactividad, liderazgo positivo en el equipo y las reiteradas menciones favorables por parte de los comensales.",
    gravedad: "MÉRITO"
  },
  comunicado_general: {
    tipo: "CIRCULAR / DIRECTIVA",
    asunto: "Disposiciones de cumplimiento obligatorio para todo el equipo",
    fundamento: "Directiva general emitida por la Administración General y Gerencia para optimizar la coordinación del servicio.",
    gravedad: "INFORMATIVO"
  }
};

function generarMemorandum({
  colaboradorId,
  motivoClave = 'llamada_atencion_tardanza',
  asuntoPersonalizado,
  descripcionHechos,
  fechaDocumento = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }),
  correlativo = '003-2026-RRHH'
}) {
  const padronData = cargarPadron();
  const colab = padronData.colaboradores.find(c => c.id === parseInt(colaboradorId, 10));
  if (!colab) throw new Error(`Colaborador ${colaboradorId} no encontrado.`);

  const motivoInfo = MOTIVOS_PREDEFINIDOS[motivoClave] || MOTIVOS_PREDEFINIDOS.llamada_atencion_tardanza;
  const asuntoFinal = asuntoPersonalizado || motivoInfo.asunto;
  const cuerpoHechos = descripcionHechos || motivoInfo.fundamento;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${motivoInfo.tipo} - ${colab.nombre}</title>
<style>
  body { font-family: 'Aptos', 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1c1c1c; line-height: 1.6; }
  .memo-container { max-width: 720px; margin: 0 auto; border: 1.5px solid #1E291F; padding: 40px; background: #fff; }
  .header { text-align: center; border-bottom: 2px solid #C5A059; padding-bottom: 15px; margin-bottom: 25px; }
  .logo-title { font-size: 20pt; font-weight: bold; color: #121913; letter-spacing: 2px; }
  .company-sub { font-size: 9pt; color: #555; text-transform: uppercase; }
  .memo-title { font-size: 14pt; font-weight: bold; color: #8C1D18; margin-top: 15px; text-transform: uppercase; }
  .memo-number { font-size: 10pt; color: #555; }
  .meta-table { width: 100%; margin-bottom: 25px; font-size: 11pt; border-collapse: collapse; }
  .meta-table td { padding: 6px 4px; vertical-align: top; }
  .meta-label { font-weight: bold; width: 90px; color: #1E291F; }
  .content-body { text-align: justify; font-size: 11pt; margin-bottom: 30px; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; }
  .sig-block { width: 45%; border-top: 1px solid #333; padding-top: 8px; font-size: 10pt; }
</style>
</head>
<body>
<div class="memo-container">
  <div class="header">
    <div class="logo-title">AURORA RESTAURANT</div>
    <div class="company-sub">GRUPO GASTRONÓMICO AURORA S.A.C. • RUC 20615117111</div>
    <div class="memo-title">${motivoInfo.tipo}</div>
    <div class="memo-number">N.º ${correlativo}</div>
  </div>
  <table class="meta-table">
    <tr><td class="meta-label">DE:</td><td><b>ADMINISTRACIÓN GENERAL</b> / GRUPO GASTRONÓMICO AURORA S.A.C.</td></tr>
    <tr><td class="meta-label">PARA:</td><td><b>${colab.nombre}</b> (DNI: ${colab.dni})<br><span style="color:#555;">Puesto: ${colab.cargoActual || colab.cargoContrato} - Área: ${colab.area}</span></td></tr>
    <tr><td class="meta-label">FECHA:</td><td>Trujillo, ${fechaDocumento}</td></tr>
    <tr><td class="meta-label">ASUNTO:</td><td><b>${asuntoFinal}</b></td></tr>
  </table>
  <div class="content-body">
    <p>Por medio del presente documento, la Administración General de <b>GRUPO GASTRONÓMICO AURORA S.A.C.</b> se dirige a usted para poner de su conocimiento lo siguiente:</p>
    <p>${cuerpoHechos}</p>
    <p>Le exhortamos a mantener la rigurosidad y el compromiso inherente a su rol en nuestra organización, reiterándole que el cumplimiento cabal de sus responsabilidades garantiza el nivel de excelencia que caracteriza a nuestro establecimiento.</p>
    <p>El presente documento quedará archivado en su legajo personal para los fines de control administrativo y laboral pertinentes.</p>
  </div>
  <div class="signatures">
    <div class="sig-block"><b>ADMINISTRACIÓN GENERAL</b><br>Grupo Gastronómico Aurora S.A.C.<br>RUC: 20615117111</div>
    <div class="sig-block"><b>${colab.nombre}</b><br>DNI: ${colab.dni}<br><i>Firma de Recepción y Conformidad</i></div>
  </div>
</div>
</body>
</html>`;

  return {
    colaborador: colab.nombre,
    dni: colab.dni,
    tipo: motivoInfo.tipo,
    asunto: asuntoFinal,
    html
  };
}

module.exports = {
  generarMemorandum,
  MOTIVOS_PREDEFINIDOS
};
