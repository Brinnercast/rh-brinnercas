/**
 * MOTOR DE ADENDAS OFICIALES - GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const dataDir = path.join(__dirname, '..', 'data');
const templatesDir = path.join(__dirname, '..', 'templates');
const jsonPath = path.join(dataDir, 'padron_personal_aurora_2026.json');

const templateProrroga = path.join(templatesDir, 'ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD - EJM PRORROGA .docx');
const templateCambio = path.join(templatesDir, 'ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD - EJEMPLO CAMBIO REMUN.docx');

function cargarPadron() {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function xmlEscape(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function runNormal(text) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function runBold(text) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function pJustified(runsXml) {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>${runsXml}</w:p>`;
}

function pTitle(text) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>${runBold(text)}</w:p>`;
}

function pClauseHeader(text) {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:cs="Aptos"/><w:b/><w:bCs/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:pPr>${runBold(text)}</w:p>`;
}

async function generarAdendaBuffer({
  trabajadorNombre,
  trabajadorDni,
  trabajadorDomicilio,
  segundoRuns,
  hasAjuste = false,
  terceroHeader = '',
  terceroRuns = [],
  firmaFechaTextoBold = '31 días del mes de octubre de 2026'
}) {
  const baseTemplate = hasAjuste ? templateCambio : templateProrroga;
  const templateContent = fs.readFileSync(baseTemplate);
  const zip = await JSZip.loadAsync(templateContent);
  let xml = await zip.file('word/document.xml').async('string');

  const pTitleXml = pTitle('ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD');
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD(?:(?!<\/w:p>).)*<\/w:p>/s, pTitleXml);

  const introRuns = [
    runNormal('Conste por el presente documento que se extiende por duplicado, la '),
    runBold('ADENDA AL CONTRATO INDIVIDUAL DE TRABAJO SUJETO A MODALIDAD POR INICIO DE ACTIVIDADES'),
    runNormal(', que celebran, de conformidad con el Artículo 63 del T.U.O. del Decreto Legislativo N.º 728 (Decreto Supremo N.º 003-97-TR) y normas complementarias, de una parte, '),
    runBold('GRUPO GASTRONÓMICO AURORA S.A.C.'),
    runNormal(', con RUC N.º 20615117111 y domicilio en Av. Víctor Larco Herrera N.º 2164, Urb. San Andrés V Etapa, Distrito de Víctor Larco, Provincia de Trujillo, Departamento de La Libertad, debidamente representada por su Gerente General, '),
    runBold('CARBAJAL URQUIZO GLADYS VERÓNICA'),
    runNormal(', con DNI N.º 42892738, a quien en adelante se le denominará '),
    runBold('EL EMPLEADOR'),
    runNormal('; y de la otra parte, '),
    runBold(trabajadorNombre),
    runNormal(`, identificada con DNI N.º ${trabajadorDni}, con domicilio en ${trabajadorDomicilio}, a quien en adelante se le denominará `),
    runBold('EL TRABAJADOR'),
    runNormal(', en los términos y condiciones siguientes:')
  ].join('');
  const pIntroXml = pJustified(introRuns);
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*Conste por el presente documento(?:(?!<\/w:p>).)*<\/w:p>/s, pIntroXml);

  const pPrimeroH = pClauseHeader('PRIMERO – DE LAS PARTES Y ANTECEDENTE');
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*<w:t>PRIMERO<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>/s, pPrimeroH);

  const pSegundoH = pClauseHeader('SEGUNDO – DE LA PRÓRROGA DEL CONTRATO');
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*<w:t>SEGUNDO<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>/s, pSegundoH);

  const segundoRunsXml = segundoRuns.map(r => r.bold ? runBold(r.text) : runNormal(r.text)).join('');
  const pSegundoBodyXml = pJustified(segundoRunsXml);
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*Que el trabajador fue contratado inicialmente(?:(?!<\/w:p>).)*<\/w:p>/s, pSegundoBodyXml);

  if (hasAjuste) {
    const pTerceroH = pClauseHeader(terceroHeader || 'TERCERO – AJUSTE DE REMUNERACIÓN');
    xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*<w:t>TERCERO – AJUSTE DE REMUNERACIÓN<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>/s, pTerceroH);
    const terceroRunsXml = terceroRuns.map(r => r.bold ? runBold(r.text) : runNormal(r.text)).join('');
    const pTerceroBodyXml = pJustified(terceroRunsXml);
    xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*remuneraci[^\s<]*\s*mensual(?:(?!<\/w:p>).)*<\/w:p>/s, pTerceroBodyXml);
    const pCuartoH = pClauseHeader('CUARTO – RATIFICACIÓN DE CONDICIONES');
    xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*<w:t>CUARTO – RATIFICACIÓN<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>/s, pCuartoH);
  } else {
    const pTerceroH = pClauseHeader('TERCERO – RATIFICACIÓN DE CONDICIONES');
    xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*<w:t>TERCERO<\/w:t>(?:(?!<\/w:p>).)*<\/w:p>/s, pTerceroH);
  }

  const pCierreRuns = [
    runNormal('Hecho en dos ejemplares de un mismo tenor y para un solo efecto, que se firman en la ciudad de Trujillo, a los '),
    runBold(firmaFechaTextoBold),
    runNormal('.')
  ].join('');
  const pCierreXml = pJustified(pCierreRuns);
  xml = xml.replace(/<w:p\b[^>]*>(?:(?!<\/w:p>).)*Hecho en dos ejemplares(?:(?!<\/w:p>).)*<\/w:p>/s, pCierreXml);

  xml = xml.replace(/<w:t xml:space="preserve">\s*A<\/w:t>/g, '<w:t xml:space="preserve">                    <\/w:t>');
  xml = xml.replace(/AESQUIVEL RODRIGUEZ KARLA DAYAN/g, xmlEscape(trabajadorNombre));
  xml = xml.replace(/ESQUIVEL RODRIGUEZ KARLA DAYAN/g, xmlEscape(trabajadorNombre));
  xml = xml.replace(/PEÑA ULLILEN EDWIN SMITH/g, xmlEscape(trabajadorNombre));
  xml = xml.replace(/73576771/g, xmlEscape(trabajadorDni));
  xml = xml.replace(/74805963/g, xmlEscape(trabajadorDni));
  xml = xml.replace(new RegExp(`A${trabajadorNombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'), xmlEscape(trabajadorNombre));

  zip.file('word/document.xml', xml);
  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

async function generarAdendaPorId(id, opciones = {}) {
  const padronData = cargarPadron();
  const colab = padronData.colaboradores.find(c => c.id === parseInt(id, 10));
  if (!colab) throw new Error(`Colaborador ID ${id} no encontrado.`);

  const fechaHastaAnterior = opciones.fechaHastaAnterior || colab.vigenciaActualHasta || '31 de octubre de 2026';
  const fechaInicioNueva = opciones.fechaInicioNueva || '1 de noviembre de 2026';
  const fechaFinNueva = opciones.fechaFinNueva || '31 de enero de 2027';
  const duracionMeses = opciones.duracionMeses || 'tres (03) meses';
  const firmaTexto = opciones.firmaTexto || '31 días del mes de octubre de 2026';
  const nuevaRemun = opciones.nuevaRemuneracion || colab.remuneracionActual || 1500;
  const nuevoCargo = opciones.nuevoCargo || colab.cargoActual || 'Colaborador';

  let numAdendaTexto = 'adenda';
  let prefixFile = 'ADENDA';
  if (colab.proximaAdenda && colab.proximaAdenda.includes('4TA')) {
    numAdendaTexto = 'cuarta adenda';
    prefixFile = '4TA ADENDA';
  } else if (colab.proximaAdenda && colab.proximaAdenda.includes('3RA')) {
    numAdendaTexto = 'tercera adenda';
    prefixFile = '3RA ADENDA';
  } else if (colab.adendas && colab.adendas.length > 0) {
    const nextN = colab.adendas.length + 1;
    numAdendaTexto = `${nextN}ra adenda`;
    prefixFile = `${nextN}RA ADENDA`;
  }

  const fileName = `${prefixFile} DE CONTRATO ${(colab.carpetaAdendas || colab.nombre).toUpperCase()}.docx`;
  const hasAjuste = Boolean(opciones.nuevaRemuneracion && Number(opciones.nuevaRemuneracion) !== Number(colab.remuneracionActual));

  const segundoRuns = [
    { text: `Que el trabajador fue contratado inicialmente mediante contrato individual de trabajo sujeto a modalidad y prorrogado sucesivamente mediante adendas hasta el `, bold: false },
    { text: `${fechaHastaAnterior}`, bold: true },
    { text: ` en el puesto de ${nuevoCargo}. Mediante la presente ${numAdendaTexto}, las partes acuerdan `, bold: false },
    { text: `prorrogar la duración del contrato por un período adicional de ${duracionMeses}`, bold: true },
    { text: `, comprendido desde el `, bold: false },
    { text: `${fechaInicioNueva} hasta el ${fechaFinNueva}`, bold: true },
    { text: `, manteniéndose su remuneración mensual en la suma de `, bold: false },
    { text: `S/ ${parseFloat(nuevaRemun).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true },
    { text: ` y las mismas condiciones, funciones y estipulaciones pactadas.`, bold: false }
  ];

  const buffer = await generarAdendaBuffer({
    trabajadorNombre: colab.nombre,
    trabajadorDni: colab.dni,
    trabajadorDomicilio: colab.domicilio || 'Trujillo, La Libertad',
    segundoRuns,
    hasAjuste,
    terceroHeader: hasAjuste ? 'TERCERO – DEL AJUSTE DE REMUNERACIÓN' : '',
    terceroRuns: hasAjuste ? [
      { text: 'Por mutuo acuerdo, la remuneración mensual se fija en ', bold: false },
      { text: `S/ ${parseFloat(nuevaRemun).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, bold: true },
      { text: '.', bold: false }
    ] : [],
    firmaFechaTextoBold: firmaTexto
  });

  return {
    colaborador: colab.nombre,
    dni: colab.dni,
    fileName,
    buffer
  };
}

async function generarTodasAdendasActivas(opciones = {}) {
  const padronData = cargarPadron();
  const activos = padronData.colaboradores.filter(c => c.estado === 'ACTIVO');
  const resultados = [];
  const outDir = path.join(__dirname, '..', 'output', 'adendas');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const colab of activos) {
    const res = await generarAdendaPorId(colab.id, opciones);
    fs.writeFileSync(path.join(outDir, res.fileName), res.buffer);
    resultados.push({
      colaborador: res.colaborador,
      dni: res.dni,
      fileName: res.fileName,
      downloadUrl: `/api/download-output/adendas/${encodeURIComponent(res.fileName)}`
    });
  }

  return {
    total: resultados.length,
    adendas: resultados
  };
}

module.exports = {
  generarAdendaBuffer,
  generarAdendaPorId,
  generarTodasAdendasActivas
};
