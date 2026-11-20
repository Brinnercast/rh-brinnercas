/**
 * MOTOR OFICIAL DE CONTRATOS (CLON 1:1 DE 01_CONTRATOS_PERSONAL_PDF — DRIVE 1NrM4vQ8S8YBh1Gs5BiK9VcGib1DSgZ7V)
 * Genera el ANEXO N° 001 (Secciones I, II, III + Funciones + Firmas + Huella)
 * y las 18 Cláusulas completas del "CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES"
 * de GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111, REMYPE N.º 0002359064-2025).
 */

const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const templatesDir = path.join(__dirname, '..', 'templates');
const templateBase = path.join(templatesDir, 'ADENDA DE CONTRATO DE TRABAJO SUJETO A MODALIDAD - EJM PRORROGA .docx');
const dataDir = path.join(__dirname, '..', 'data');
const mofPath = path.join(dataDir, 'mof_puestos_aurora.json');

function xmlEscape(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function htmlEscape(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function numeroALetrasSoles(monto) {
  const n = Math.round(Number(monto || 0));
  const mapaExacto = {
    500: 'QUINIENTOS',
    550: 'QUINIENTOS CINCUENTA',
    600: 'SEISCIENTOS',
    750: 'SETECIENTOS CINCUENTA',
    850: 'OCHOCIENTOS CINCUENTA',
    900: 'NOVECIENTOS',
    1000: 'MIL',
    1025: 'MIL VEINTICINCO',
    1100: 'MIL CIEN',
    1130: 'MIL CIENTO TREINTA',
    1200: 'MIL DOSCIENTOS',
    1300: 'MIL TRESCIENTOS',
    1400: 'MIL CUATROCIENTOS',
    1500: 'MIL QUINIENTOS',
    1600: 'MIL SEISCIENTOS',
    1700: 'MIL SETECIENTOS',
    1800: 'MIL OCHOCIENTOS',
    1900: 'MIL NOVECIENTOS',
    2000: 'DOS MIL',
    2200: 'DOS MIL DOSCIENTOS',
    2500: 'DOS MIL QUINIENTOS',
    2800: 'DOS MIL OCHOCIENTOS',
    3000: 'TRES MIL',
    3200: 'TRES MIL DOSCIENTOS',
    3500: 'TRES MIL QUINIENTOS',
    3800: 'TRES MIL OCHOCIENTOS',
    4000: 'CUATRO MIL'
  };
  if (mapaExacto[n]) return `${mapaExacto[n]} Y 00/100 SOLES`;
  return `${n.toLocaleString('es-PE')} Y 00/100 SOLES`;
}

function fechaCortaAYYMMDD(fechaStr) {
  const parts = String(fechaStr || '01/11/2026').trim().split('/');
  if (parts.length !== 3) return '261101';
  const dd = parts[0].padStart(2, '0');
  const mm = parts[1].padStart(2, '0');
  const yy = parts[2].slice(-2);
  return `${yy}${mm}${dd}`;
}

function fechaALetras(fechaStr) {
  const meses = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const parts = String(fechaStr || '01/11/2026').trim().split('/');
  if (parts.length !== 3) return fechaStr;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parts[2];
  return `${d} de ${meses[m] || 'Noviembre'} del ${y}`;
}

function obtenerFuncionesPorCargo(cargoStr) {
  const cargoUp = String(cargoStr || '').toUpperCase();
  try {
    if (fs.existsSync(mofPath)) {
      const mof = JSON.parse(fs.readFileSync(mofPath, 'utf8'));
      const puestos = mof.puestos || [];
      const found = puestos.find(p =>
        cargoUp.includes(String(p.puesto || '').toUpperCase()) ||
        String(p.puesto || '').toUpperCase().includes(cargoUp)
      );
      if (found && Array.isArray(found.funciones) && found.funciones.length > 0) {
        return '- ' + found.funciones.slice(0, 3).join(' ').toUpperCase();
      }
    }
  } catch (e) {}

  if (cargoUp.includes('MOZO') || cargoUp.includes('AZAFATA') || cargoUp.includes('SALON')) {
    return '- ATENCIÓN DE MESAS, RECEPCIÓN Y ASESORAMIENTO GASTRONÓMICO A LOS COMENSALES, ASEGURANDO LA CALIDAD DE SERVICIO Y CUMPLIMIENTO DE NORMAS DE SEGURIDAD Y BPM.';
  }
  if (cargoUp.includes('COCIN') || cargoUp.includes('PARRILL') || cargoUp.includes('HORN')) {
    return '- PREPARACIÓN, PRODUCCIÓN Y DESPACHO DE PLATOS Y CORTES EN COCINA CUMPLIENDO LOS ESTÁNDARES DE CALIDAD, RECETAS ESTÁNDAR Y BUENAS PRÁCTICAS DE MANUFACTURA (BPM).';
  }
  if (cargoUp.includes('BAR')) {
    return '- ELABORACIÓN DE COCTELERÍA DE AUTOR Y BEBIDAS, CONTROL DE INSUMOS DE BARRA Y CUMPLIMIENTO ESTRICTO DE ESTÁNDARES DE CALIDAD Y SEGURIDAD.';
  }
  if (cargoUp.includes('CAJ')) {
    return '- GESTIÓN DE COBRANZAS, EMISIÓN DE COMPROBANTES ELECTRÓNICOS, CUADRE DE CAJA DIARIO Y ATENCIÓN CORDIAL AL CLIENTE.';
  }
  return `- EJECUTAR Y CUMPLIR LAS LABORES PROPIAS DEL CARGO DE ${cargoUp}, ASEGURANDO LA CALIDAD DE ATENCIÓN Y EL CUMPLIMIENTO DE LAS NORMAS DE SEGURIDAD E HIGIENE OCUPACIONAL.`;
}

function extraerDatosContrato(colab) {
  const nombre = String(colab.nombre || 'COLABORADOR').toUpperCase().trim();
  const tipoDoc = String(colab.tipoDocumento || 'DNI').toUpperCase().trim();
  const dni = String(colab.dni || '').trim();
  const domicilio = String(colab.domicilio || 'LA LIBERTAD - TRUJILLO - TRUJILLO').toUpperCase().trim();
  const telefono = String(colab.celular || '').trim();
  const correo = String(colab.correo || '').toLowerCase().trim();
  const cargo = String(colab.cargoActual || colab.cargoContrato || colab.cargo || 'COLABORADOR').toUpperCase().trim();
  const fechaInicio = colab.contratoBase?.inicio || colab.fechaInicio || '01/11/2026';
  const fechaFin = colab.contratoBase?.fin || colab.vigenciaActualHasta || colab.fechaFin || '31/01/2027';
  const sueldoNum = Number(colab.remuneracionActual || colab.contratoBase?.remuneracion || colab.sueldo || 1500);
  const sueldoFmt = sueldoNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sonLetras = numeroALetrasSoles(sueldoNum);
  const funciones = obtenerFuncionesPorCargo(cargo);
  const fechaSuscripcion = fechaALetras(fechaInicio);
  const yymmddIni = fechaCortaAYYMMDD(fechaInicio);
  const yymmddFin = fechaCortaAYYMMDD(fechaFin);
  const safeName = nombre.replace(/[^A-Z0-9ÑÁÉÍÓÚÜ ]/g, '').trim();
  const baseFileName = `GRUPO GASTRONOMICO AURORA SAC - CONTRATO - ${safeName} - ${yymmddIni} - ${yymmddFin} - 03`;

  return {
    nombre,
    tipoDoc,
    dni,
    domicilio,
    telefono,
    correo,
    cargo,
    fechaInicio,
    fechaFin,
    sueldoNum,
    sueldoFmt,
    sonLetras,
    funciones,
    fechaSuscripcion,
    baseFileName
  };
}

function runNormal(text, sz = 20) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function runBold(text, sz = 20, underline = false) {
  return `<w:r><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/><w:bCs/>${underline ? '<w:u w:val="single"/>' : ''}<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${xmlEscape(text)}</w:t></w:r>`;
}

function pJustified(runsXml, after = 120) {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:after="${after}" w:line="250" w:lineRule="auto"/></w:pPr>${runsXml}</w:p>`;
}

function pCenterBoldUnderlined(text, sz = 22) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="160"/></w:pPr>${runBold(text, sz, true)}</w:p>`;
}

function pClauseTitle(text) {
  return `<w:p><w:pPr><w:jc w:val="both"/><w:spacing w:before="140" w:after="60"/></w:pPr>${runBold(text, 20, true)}</w:p>`;
}

/**
 * Construye el XML OOXML completo con el ANEXO N° 001 + las 18 Cláusulas oficiales de 01_CONTRATOS_PERSONAL_PDF
 */
function buildContratoParagraphs(colab) {
  const d = extraerDatosContrato(colab);

  const causaObjetiva1 = `EL EMPLEADOR REQUIERE CONTRATAR LOS SERVICIOS DE EL TRABAJADOR, PARA REALIZAR LAS LABORES DE ${d.cargo} QUE SERÁ PARTE INTEGRAL DEL PRESENTE CONTRATO LABORAL, DEBIENDO SOMETERSE AL CUMPLIMIENTO ESTRICTO DE LA LABOR PARA LO CUAL HA SIDO CONTRATADO, BAJO LAS DIRECTIVAS QUE EMANEN DE EL EMPLEADOR.`;
  const causaObjetiva2 = `PARA EL FIN PROPUESTO EN EL SUB. PÁRRAFO PRECEDENTE EL TRABAJADOR OFRECE SUS SERVICIOS A SER PRESTADOS BAJO LA MODALIDAD DE "SERVICIOS MODALES POR INICIO O INCREMENTO DE ACTIVIDADES" BAJO LA DISPOSICIÓN DE LOS ARTÍCULOS 54° INCISO A) Y 57° DEL T.U.O. DE LA LEY DE PRODUCTIVIDAD Y COMPETITIVIDAD LABORAL, CONTENIDA EN EL D.S. 003-97-TR; CONTRATO QUE, POR SU NATURALEZA, TIENE LA CARACTERÍSTICA DE SER TEMPORAL.`;

  return [
    // ANEXO N° 001
    pCenterBoldUnderlined('ANEXO N° 001', 24),
    pCenterBoldUnderlined('CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES', 22),
    pJustified(runNormal('Conste por el presente documento, que las partes celebran según los datos que consignan tales como:')),

    pClauseTitle('I. DATOS DE EL EMPLEADOR.'),
    pJustified(runBold('Razón Social: ') + runNormal('GRUPO GASTRONOMICO AURORA S.A.C.   |   ') + runBold('RUC N°: ') + runNormal('20615117111'), 60),
    pJustified(runBold('Domicilio Fiscal: ') + runNormal('AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA'), 60),
    pJustified(runBold('Representante Legal: ') + runNormal('CARBAJAL URQUIZO GLADYS VERONICA   |   ') + runBold('Documento Identidad: ') + runNormal('DNI 42892738   |   ') + runBold('Cargo: ') + runNormal('GERENTE GENERAL'), 140),

    pClauseTitle('II. DATOS DE EL TRABAJADOR.'),
    pJustified(runBold('Apellidos y Nombres: ') + runNormal(d.nombre) + runNormal('   |   ') + runBold('Documento Identidad: ') + runNormal(`${d.tipoDoc} ${d.dni}`), 60),
    pJustified(runBold('Domicilio Actual: ') + runNormal(d.domicilio), 60),
    pJustified(runBold('Teléfono Actual: ') + runNormal(d.telefono || '-') + runNormal('   |   ') + runBold('Correo Electrónico: ') + runNormal(d.correo || '-'), 140),

    pClauseTitle('III. DATOS DE LA CONTRATACION.'),
    pJustified(runBold('Cargo: ') + runNormal(d.cargo) + runNormal('   |   ') + runBold('Tipo de Condición: ') + runNormal('CONTRATO   |   ') + runBold('Situación Especial: ') + runNormal('NINGUNA'), 60),
    pJustified(runBold('Fecha de Inicio: ') + runNormal(d.fechaInicio) + runNormal('   |   ') + runBold('Fecha de Término: ') + runNormal(d.fechaFin) + runNormal('   |   ') + runBold('Duración de Contrato: ') + runNormal('3 MESES 0 DIAS'), 60),
    pJustified(runBold('Periodo de Prueba: ') + runNormal(`${d.fechaInicio} Al: ${d.fechaFin}`) + runNormal('   |   ') + runBold('Régimen Laboral: ') + runNormal('MICRO EMPRESA D. LEG. 1086 (1)'), 60),
    pJustified(runBold('Remuneración EN ( S/ ): ') + runNormal(`SUELDO BÁSICO: ${d.sueldoFmt}   |   ASIGNACION FAMILIAR: 0.00`), 60),
    pJustified(runBold(`Total Remuneración Bruta: ${d.sueldoFmt}`) + runNormal(`   (SON : ${d.sonLetras})`), 100),
    pJustified(runBold('Causa Objetiva de Trabajo: ') + runNormal(causaObjetiva1 + ' ' + causaObjetiva2), 100),
    pJustified(runBold('Lugar de Trabajo: ') + runNormal('AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA'), 80),
    pJustified(runBold('Funciones: ') + runNormal(d.funciones), 100),
    pJustified(runNormal(`Suscrito y firmado en dos ejemplares en señal de conformidad, el ${d.fechaSuscripcion}.`), 180),

    // CUERPO DE LAS 18 CLÁUSULAS (PÁGINAS 3 A 7 DEL PDF EN DRIVE)
    pCenterBoldUnderlined('CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES', 22),
    pJustified(
      runNormal('Conste por el presente documento que se extiende por duplicado, el ') +
      runBold('“CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES”') +
      runNormal(', que celebran, de conformidad con el art. 63° del Texto Único Ordenado del Decreto Legislativo N.º 728 – Ley de Productividad y Competitividad Laboral aprobado por Decreto Supremo N.º 003-97–TR del 21.03.97, el Texto Único Ordenado de la Ley de Promoción de la Competitividad, Formalización y Desarrollo de la Micro y Pequeña Empresa y del Acceso al Empleo Decente, en adelante Ley Mype, aprobado por el artículo 56, y 57 del Decreto Supremo N.º 007-2008-TR, su Reglamento, aprobado por Decreto Supremo N.º 008-2008-TR; suscriben ') +
      runBold('LAS PARTES') +
      runNormal(' detalladas en el ') +
      runBold('ANEXO N.º 001') +
      runNormal(', en los términos y condiciones siguientes:')
    ),

    pClauseTitle('PRIMERA. – OBJETIVO SOCIAL'),
    pJustified(
      runBold('1.1. EL EMPLEADOR') +
      runNormal(', es una persona jurídica de derecho privado constituida bajo el régimen de sociedad anónima cerrada, que tiene por actividad comercial las actividades de restaurantes y de servicio móvil de comidas, en la ciudad de Trujillo, y en el resto del país, teniendo para ello las autorizaciones otorgadas por las Entidades del Estado locales y nacionales. Asimismo, cumple con los requisitos exigidos para ser considerado como una ') +
      runBold('MICRO EMPRESA, y cuenta con código de Registro REMYPE N.º 0002359064-2025, contratando según la Acreditación como MICRO EMPRESA con Fecha de Solicitud 27.11.2025 y Fecha de Acreditación 10.12.2025, según Ley de Promoción de la Micro y Pequeña Empresa con Reglamento, el D.S. N.º 009-2003-TR.', 20, true)
    ),
    pJustified(
      runBold('1.2. EL TRABAJADOR') +
      runNormal(', es una persona natural, mayor de edad, con plena capacidad de ejercicio para suscribir contratos y realizar las funciones por las que suscribe el presente contrato.')
    ),

    pClauseTitle('SEGUNDA. – CAUSA OBJETIVA'),
    pJustified(runBold('EL EMPLEADOR ') + runNormal('está facultado a contratar personal cuya ') + runBold('CAUSA OBJETIVA ') + runNormal('se describe en el ') + runBold('ANEXO N.º 001.')),

    pClauseTitle('TERCERA. – CARGO, CONDICIONES DE TRABAJO Y LA PRESTACIÓN DEL SERVICIO'),
    pJustified(runBold('3.1. EL TRABAJADOR ') + runNormal('desempeñará las labores descritas según detalle del ') + runBold('ANEXO N.º 001')),
    pJustified(runBold('3.2. LAS PARTES ') + runNormal('reconocen que ') + runBold('EL TRABAJADOR ') + runNormal('se obliga a: mantener, cuidar, resguardar y responsabilizarse por el adecuado control y uso de las herramientas de trabajo que ') + runBold('quedan bajo su entera y exclusiva responsabilidad,', 20, true) + runNormal(' durante el plazo del contrato de trabajo que ostente éste con ') + runBold('EL EMPLEADOR.')),
    pJustified(runBold('3.3. ') + runNormal('Queda entendido que la prestación de servicios deberá ser efectuada de manera personal, no pudiendo ') + runBold('EL TRABAJADOR ') + runNormal('ser reemplazado ni ayudado por tercera persona.')),
    pJustified(runBold('3.4. ') + runNormal('Si ') + runBold('EL TRABAJADOR ') + runNormal('abandona el trabajo por más de tres días consecutivos, si reincide en ausencias injustificadas por más de cinco días en un periodo de treinta días calendario o más de quince días en un periodo de ciento ochenta días calendario o la impuntualidad reiterada, serán sancionadas según el Reglamento Interno de Trabajo de la empresa.')),
    pJustified(runBold('3.5. EL TRABAJADOR') + runNormal(', se compromete a hacer fiel cumplimiento del artículo 18º del D.S. N.º 003-97-TR, el cual establece: “en caso de renuncia o retiro voluntario, el trabajador debe dar aviso escrito con 30 días de anticipación (…)”.')),
    pJustified(runBold('3.6. ') + runNormal('Se deja establecido por ambas partes que, en uso de las facultades directrices y de administración, ') + runBold('EL EMPLEADOR ') + runNormal('está facultado a efectuar modificaciones razonables en la forma de prestación de las labores a sus necesidades operativas, sin que dichas variaciones signifiquen menoscabo de categoría y/o remuneración.')),

    pClauseTitle('CUARTA. – PLAZO'),
    pJustified(runNormal('La duración del contrato se encuentra estipulada en el ') + runBold('ANEXO N.º 001.')),
    pJustified(runBold('4.1. Fecha de Inicio y Fin: ', 20, true) + runNormal('Tiempo estimado para cubrir los requerimientos a que se refiere la Cláusula Segunda, para el desarrollo de sus actividades. Dicho plazo podrá renovarse por escrito si la necesidad del servicio o causa objetiva así lo permite, y por acuerdo expreso entre las partes contratantes. En dicho supuesto se suscribirá el contrato y/o adenda respectiva.')),
    pJustified(runBold('4.2. Periodo De Prueba: EL TRABAJADOR', 20, true) + runNormal(', estará sujeto a un periodo de prueba conforme con lo dispuesto por el Artículo 10° y 75° del Decreto Supremo N.º 003-97-TR., Ley de Productividad y Competitividad Laboral. Queda entendido que ') + runBold('EL EMPLEADOR ') + runNormal('no está obligado a dar aviso alguno referente al término del presente contrato, operando el vencimiento de éste automáticamente en la fecha señalada en el párrafo anterior.')),

    pClauseTitle('QUINTA. – REMUNERACIÓN'),
    pJustified(runBold('EL EMPLEADOR') + runNormal(', se obliga a pagar la remuneración detallada en el ') + runBold('ANEXO N.º 001 ') + runNormal('la cual se pagará siempre que el trabajador cumpla con las siguientes condiciones:')),
    pJustified(runBold('5.1. ') + runNormal('Cumplir con oportunidad, puntualidad, y honradez, con sus horarios de llegada y salida.')),
    pJustified(runBold('5.2. ') + runNormal('En caso de incumplimiento de lo establecido en el Reglamento Interno de Trabajo de la empresa, ') + runBold('EL EMPLEADOR') + runNormal(', queda liberado a descontar de la remuneración, el importe de las sanciones que se apliquen tanto por el Cliente como por cualquier autoridad que hubiese aplicado sanción.')),
    pJustified(runBold('5.3. ') + runNormal('La remuneración que se establece, solo será pagada siempre que el trabajador contratado haya asistido a todos y cada uno de sus días de trabajo, de manera real y efectiva como condición de trabajo.')),
    pJustified(runBold('5.4. ') + runNormal('Sobre la Remuneración antes indicada que perciba ') + runBold('EL TRABAJADOR ') + runNormal('se deducirán las aportaciones y descuentos por tributos establecidos en la Ley, que resulten de aplicación.')),

    pClauseTitle('SEXTA. – DERECHOS DEL TRABAJADOR'),
    pJustified(runNormal('Le corresponde al trabajador:')),
    pJustified(runBold('6.1. EL TRABAJADOR ') + runNormal('tiene derecho a percibir su remuneración mensual, siempre que haya cumplido con lo establecido en el precedente artículo.')),
    pJustified(runBold('6.2. EL TRABAJADOR ') + runNormal('tiene derecho a tener los materiales necesarios para desarrollar sus funciones.')),
    pJustified(runBold('6.3. EL TRABAJADOR ') + runNormal('tiene derecho a recibir los beneficios que por ley corresponde.')),

    pClauseTitle('SETIMA. – OBLIGACIÓN DEL TRABAJADOR'),
    pJustified(runBold('7.1. EL TRABAJADOR ') + runNormal('se obliga a prestar sus servicios a ') + runBold('EL EMPLEADOR') + runNormal(', debiendo someterse al cumplimiento estricto de la labor para la cual ha sido contratado, bajo las directivas que emanen de sus jefes o instructores, de conformidad con las normas establecidas al respecto, incluyendo tanto el Reglamento Interno de Trabajo, como el de Seguridad e Higiene Ocupacional.')),
    pJustified(runBold('7.2. ') + runNormal('Cumplir con todas las funciones inherentes a su cargo y que le serán proporcionadas e informadas al momento de asumir el cargo y dentro del proceso de inducción.')),
    pJustified(runBold('7.3. ') + runNormal('Realizar personal, diligente y eficazmente las labores que se le encomienden, demostrando respeto y cortesía en el trato con sus superiores y con los demás.')),
    pJustified(runBold('7.4. ') + runNormal('Velar en todo momento por la buena imagen de la Empresa y de sus representantes, asumiendo la defensa de los intereses de ') + runBold('EL EMPLEADOR') + runNormal(', denunciando aquellas acciones que atenten contra él.')),
    pJustified(runBold('7.5. ') + runNormal('Cumplir con las normas y procedimientos que se impartan por necesidades del servicio en aplicación de las facultades administrativas definidas por ') + runBold('EL EMPLEADOR.')),
    pJustified(runBold('7.6. ') + runNormal('Mantener en reserva la información que por naturaleza de sus funciones le sea confiada.')),
    pJustified(runBold('7.7. ') + runNormal('Responsabilizarse por los bienes y equipos que se le faciliten para el cumplimiento de su trabajo.')),
    pJustified(runBold('7.8. ') + runNormal('Mantener informado al Empleador su decisión de renunciar al trabajo antes del término del presente contrato con una anticipación mínima de 30 días y por escrito.')),

    pClauseTitle('OCTAVA. – OBLIGACIÓN DE LA EMPRESA'),
    pJustified(runBold('EL EMPLEADOR ') + runNormal('se obliga a inscribir a ') + runBold('EL TRABAJADOR ') + runNormal('en la SUNAT, según D.S. N.º 018-2007-TR, Articulo 4-A, Establece lo siguiente: 8.1. ALTA DEL TRABAJADOR: Dentro del día que se produce el ingreso a prestar servicios. 8.2. BAJA DEL TRABAJADOR: Al día siguiente de extinguido el vínculo laboral. 8.3. MODIFICACIÓN DE DATOS DEL TRABAJADOR: 5 días hábiles de la fecha de ocurrencia del evento. Una vez obtenido la constancia del T-Registro, la empresa tiene el plazo de un día para entregar una copia al trabajador, consignando firma y huella digital por cada trabajador.')),

    pClauseTitle('NOVENA. - HORARIO DE TRABAJO, JORNADA DE TRABAJO Y DIA DE DESCANSO SEMANAL'),
    pJustified(runNormal('De acuerdo con las facultades de dirección y administración que la ley otorga, y dentro del marco establecido en el T.U.O. del Decreto Legislativo N.º 854 – Ley de Jornada de Trabajo, Horario de Trabajo y Sobretiempo, aprobado por D.S. N.º 007-2008-TR. ') + runBold('EL TRABAJADOR') + runNormal(', deberá prestar servicios de seis días de trabajo con un día de descanso a la semana OBLIGATORIO en forma rotativa según las estrategias comerciales y necesidades de ') + runBold('EL EMPLEADOR ') + runNormal('computable de 08 horas diarias de trabajo, equivalente a 48 horas semanales, tal como lo establece el artículo 2 del Decreto Legislativo N.º 713. La realización de labores en horas extras requerirá necesariamente de la aprobación previa, expresa y escrita por parte de ') + runBold('EL EMPLEADOR.')),

    pClauseTitle('DÉCIMA. – BUENA FE LABORAL'),
    pJustified(runBold('EL TRABAJADOR ') + runNormal('se obliga en forma expresa a poner al servicio de ') + runBold('EL EMPLEADOR ') + runNormal('toda su capacidad y lealtad. Así mismo, ') + runBold('EL TRABAJADOR ') + runNormal('se compromete siempre y en todo caso a obrar de buena fe en relación con su empleo y observar las políticas y normas que disponga ') + runBold('EL EMPLEADOR.')),

    pClauseTitle('DÉCIMA PRIMERA. – RESERVA, CONFIDENCIALIDAD Y COMPETENCIA'),
    pJustified(runBold('EL TRABAJADOR ') + runNormal('se compromete a mantener reserva y confidencialidad absoluta en relación con la información y documentación obtenida con ocasión de su trabajo para ') + runBold('EL EMPLEADOR') + runNormal(', así como a no competir con el mismo, manteniendo discreción absoluta, no revelando información confidencial o recetas, devolviendo todo material al resolverse el contrato y absteniéndose de competir directa o indirectamente durante la vigencia del vínculo laboral y hasta dos (2) años después de concluido.')),

    pClauseTitle('DÉCIMA SEGUNDA. - RECOMENDACIONES EN MATERIA DE PREVENCIÓN DE HOSTIGAMIENTO SEXUAL'),
    pJustified(runBold('EL EMPLEADOR ') + runNormal('informa mediante el presente contrato a ') + runBold('EL TRABAJADOR ') + runNormal('las recomendaciones sobre la prevención del Hostigamiento Sexual; conforme a lo dispuesto en la Ley N.º 27942 – Ley de Prevención y Sanción del Hostigamiento Sexual y su Reglamento D.S. N.º 010-2003-Mimdes.')),

    pClauseTitle('DÉCIMA TERCERA. – BENEFICIOS SOCIALES DE LA EMPRESA'),
    pJustified(runBold('EL TRABAJADOR ') + runNormal('tiene derecho a los beneficios sociales bajo el régimen de ') + runBold('MICROEMPRESA', 20, true) + runNormal(': 13.1. DESCANSO VACACIONAL: quince (15) días de descanso vacacional por cada año completo de servicios. 13.2. SISTEMA PREVISIONAL: ONP, AFP o SPS. 13.3. SEGURO REGULAR: asegurado regular administrado por SIS.')),

    pClauseTitle('DÉCIMA CUARTA. – RECOMENDACIONES DE SEGURIDAD Y SALUD'),
    pJustified(runBold('EL TRABAJADOR ') + runNormal('declara que recibe adjunto al presente contrato las recomendaciones de seguridad y salud en el trabajo conforme a la Ley N.º 29783 y su Reglamento D.S. N.º 005-2012-TR, obligándose a cumplir las normas, usar adecuadamente los EPP y comunicar cualquier incidente al departamento de Administración.')),

    pClauseTitle('DÉCIMA QUINTA. – RESOLUCIÓN DEL VÍNCULO LABORAL'),
    pJustified(runBold('15.1. EL TRABAJADOR') + runNormal(', de ser éste su primer contrato de labor, está sujeto al Período de Prueba establecido por la Ley de Productividad y Competitividad Laboral, equivalente a tres meses de labor. Durante dicho lapso, el empleador podrá resolver el presente contrato sin expresión de causa. Asimismo, son causas de resolución el incumplimiento de obligaciones, uso no autorizado de información, concurrir en estado de embriaguez, actos de violencia o grave indisciplina, el abandono de trabajo por más de tres días consecutivos y la culminación del presente contrato.')),

    pClauseTitle('DÉCIMA SEXTA. – SOLUCIÓN DE CONFLICTOS'),
    pJustified(runNormal('En caso de surgir algún conflicto con relación a la interpretación, ejecución o término del presente convenio, las partes tratarán de llegar a un acuerdo directo; de no ser posible, se someten a la jurisdicción de los jueces laborales de La Libertad, Perú.')),

    pClauseTitle('DÉCIMA SÉTIMA. – JURISDICCIÓN'),
    pJustified(runNormal('En caso de controversia o diferencias respecto a la aplicación del presente contrato, las partes contratantes se someten única y exclusivamente a la competencia y jurisdicción de los Jueces y Tribunales del Domicilio Fiscal de la Empresa.')),

    pClauseTitle('DÉCIMO OCTAVA. – DOMICILIO'),
    pJustified(runNormal('Las partes constituyen sus respectivos domicilios en los lugares señalados en el encabezamiento de este documento, donde serán válidas todas las citaciones y/o notificaciones que recíprocamente se cursaren, debiendo comunicar cualquier cambio dentro de los quince días siguientes de producido.')),
    pJustified(runNormal('Firmado por duplicado, en señal de conformidad y aprobación.'), 220)
  ].join('');
}

async function generarContratoBuffer(colab) {
  const d = extraerDatosContrato(colab);
  const templateContent = fs.readFileSync(templateBase);
  const zip = await JSZip.loadAsync(templateContent);
  let xml = await zip.file('word/document.xml').async('string');

  const bodyStart = xml.indexOf('<w:body>');
  const tblIndex = xml.indexOf('<w:tbl', bodyStart);
  const sectPrIndex = xml.indexOf('<w:sectPr', bodyStart);
  const customBody = buildContratoParagraphs(colab);

  if (tblIndex !== -1) {
    const beforeTbl = xml.slice(0, bodyStart + 8);
    let tableAndAfter = xml.slice(tblIndex);
    tableAndAfter = tableAndAfter.replace(/<w:t xml:space="preserve">\s*A<\/w:t>/g, '<w:t xml:space="preserve">                    </w:t>');
    tableAndAfter = tableAndAfter.replace(/AESQUIVEL RODRIGUEZ KARLA DAYAN/g, xmlEscape(d.nombre));
    tableAndAfter = tableAndAfter.replace(/ESQUIVEL RODRIGUEZ KARLA DAYAN/g, xmlEscape(d.nombre));
    tableAndAfter = tableAndAfter.replace(/73576771/g, xmlEscape(d.dni));
    xml = beforeTbl + customBody + tableAndAfter;
  } else if (sectPrIndex !== -1) {
    xml = xml.slice(0, bodyStart + 8) + customBody + xml.slice(sectPrIndex);
  }

  zip.file('word/document.xml', xml);
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  const fileName = `${d.baseFileName}.docx`;
  return { fileName, buffer };
}

/**
 * Genera la réplica HTML imprimible 1:1 del PDF de 7 páginas en 01_CONTRATOS_PERSONAL_PDF
 */
function generarHtmlContrato(colab) {
  const d = extraerDatosContrato(colab);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>${htmlEscape(d.baseFileName)}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.42;
      color: #000;
      margin: 0;
      padding: 20px;
      background: #fff;
    }
    .page-sheet {
      max-width: 780px;
      margin: 0 auto 28px;
      padding-bottom: 18px;
      border-bottom: 1.5px solid #000;
      page-break-after: always;
    }
    .page-sheet:last-child { page-break-after: auto; }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid #000;
      padding-bottom: 6px;
      margin-bottom: 14px;
    }
    .aurora-logo-text {
      font-family: Georgia, serif;
      font-style: italic;
      font-size: 24pt;
      line-height: 1;
    }
    .aurora-logo-sub {
      font-family: Arial, sans-serif;
      font-style: normal;
      font-size: 6.5pt;
      letter-spacing: 0.25em;
      display: block;
      margin-top: 2px;
    }
    .header-company {
      text-align: right;
      font-weight: bold;
      font-size: 9.5pt;
    }
    .anexo-title {
      text-align: center;
      font-weight: bold;
      font-size: 12pt;
      text-decoration: underline;
      margin: 6px 0 8px;
    }
    .contract-main-title {
      text-align: center;
      font-weight: bold;
      font-size: 10.5pt;
      text-decoration: underline;
      margin: 8px 0 12px;
    }
    table.anexo-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    table.anexo-table th,
    table.anexo-table td {
      border: 1px solid #999;
      padding: 5px 8px;
      vertical-align: top;
      text-align: left;
    }
    table.anexo-table tr.sec-row th {
      background: #EFEFEF;
      font-size: 9.5pt;
      font-weight: bold;
      text-decoration: underline;
      color: #000;
    }
    .lbl { width: 24%; font-weight: normal; color: #222; }
    .val { font-weight: normal; color: #000; }
    .clause-title {
      font-weight: bold;
      text-decoration: underline;
      margin: 10px 0 4px;
      font-size: 10pt;
    }
    p {
      margin: 0 0 7px;
      text-align: justify;
    }
    .sign-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 48px;
      gap: 20px;
    }
    .sign-col {
      width: 38%;
      text-align: center;
      border-top: 1px dashed #000;
      padding-top: 6px;
      font-size: 8.5pt;
    }
    .huella-box {
      width: 72px;
      height: 92px;
      border: 1.5px solid #000;
      border-radius: 8px;
    }
    .doc-footer {
      margin-top: 18px;
      padding-top: 6px;
      border-top: 1.5px solid #000;
      text-align: center;
      font-size: 8pt;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width:780px; margin:0 auto 14px; display:flex; justify-content:flex-end; gap:8px;">
    <button onclick="window.print()" style="padding:8px 16px; background:#FF6008; color:#fff; border:none; font-weight:bold; cursor:pointer;">IMPRIMIR / GUARDAR PDF</button>
  </div>

  <!-- PÁGINAS 1 Y 2: ANEXO N° 001 -->
  <section class="page-sheet">
    <div class="doc-header">
      <div class="aurora-logo-text">Aurora<span class="aurora-logo-sub">RESTAURANT</span></div>
      <div class="anexo-title" style="margin:0;">ANEXO N° 001</div>
      <div style="width:120px;"></div>
    </div>

    <div class="contract-main-title">CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES</div>
    <p>Conste por el presente documento, que las partes celebran según los datos que consignan tales como:</p>

    <table class="anexo-table">
      <tr class="sec-row"><th colspan="4">I. DATOS DE EL EMPLEADOR.</th></tr>
      <tr><td class="lbl">Razón Social:</td><td colspan="3">GRUPO GASTRONOMICO AURORA S.A.C.</td></tr>
      <tr><td class="lbl">RUC N°:</td><td colspan="3">20615117111</td></tr>
      <tr><td class="lbl">Domicilio Fiscal:</td><td colspan="3">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</td></tr>
      <tr><td class="lbl">Representante Legal:</td><td colspan="3">CARBAJAL URQUIZO GLADYS VERONICA</td></tr>
      <tr><td class="lbl">Documento Identidad:</td><td colspan="3">DNI 42892738</td></tr>
      <tr><td class="lbl">Cargo:</td><td colspan="3">GERENTE GENERAL</td></tr>

      <tr class="sec-row"><th colspan="4">II. DATOS DE EL TRABAJADOR.</th></tr>
      <tr><td class="lbl">Apellidos y Nombres:</td><td colspan="3"><strong>${htmlEscape(d.nombre)}</strong></td></tr>
      <tr><td class="lbl">Documento Identidad:</td><td colspan="3">${htmlEscape(d.tipoDoc)} ${htmlEscape(d.dni)}</td></tr>
      <tr><td class="lbl">Domicilio Actual:</td><td colspan="3">${htmlEscape(d.domicilio)}</td></tr>
      <tr><td class="lbl">Teléfono Actual:</td><td colspan="3">${htmlEscape(d.telefono || '-')}</td></tr>
      <tr><td class="lbl">Correo Electrónico:</td><td colspan="3">${htmlEscape(d.correo || '-')}</td></tr>

      <tr class="sec-row"><th colspan="4">III. DATOS DE LA CONTRATACION.</th></tr>
      <tr><td class="lbl">Cargo:</td><td colspan="3"><strong>${htmlEscape(d.cargo)}</strong></td></tr>
      <tr><td class="lbl">Tipo de Condición:</td><td>CONTRATO</td><td class="lbl">Situación Especial:</td><td>NINGUNA</td></tr>
      <tr><td class="lbl">Fecha de Inicio:</td><td>${htmlEscape(d.fechaInicio)}</td><td class="lbl">Fecha de Término:</td><td>${htmlEscape(d.fechaFin)}</td></tr>
      <tr><td class="lbl">Duración de Contrato:</td><td colspan="3">3 MESES 0 DIAS</td></tr>
      <tr><td class="lbl">Periodo de Prueba:</td><td>${htmlEscape(d.fechaInicio)}</td><td class="lbl">Al:</td><td>${htmlEscape(d.fechaFin)}</td></tr>
      <tr><td class="lbl">Régimen Laboral :</td><td colspan="3">MICRO EMPRESA D. LEG. 1086 (1)</td></tr>
      <tr><td class="lbl">Remuneración:</td><td colspan="3">EN ( S/ )</td></tr>
      <tr><td class="lbl"></td><td>SUELDO BÁSICO: <strong>${htmlEscape(d.sueldoFmt)}</strong></td><td>ASIGNACION FAMILIAR:</td><td>0.00</td></tr>
      <tr><td colspan="4"><strong>Total Remuneración Bruta: &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${htmlEscape(d.sueldoFmt)}</strong><br/>SON : ${htmlEscape(d.sonLetras)}</td></tr>
      <tr>
        <td class="lbl">Causa Objetiva de Trabajo:</td>
        <td colspan="3">
          EL EMPLEADOR REQUIERE CONTRATAR LOS SERVICIOS DE EL TRABAJADOR, PARA REALIZAR LAS LABORES DE <strong>${htmlEscape(d.cargo)}</strong> QUE SERÁ PARTE INTEGRAL DEL PRESENTE CONTRATO LABORAL, DEBIENDO SOMETERSE AL CUMPLIMIENTO ESTRICTO DE LA LABOR PARA LO CUAL HA SIDO CONTRATADO, BAJO LAS DIRECTIVAS QUE EMANEN DE EL EMPLEADOR.<br/>
          PARA EL FIN PROPUESTO EN EL SUB. PÁRRAFO PRECEDENTE EL TRABAJADOR OFRECE SUS SERVICIOS A SER PRESTADOS BAJO LA MODALIDAD DE “SERVICIOS MODALES POR INICIO O INCREMENTO DE ACTIVIDADES” BAJO LA DISPOSICIÓN DE LOS ARTÍCULOS 54° INCISO A) Y 57° DEL T.U.O. DE LA LEY DE PRODUCTIVIDAD Y COMPETITIVIDAD LABORAL, CONTENIDA EN EL D.S. 003-97-TR; CONTRATO QUE, POR SU NATURALEZA, TIENE LA CARACTERÍSTICA DE SER TEMPORAL.
        </td>
      </tr>
      <tr><td class="lbl">Lugar de Trabajo:</td><td colspan="3">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</td></tr>
      <tr><td class="lbl">Funciones:</td><td colspan="3">${htmlEscape(d.funciones)}</td></tr>
    </table>

    <p>Suscrito y firmado en dos ejemplares en señal de conformidad, el ${htmlEscape(d.fechaSuscripcion)}.</p>

    <div class="sign-row">
      <div class="sign-col">
        CARBAJAL URQUIZO GLADYS VERONICA<br/>
        DNI 42892738<br/>
        <strong>EL EMPLEADOR</strong>
      </div>
      <div class="sign-col">
        ${htmlEscape(d.nombre)}<br/>
        ${htmlEscape(d.tipoDoc)} ${htmlEscape(d.dni)}<br/>
        <strong>EL TRABAJADOR</strong>
      </div>
      <div class="huella-box" title="Huella Digital"></div>
    </div>

    <div class="doc-footer">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</div>
  </section>

  <!-- PÁGINAS 3 A 7: CLÁUSULAS DEL CONTRATO -->
  <section class="page-sheet">
    <div class="doc-header">
      <div class="aurora-logo-text">Aurora<span class="aurora-logo-sub">RESTAURANT</span></div>
      <div class="header-company">GRUPO GASTRONOMICO AURORA SAC<br/>RUC: 20615117111</div>
    </div>

    <div class="contract-main-title">CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES</div>

    <p>Conste por el presente documento que se extiende por duplicado, el “CONTRATO DE TRABAJO DE NATURALEZA TEMPORAL POR INICIO DE ACTIVIDADES”, que celebran, de conformidad con el art. 63° del Texto Único Ordenado del Decreto Legislativo N.º 728 – Ley de Productividad y Competitividad Laboral aprobado por Decreto Supremo N.º 003-97–TR del 21.03.97, el Texto Único Ordenado de la Ley de Promoción de la Competitividad, Formalización y Desarrollo de la Micro y Pequeña Empresa y del Acceso al Empleo Decente, en adelante <u>Ley Mype</u>, aprobado por el artículo 56, y 57 del Decreto Supremo N.º 007-2008-TR, su Reglamento, aprobado por Decreto Supremo N.º 008-2008-TR; suscriben <strong>LAS PARTES</strong> detalladas en el <strong>ANEXO N.º 001</strong>, en los términos y condiciones siguientes:</p>

    <div class="clause-title">PRIMERA. – OBJETIVO SOCIAL</div>
    <p><strong>1.1. EL EMPLEADOR</strong>, es una persona jurídica de derecho privado constituida bajo el régimen de sociedad anónima cerrada, que tiene por actividad comercial las actividades de restaurantes y de servicio móvil de comidas, en la ciudad de Trujillo, y en el resto del país, teniendo para ello las autorizaciones otorgadas por las Entidades del Estado locales y nacionales.<br/>
    <u>Asimismo, cumple con los requisitos exigidos para ser considerado como una <strong>MICRO EMPRESA, y cuenta con código de Registro REMYPE N.º 0002359064-2025, contratando según la Acreditación como MICRO EMPRESA con Fecha de Solicitud 27.11.2025 y Fecha de Acreditación 10.12.2025</strong>, según Ley de Promoción de la Micro y Pequeña Empresa con Reglamento, el D.S. N.º 009-2003-TR.</u></p>
    <p><strong>1.2. EL TRABAJADOR</strong>, es una persona natural, mayor de edad, con plena capacidad de ejercicio para suscribir contratos y realizar las funciones por las que suscribe el presente contrato.</p>

    <div class="clause-title">SEGUNDA. – CAUSA OBJETIVA</div>
    <p><strong>EL EMPLEADOR</strong> está facultado a contratar personal cuya <strong>CAUSA OBJETIVA</strong> se describe en el <strong>ANEXO N.º 001</strong>.</p>

    <div class="clause-title">TERCERA. – CARGO, CONDICIONES DE TRABAJO Y LA PRESTACIÓN DEL SERVICIO</div>
    <p><strong>3.1. EL TRABAJADOR</strong> desempeñará las labores descritas según detalle del <strong>ANEXO N.º 001</strong>.</p>
    <p><strong>3.2. LAS PARTES</strong> reconocen que <strong>EL TRABAJADOR</strong> se obliga a: <u>mantener, cuidar, resguardar y responsabilizarse</u> por el adecuado control y uso de las herramientas de trabajo que <strong><u>quedan bajo su entera y exclusiva responsabilidad</u></strong>, durante el plazo del contrato de trabajo que ostente éste con <strong>EL EMPLEADOR</strong>.</p>
    <p><strong>3.3.</strong> Queda entendido que la prestación de servicios deberá ser efectuada de manera personal, no pudiendo <strong>EL TRABAJADOR</strong> ser reemplazado ni ayudado por tercera persona.</p>
    <p><strong>3.4.</strong> Si <strong>EL TRABAJADOR</strong> abandona el trabajo por más de tres días consecutivos, si reincide en ausencias injustificadas por más de cinco días en un periodo de treinta días calendario o más de quince días en un periodo de ciento ochenta días calendario o la impuntualidad reiterada, serán sancionadas según el Reglamento Interno de Trabajo de la empresa.</p>
    <p><strong>3.5. EL TRABAJADOR</strong>, se compromete a hacer fiel cumplimiento del artículo 18º del D.S. N.º 003-97-TR, el cual establece: <em><u>“en caso de renuncia o retiro voluntario, el trabajador debe dar aviso escrito con 30 días de anticipación (…)”</u></em>.</p>
    <p><strong>3.6.</strong> Se deja establecido por ambas partes que, en uso de las facultades directrices y de administración, <strong>EL EMPLEADOR</strong> está facultado a efectuar modificaciones razonables en la forma de prestación de las labores a sus necesidades operativas, sin que dichas variaciones signifiquen menoscabo de categoría y/o remuneración.</p>

    <div class="clause-title">CUARTA. – PLAZO</div>
    <p>La duración del contrato se encuentra estipulada en el <strong>ANEXO N.º 001</strong>.<br/>
    <strong>4.1. <u>Fecha de Inicio y Fin:</u></strong> Tiempo estimado para cubrir los requerimientos a que se refiere la Cláusula Segunda, para el desarrollo de sus actividades. Dicho plazo podrá renovarse por escrito si la necesidad del servicio o causa objetiva así lo permite, y por acuerdo expreso entre las partes contratantes. En dicho supuesto se suscribirá el contrato y/o adenda respectiva.<br/>
    <strong>4.2. <u>Periodo De Prueba:</u> EL TRABAJADOR</strong>, estará sujeto a un periodo de prueba conforme con lo dispuesto por el Artículo 10° y 75° del Decreto Supremo N.º 003-97-TR., Ley de Productividad y Competitividad Laboral.<br/>
    <u>Queda entendido que <strong>EL EMPLEADOR</strong> no está obligado a dar aviso alguno referente al término del presente contrato, operando el vencimiento de éste automáticamente en la fecha señalada en el párrafo anterior.</u></p>

    <div class="clause-title">QUINTA. – REMUNERACIÓN</div>
    <p><strong>EL EMPLEADOR</strong>, se obliga a pagar la remuneración detallada en el <strong>ANEXO N.º 001</strong> la cual se pagará siempre que el trabajador cumpla con las siguientes condiciones:<br/>
    <strong>5.1.</strong> Cumplir con <u>oportunidad, puntualidad, y honradez</u>, con sus horarios de llegada y salida.<br/>
    <strong>5.2.</strong> En caso de incumplimiento de lo establecido en el Reglamento Interno de Trabajo de la empresa, <strong>EL EMPLEADOR</strong>, queda liberado a descontar de la remuneración, el importe de las sanciones que se apliquen.<br/>
    <strong>5.3.</strong> La remuneración que se establece, solo será pagada siempre que el trabajador contratado haya asistido a todos y cada uno de sus días de trabajo, de manera real y efectiva como condición de trabajo.<br/>
    <strong>5.4.</strong> Sobre la Remuneración antes indicada que perciba <strong>EL TRABAJADOR</strong> se deducirán las aportaciones y descuentos por tributos establecidos en la Ley, que resulten de aplicación.</p>

    <div class="clause-title">SEXTA. – DERECHOS DEL TRABAJADOR</div>
    <p><strong>6.1. EL TRABAJADOR</strong> tiene derecho a percibir su remuneración mensual, siempre que haya cumplido con lo establecido en el precedente artículo.<br/>
    <strong>6.2. EL TRABAJADOR</strong> tiene derecho a tener los materiales necesarios para desarrollar sus funciones.<br/>
    <strong>6.3. EL TRABAJADOR</strong> tiene derecho a recibir los beneficios que por ley corresponde.</p>

    <div class="clause-title">SETIMA. – OBLIGACIÓN DEL TRABAJADOR</div>
    <p><strong>7.1. EL TRABAJADOR</strong> se obliga a prestar sus servicios a <strong>EL EMPLEADOR</strong>, sometiéndose al cumplimiento estricto de la labor contratada, incluyendo el Reglamento Interno de Trabajo y el de Seguridad e Higiene Ocupacional, cumpliendo las funciones inherentes a su cargo (7.2 al 7.8) y manteniendo informado al Empleador su decisión de renunciar con una anticipación mínima de 30 días y por escrito.</p>

    <div class="clause-title">OCTAVA. – OBLIGACIÓN DE LA EMPRESA</div>
    <p><strong>EL EMPLEADOR</strong> se obliga a inscribir a <strong>EL TRABAJADOR</strong> en la SUNAT, según D.S. N.º 018-2007-TR, Artículo 4-A (8.1 Alta del trabajador dentro del día de ingreso; 8.2 Baja al día siguiente de extinguido el vínculo; 8.3 Modificación de datos en 5 días hábiles).</p>

    <div class="clause-title">NOVENA. - HORARIO DE TRABAJO, JORNADA DE TRABAJO Y DIA DE DESCANSO SEMANAL</div>
    <p><strong>EL TRABAJADOR</strong> deberá prestar servicios de <u>seis días de trabajo con un día de descanso a la semana OBLIGATORIO</u> en forma rotativa según las estrategias comerciales y necesidades de <strong>EL EMPLEADOR</strong> computable de <u>08 horas diarias de trabajo, equivalente a 48 horas semanales</u>, conforme al D.Leg. N.º 854 y D.Leg. N.º 713.</p>

    <div class="clause-title">DÉCIMA. – BUENA FE LABORAL</div>
    <p><strong>EL TRABAJADOR</strong> se obliga en forma expresa a poner al servicio de <strong>EL EMPLEADOR</strong> toda su capacidad y lealtad, obrando de buena fe en relación con su empleo.</p>

    <div class="clause-title">DÉCIMA PRIMERA. – RESERVA, CONFIDENCIALIDAD Y COMPETENCIA</div>
    <p><strong>EL TRABAJADOR</strong> se compromete a mantener <u>reserva y confidencialidad absoluta</u> en relación con la información y documentación obtenida con ocasión de su trabajo para <strong>EL EMPLEADOR</strong>, así como a <u>no competir con el mismo</u> (1. Reserva y Confidencialidad literales a-f; 2. No Competencia literales a-d).</p>

    <div class="clause-title">DÉCIMA SEGUNDA. - RECOMENDACIONES EN MATERIA DE PREVENCIÓN DE HOSTIGAMIENTO SEXUAL</div>
    <p><strong>EL EMPLEADOR</strong> informa mediante el presente contrato a <strong>EL TRABAJADOR</strong> las recomendaciones sobre la prevención del Hostigamiento Sexual conforme a la Ley N.º 27942 y su Reglamento D.S. N.º 010-2003-Mimdes (numerales 12.1 al 12.7).</p>

    <div class="clause-title">DÉCIMA TERCERA. – BENEFICIOS SOCIALES DE LA EMPRESA</div>
    <p><strong>EL TRABAJADOR</strong> tiene derecho a los beneficios sociales bajo el régimen de <strong><u>MICROEMPRESA</u></strong>: <strong>13.1. DESCANSO VACACIONAL:</strong> quince (15) días por cada año completo de servicios. <strong>13.2. SISTEMA PREVISIONAL:</strong> ONP, AFP o SPS. <strong>13.3. SEGURO REGULAR:</strong> asegurado regular administrado por SIS.</p>

    <div class="clause-title">DÉCIMA CUARTA. – RECOMENDACIONES DE SEGURIDAD Y SALUD</div>
    <p><strong>EL TRABAJADOR</strong> declara que recibe adjunto al presente contrato las recomendaciones de seguridad y salud en el trabajo conforme a la Ley N.º 29783 y su Reglamento D.S. N.º 005-2012-TR (numerales 14.1 al 14.9).</p>

    <div class="clause-title">DÉCIMA QUINTA. – RESOLUCIÓN DEL VÍNCULO LABORAL</div>
    <p><strong>15.1. EL TRABAJADOR</strong>, de ser éste su primer contrato de labor, <u>está sujeto al Período de Prueba</u> establecido por la Ley de Productividad y Competitividad Laboral, equivalente a tres meses de labor. <u>Durante dicho lapso, el empleador podrá resolver el presente contrato sin expresión de causa</u> (numerales 15.1 al 15.7).</p>

    <div class="clause-title">DÉCIMA SEXTA. – SOLUCIÓN DE CONFLICTOS / DÉCIMA SÉTIMA. – JURISDICCIÓN / DÉCIMO OCTAVA. – DOMICILIO</div>
    <p>Las partes se someten a la jurisdicción de los jueces laborales de La Libertad, Perú, y constituyen sus respectivos domicilios en los lugares señalados en el encabezamiento de este documento. Firmado por duplicado, en señal de conformidad y aprobación.</p>

    <div class="sign-row">
      <div class="sign-col"><strong>EL EMPLEADOR</strong></div>
      <div class="sign-col"><strong>EL TRABAJADOR</strong></div>
      <div class="huella-box" title="Huella Digital"></div>
    </div>

    <div class="doc-footer">AV. VICTOR LARCO HERRERA NRO. 2164 URB. SAN ANDRES V ETAPA LA LIBERTAD - TRUJILLO - VICTOR LARCO HERRERA</div>
  </section>
</body>
</html>`;
}

module.exports = {
  generarContratoBuffer,
  generarHtmlContrato,
  extraerDatosContrato
};
