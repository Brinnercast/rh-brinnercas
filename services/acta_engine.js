/**
 * MOTOR DE ACTAS DE ENTREGA E INDUCCIÓN - GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '..', 'data', 'padron_personal_aurora_2026.json');

function cargarPadron() {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function generarActaEntrega({
  colaboradorId,
  tipoActa = 'rit',
  fecha = new Date().toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' }),
  bienesEntregados = []
}) {
  const padronData = cargarPadron();
  const colab = padronData.colaboradores.find(c => c.id === parseInt(colaboradorId, 10));
  if (!colab) throw new Error(`Colaborador ${colaboradorId} no encontrado.`);

  let titulo = 'ACTA DE ENTREGA DEL REGLAMENTO INTERNO DE TRABAJO (RIT)';
  let contenido = '';

  if (tipoActa === 'rit') {
    titulo = 'ACTA DE RECEPCIÓN DEL REGLAMENTO INTERNO DE TRABAJO Y CÓDIGO DE ÉTICA';
    contenido = `
      <p>Por medio del presente documento, yo, <b>${colab.nombre}</b>, identificado(a) con DNI N.º <b>${colab.dni}</b>, domiciliado(a) en <b>${colab.domicilio || 'Trujillo'}</b>, desempeñando el cargo de <b>${colab.cargoActual || colab.cargoContrato}</b> en el área de <b>${colab.area}</b> de <b>GRUPO GASTRONÓMICO AURORA S.A.C.</b> (RUC: 20615117111), declaro bajo juramento haber recibido de manera formal, íntegra y gratuita un ejemplar digital e impreso del:</p>
      <ul>
        <li><b>REGLAMENTO INTERNO DE TRABAJO (RIT)</b> de Grupo Gastronómico Aurora S.A.C.</li>
        <li><b>MANUAL DE ORGANIZACIÓN Y FUNCIONES (MOF)</b> correspondiente a mi puesto.</li>
        <li><b>POLÍTICAS DE HIGIENE Y BUENAS PRÁCTICAS DE MANUFACTURA (BPM)</b>.</li>
      </ul>
      <p>Asimismo, manifiesto mi compromiso expreso de dar estricta lectura, observancia y cumplimiento a todas las directivas, deberes, prohibiciones y normas de disciplina y seguridad estipuladas en dichos documentos normativos.</p>
    `;
  } else if (tipoActa === 'cargo') {
    titulo = 'ACTA DE ENTREGA Y RECEPCIÓN DE PUESTO DE TRABAJO';
    contenido = `
      <p>En las instalaciones de Aurora Restaurant, a los <b>${fecha}</b>, se procede a formalizar la entrega y asunción del puesto de <b>${colab.cargoActual || colab.cargoContrato}</b> a favor de don(ña) <b>${colab.nombre}</b> (DNI: <b>${colab.dni}</b>).</p>
      <p>El trabajador recibe los accesos, procedimientos operativos estandarizados y custodia de bienes necesarios para el desempeño óptimo de sus funciones, asumiendo la responsabilidad sobre el cuidado y resguardo del patrimonio del restaurante.</p>
    `;
  } else {
    titulo = 'ACTA DE ASIGNACIÓN DE UNIFORMES Y HERRAMIENTAS DE TRABAJO';
    const listaBienes = bienesEntregados.length > 0 ? bienesEntregados : [
      "02 Filipinas / Camisas institucionales bordadas con logo de Aurora",
      "02 Pantalones de trabajo reglamentarios",
      "01 Mandil / Delantal institucional",
      "01 Carnet de identificación y fotocheck corporativo"
    ];
    contenido = `
      <p>Se hace entrega formal al colaborador(a) <b>${colab.nombre}</b> de las siguientes herramientas, implementos de protección y uniformes de trabajo para su uso exclusivo dentro de su jornada laboral en Aurora:</p>
      <ul>${listaBienes.map(b => `<li>${b}</li>`).join('')}</ul>
      <p>El colaborador se compromete a mantener dichos bienes en óptimo estado de conservación, higiene y pulcritud, devolviéndolos al término de la relación laboral.</p>
    `;
  }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<style>
  body { font-family: 'Aptos', 'Segoe UI', Arial, sans-serif; margin: 40px; color: #1c1c1c; line-height: 1.6; }
  .acta-container { max-width: 720px; margin: 0 auto; border: 1.5px solid #1E291F; padding: 45px; background: #fff; }
  .header { text-align: center; border-bottom: 2px solid #C5A059; padding-bottom: 15px; margin-bottom: 25px; }
  .logo { font-size: 20pt; font-weight: bold; color: #121913; letter-spacing: 2px; }
  .sub { font-size: 9pt; color: #555; text-transform: uppercase; margin-top: 2px; }
  .title { font-size: 13pt; font-weight: bold; color: #1E291F; margin-top: 16px; text-transform: uppercase; }
  .body-text { text-align: justify; font-size: 11pt; margin-top: 20px; }
  .closing { text-align: right; margin-top: 35px; font-size: 11pt; }
  .signatures { margin-top: 60px; display: flex; justify-content: space-between; text-align: center; }
  .sig-col { width: 44%; border-top: 1px solid #333; padding-top: 8px; font-size: 10pt; }
</style>
</head>
<body>
<div class="acta-container">
  <div class="header">
    <div class="logo">AURORA RESTAURANT</div>
    <div class="sub">GRUPO GASTRONÓMICO AURORA S.A.C. • RUC 20615117111</div>
    <div class="title">${titulo}</div>
  </div>
  <div class="body-text">${contenido}</div>
  <div class="closing">Trujillo, ${fecha}</div>
  <div class="signatures">
    <div class="sig-col"><b>POR EL EMPLEADOR</b><br>Administración General<br>Grupo Gastronómico Aurora S.A.C.</div>
    <div class="sig-col"><b>EL TRABAJADOR</b><br>${colab.nombre}<br>DNI N.º ${colab.dni}</div>
  </div>
</div>
</body>
</html>`;

  return { colaborador: colab.nombre, dni: colab.dni, titulo, html };
}

module.exports = { generarActaEntrega };
