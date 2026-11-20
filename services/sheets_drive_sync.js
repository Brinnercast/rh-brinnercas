/**
 * SINCRONIZADOR EN VIVO PARA ALTAS DE PRIMER INGRESO -> GOOGLE SHEETS & GOOGLE DRIVE
 * GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { cargarPadron, guardarPadron, cargarManifest } = require('./audit_engine');
const { generarContratoBuffer } = require('./contrato_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DOCS_DIR = path.join(ROOT_DIR, 'public', 'docs');
const DATA_DIR = path.join(ROOT_DIR, 'data');

function quoteArg(arg) {
  const s = String(arg ?? '');
  if (s === '') return '""';
  if (/[\s"&|<>^()%]/.test(s)) {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return s;
}

function runCliSafe(bin, args) {
  const cmd = `${bin} ${args.map(quoteArg).join(' ')}`;
  const out = execSync(cmd, { encoding: 'utf8', maxBuffer: 15 * 1024 * 1024 }).trim();
  const idxObj = out.indexOf('{');
  const idxArr = out.indexOf('[');
  let start = -1;
  if (idxObj !== -1 && idxArr !== -1) start = Math.min(idxObj, idxArr);
  else start = Math.max(idxObj, idxArr);
  if (start !== -1) {
    try { return JSON.parse(out.slice(start)); } catch (e) {}
  }
  const m = out.match(/\(ID:\s*([a-zA-Z0-9_-]+)\)/i)
    || out.match(/ID:\s*([a-zA-Z0-9_-]+)/i)
    || out.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  return m ? { id: m[1], raw: out } : { raw: out };
}

function escapeCell(val) {
  return String(val ?? '').replace(/[\r\n]+/g, ' ').replace(/,/g, '\\,').replace(/\|/g, '/');
}

function calcularFechaFin3Meses(fechaInicioStr) {
  const parts = String(fechaInicioStr || '').split('/');
  if (parts.length !== 3) return '';
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  const dt = new Date(y, m + 3, d - 1);
  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${dt.getFullYear()}`;
}

async function registrarNuevoIngreso(payload) {
  const padron = cargarPadron();
  const manifest = cargarManifest();

  const dni = String(payload.dni || '').trim();
  const nombre = String(payload.nombre || '').toUpperCase().trim();
  if (!dni || !nombre) throw new Error('El DNI y los Apellidos y Nombres son obligatorios.');
  if (padron.colaboradores.some(c => c.dni === dni)) {
    throw new Error(`Ya existe un colaborador registrado con el DNI ${dni}.`);
  }

  const nextId = padron.colaboradores.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  const fechaInicio = payload.fechaInicio || new Date().toLocaleDateString('es-PE');
  const fechaFin = payload.fechaFin || calcularFechaFin3Meses(fechaInicio);
  const sueldo = parseFloat(payload.sueldo || 1500);
  const area = String(payload.area || 'Salón').trim();
  const cargo = String(payload.cargo || 'Mozo').trim();
  const condicion = String(payload.condicion || 'FULL TIME').trim();
  const rawCL = String(payload.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  const condicionLaboral = ['CONTRATO', 'RXH', 'OTROS'].includes(rawCL) ? rawCL : 'CONTRATO';

  const nuevoColab = {
    id: nextId,
    nombre,
    dni,
    tipoDocumento: payload.tipoDocumento || 'DNI',
    carpetaAdendas: nombre.split(' ').slice(0, 2).join(' '),
    area,
    cargoContrato: cargo,
    cargoActual: cargo,
    condicionLaborable: condicion,
    condicionLaboral,
    domicilio: String(payload.domicilio || '').trim() || 'Trujillo, La Libertad',
    fechaNacimiento: payload.fechaNacimiento || '',
    edad: payload.edad || '',
    celular: payload.celular || '',
    correo: payload.correo || '',
    banco: payload.banco || '',
    numeroCuenta: payload.numeroCuenta || '',
    carnetSanitario: payload.carnetSanitario || 'NO',
    contratoBase: {
      inicio: fechaInicio,
      fin: fechaFin,
      remuneracion: sueldo
    },
    adendas: [],
    estado: 'ACTIVO',
    remuneracionActual: sueldo,
    vigenciaActualHasta: fechaFin,
    proximaAdenda: '1RA ADENDA',
    observaciones: payload.observaciones || `Ingreso registrado vía RH BRINNERCAS el ${new Date().toLocaleDateString('es-PE')}`,
    documentos: {
      contrato: null,
      adendas: [],
      memorandums: [],
      liquidacion: null,
      fotoDni: null
    }
  };

  // 1. Procesar archivo Foto de DNI adjunto (Base64 DataURL) si existe
  if (payload.fotoDniBase64 && payload.fotoDniName) {
    try {
      const base64Body = payload.fotoDniBase64.includes('base64,')
        ? payload.fotoDniBase64.split('base64,')[1]
        : payload.fotoDniBase64;
      const ext = path.extname(payload.fotoDniName) || '.pdf';
      const localDniName = `DNI_${dni}_${nombre.replace(/[^A-Z0-9]/g, '_')}${ext}`;
      const localDniPath = path.join(DOCS_DIR, 'dni', localDniName);
      fs.writeFileSync(localDniPath, Buffer.from(base64Body, 'base64'));

      let driveDni = null;
      if (manifest?.drive?.subfolders?.fotosDni?.id) {
        driveDni = runCliSafe('gdrive', ['mutate', 'upload', localDniPath, '--parent', manifest.drive.subfolders.fotosDni.id, '--json']);
      }
      nuevoColab.documentos.fotoDni = {
        fileName: localDniName,
        originalName: payload.fotoDniName,
        localUrl: `/docs/dni/${encodeURIComponent(localDniName)}`,
        driveId: driveDni?.id || null,
        driveUrl: driveDni?.id ? `https://drive.google.com/file/d/${driveDni.id}/view` : null
      };
    } catch (e) {
      console.warn('[WARN] Error subiendo DNI a Drive:', e.message);
    }
  }

  // 2. Generar Contrato Inicial .docx local y subir a Drive
  try {
    const contratoDoc = await generarContratoBuffer(nuevoColab);
    const localContratoPath = path.join(DOCS_DIR, 'contratos', contratoDoc.fileName);
    fs.writeFileSync(localContratoPath, contratoDoc.buffer);

    let driveContrato = null;
    if (manifest?.drive?.subfolders?.contratos?.id) {
      driveContrato = runCliSafe('gdrive', ['mutate', 'upload', localContratoPath, '--parent', manifest.drive.subfolders.contratos.id, '--json']);
    }
    nuevoColab.documentos.contrato = {
      fileName: contratoDoc.fileName,
      localUrl: `/docs/contratos/${encodeURIComponent(contratoDoc.fileName)}`,
      driveId: driveContrato?.id || null,
      driveUrl: driveContrato?.id ? `https://drive.google.com/file/d/${driveContrato.id}/view` : null
    };
  } catch (e) {
    console.warn('[WARN] Error generando/subiendo contrato inicial:', e.message);
  }

  // 3. Guardar en Padrón JSON local y copia de skill
  padron.colaboradores.push(nuevoColab);
  guardarPadron(padron);

  const skillPadronPath = path.join(ROOT_DIR, '..', '.agents', 'skills', 'aurora-laboral-adendas', 'resources', 'padron_personal_aurora_2026.json');
  if (fs.existsSync(skillPadronPath)) {
    try {
      fs.writeFileSync(skillPadronPath, JSON.stringify(padron, null, 2), 'utf8');
    } catch (e) {}
  }

  // 4. Sincronizar en Google Sheets en tiempo real (Hoja Maestra RH BRINNERCAS + Hoja Histórica)
  const sheetSyncResult = { masterSynced: false, historicalSynced: false, errors: [] };
  const marcaTemporal = new Date().toLocaleString('es-PE');

  if (manifest?.sheets?.masterSheetId) {
    try {
      const batchFile = path.join(DATA_DIR, `append_${dni}.json`);
      const rowNuevo = [
        marcaTemporal,
        nuevoColab.tipoDocumento,
        dni,
        nombre,
        area,
        cargo,
        condicion,
        nuevoColab.fechaNacimiento,
        nuevoColab.edad,
        String(sueldo),
        fechaInicio,
        fechaFin,
        nuevoColab.domicilio,
        nuevoColab.celular,
        nuevoColab.banco,
        nuevoColab.numeroCuenta,
        nuevoColab.carnetSanitario,
        nuevoColab.correo,
        nuevoColab.documentos.fotoDni?.driveUrl || '',
        nuevoColab.documentos.contrato?.driveUrl || '',
        condicionLaboral
      ];
      const rowPadron = [
        String(nuevoColab.id),
        dni,
        nombre,
        area,
        cargo,
        condicion,
        condicionLaboral === 'RXH' ? 'RXH' : (condicionLaboral === 'OTROS' ? 'APOYO' : 'ACTIVO'),
        fechaInicio,
        fechaFin,
        String(sueldo),
        nuevoColab.domicilio,
        nuevoColab.celular,
        nuevoColab.correo,
        nuevoColab.banco ? `${nuevoColab.banco} ${nuevoColab.numeroCuenta}`.trim() : '',
        nuevoColab.documentos.fotoDni?.driveUrl || '',
        nuevoColab.documentos.contrato?.driveUrl || '',
        '',
        condicionLaboral
      ];
      fs.writeFileSync(batchFile, JSON.stringify([
        { op: 'append', range: '2_NUEVOS_INGRESOS!A1', data: [rowNuevo] },
        { op: 'append', range: '1_PADRON_GENERAL!A1', data: [rowPadron] }
      ]), 'utf8');
      runCliSafe('gsheets', ['mutate', 'batch', manifest.sheets.masterSheetId, '-f', batchFile]);
      fs.unlinkSync(batchFile);
      sheetSyncResult.masterSynced = true;
    } catch (e) {
      sheetSyncResult.errors.push(`Master Sheet: ${e.message}`);
    }
  }

  const histId = manifest?.sheets?.historicalSheetId || '1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM';
  try {
    const batchHist = path.join(DATA_DIR, `append_hist_${dni}.json`);
    const rowHist = [
      marcaTemporal,
      nuevoColab.tipoDocumento,
      dni,
      nombre,
      area.toUpperCase(),
      cargo.toUpperCase(),
      condicion.toUpperCase(),
      nuevoColab.fechaNacimiento,
      nuevoColab.edad,
      String(sueldo),
      fechaInicio,
      nuevoColab.celular,
      nuevoColab.banco,
      nuevoColab.numeroCuenta,
      nuevoColab.carnetSanitario,
      nuevoColab.correo,
      nuevoColab.documentos.fotoDni?.driveUrl || '',
      'ACTIVO',
      '',
      condicionLaboral === 'CONTRATO' ? 'SI' : 'NO',
      condicionLaboral
    ];
    fs.writeFileSync(batchHist, JSON.stringify([
      { op: 'append', range: 'Respuestas de formulario 1!A1', data: [rowHist] }
    ]), 'utf8');
    runCliSafe('gsheets', ['mutate', 'batch', histId, '-f', batchHist]);
    fs.unlinkSync(batchHist);
    sheetSyncResult.historicalSynced = true;
  } catch (e) {
    sheetSyncResult.errors.push(`Historical Sheet: ${e.message}`);
  }

  return {
    colaborador: nuevoColab,
    sheetSyncResult,
    masterSheetUrl: manifest?.sheets?.masterSheetUrl || null,
    historicalSheetUrl: manifest?.sheets?.historicalSheetUrl || `https://docs.google.com/spreadsheets/d/${histId}/edit`
  };
}

function rebuildDataBundleSafe() {
  try {
    const { calcularAuditoria } = require('./audit_engine');
    const { MOTIVOS_PREDEFINIDOS } = require('./memo_engine');
    const mofPath = path.join(DATA_DIR, 'mof_puestos_aurora.json');
    const mof = fs.existsSync(mofPath) ? JSON.parse(fs.readFileSync(mofPath, 'utf8')) : [];
    const audit = calcularAuditoria();
    const bundle = 'window.RH_EMBEDDED_DATA = ' + JSON.stringify({ audit, mof, memoMotivos: MOTIVOS_PREDEFINIDOS }, null, 2) + ';\n';
    fs.writeFileSync(path.join(ROOT_DIR, 'public', 'data-bundle.js'), bundle, 'utf8');
  } catch (e) {
    console.warn('[WARN] No se pudo regenerar data-bundle.js:', e.message);
  }
}

function readSheetRows(sheetId, range) {
  const res = runCliSafe('gsheets', ['readonly', 'read', sheetId, range, '--json']);
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.values)) return res.values;
  if (res && Array.isArray(res.rows)) return res.rows;
  return [];
}

async function actualizarPersonalExistente(idOrPayload, maybePayload) {
  const payload = typeof idOrPayload === 'object' ? idOrPayload : { ...maybePayload, id: idOrPayload };
  const padron = cargarPadron();
  const manifest = cargarManifest();

  const targetId = Number(payload.id);
  const idx = padron.colaboradores.findIndex(c => c.id === targetId || (payload.originalDni && c.dni === String(payload.originalDni).trim()));
  if (idx === -1) {
    throw new Error(`Colaborador con ID ${payload.id || 'desconocido'} no encontrado en el padrón.`);
  }

  const colab = padron.colaboradores[idx];
  const oldDni = String(colab.dni || '').trim();
  const newDni = String(payload.dni || oldDni).trim();
  const newNombre = String(payload.nombre || colab.nombre || '').toUpperCase().trim();
  if (!newDni || !newNombre) throw new Error('El DNI y los Apellidos y Nombres son obligatorios.');

  const rawCL = String(payload.condicionLaboral || colab.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  const condicionLaboral = ['CONTRATO', 'RXH', 'OTROS'].includes(rawCL) ? rawCL : 'CONTRATO';
  const estado = String(payload.estado || colab.estado || 'ACTIVO').toUpperCase().trim();
  const sueldo = payload.sueldo !== undefined && payload.sueldo !== '' ? Number(payload.sueldo) : Number(colab.remuneracionActual || 0);
  const area = String(payload.area || colab.area || 'Salón').trim();
  const cargo = String(payload.cargo || colab.cargoActual || colab.cargoContrato || 'Colaborador').trim();
  const condicion = String(payload.condicion || colab.condicionLaborable || 'FULL TIME').trim();
  const fechaInicio = String(payload.fechaInicio || colab.contratoBase?.inicio || '').trim();
  const fechaFin = String(payload.fechaFin || colab.vigenciaActualHasta || colab.contratoBase?.fin || '').trim();
  const fechaCese = String(payload.fechaCese ?? colab.fechaCese ?? '').trim();

  // Actualizar campos en el objeto del padrón
  colab.tipoDocumento = String(payload.tipoDocumento || colab.tipoDocumento || 'DNI').trim();
  colab.dni = newDni;
  colab.nombre = newNombre;
  colab.area = area;
  colab.cargoActual = cargo;
  colab.cargoContrato = colab.cargoContrato || cargo;
  colab.condicionLaborable = condicion;
  colab.condicionLaboral = condicionLaboral;
  colab.estado = estado;
  colab.remuneracionActual = sueldo;
  if (estado === 'CESADO') colab.ultimaRemuneracion = sueldo;
  colab.contratoBase = colab.contratoBase || {};
  if (fechaInicio) colab.contratoBase.inicio = fechaInicio;
  if (fechaFin && estado !== 'CESADO') {
    colab.vigenciaActualHasta = fechaFin;
    if (!colab.contratoBase.fin) colab.contratoBase.fin = fechaFin;
  }
  if (fechaCese) {
    colab.fechaCese = fechaCese;
  } else if (estado !== 'CESADO') {
    colab.fechaCese = null;
  }
  colab.domicilio = String(payload.domicilio ?? colab.domicilio ?? '').trim();
  colab.fechaNacimiento = String(payload.fechaNacimiento ?? colab.fechaNacimiento ?? '').trim();
  colab.edad = payload.edad !== undefined && payload.edad !== '' ? String(payload.edad).trim() : (colab.edad || '');
  colab.celular = String(payload.celular ?? colab.celular ?? '').trim();
  colab.correo = String(payload.correo ?? colab.correo ?? '').trim();
  colab.banco = String(payload.banco ?? colab.banco ?? '').trim();
  colab.numeroCuenta = String(payload.numeroCuenta ?? colab.numeroCuenta ?? '').trim();
  colab.carnetSanitario = String(payload.carnetSanitario ?? colab.carnetSanitario ?? 'NO').trim();
  colab.observaciones = String(payload.observaciones ?? colab.observaciones ?? '').trim();

  // Guardar Padrón local + skill + data-bundle.js
  padron.colaboradores[idx] = colab;
  guardarPadron(padron);

  const skillPadronPath = path.join(ROOT_DIR, '..', '.agents', 'skills', 'aurora-laboral-adendas', 'resources', 'padron_personal_aurora_2026.json');
  if (fs.existsSync(skillPadronPath)) {
    try {
      fs.writeFileSync(skillPadronPath, JSON.stringify(padron, null, 2), 'utf8');
    } catch (e) {}
  }
  // Nota: no sobreescribimos public/data-bundle.js aquí para evitar que Live Server recargue la pestaña al guardar.

  // Sincronizar actualización en vivo en Google Sheets (Maestro + Histórico)
  const sheetSyncResult = { masterSynced: false, historicalSynced: false, masterRow: null, historicalRow: null, errors: [] };
  const masterId = manifest?.sheets?.masterSheetId || '1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk';
  const histId = manifest?.sheets?.historicalSheetId || '1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM';

  const docs = colab.documentos || {};
  const lastAdenda = Array.isArray(docs.adendas) && docs.adendas.length ? docs.adendas[docs.adendas.length - 1] : null;
  const liqOrAdendaUrl = docs.liquidacion?.driveUrl || lastAdenda?.driveUrl || '';

  // 1) Actualizar fila exacta en Sheet Maestro -> 1_PADRON_GENERAL (Cols A..R)
  try {
    const rows = readSheetRows(masterId, '1_PADRON_GENERAL!A1:R200');
    let matchRowNum = -1;
    for (let r = 1; r < rows.length; r++) {
      const rowId = String(rows[r][0] || '').trim();
      const rowDni = String(rows[r][1] || '').trim();
      if (rowId === String(colab.id) || (oldDni && rowDni === oldDni) || rowDni === newDni) {
        matchRowNum = r + 1;
        break;
      }
    }
    const existingRow = matchRowNum > 0 ? (rows[matchRowNum - 1] || []) : [];
    const updatedMasterRow = [
      String(colab.id),
      newDni,
      newNombre,
      area,
      cargo,
      condicion,
      estado,
      fechaInicio,
      estado === 'CESADO' ? (fechaCese || fechaFin) : fechaFin,
      String(sueldo),
      colab.domicilio,
      colab.celular,
      colab.correo,
      colab.banco ? `${colab.banco} ${colab.numeroCuenta}`.trim() : '',
      docs.fotoDni?.driveUrl || existingRow[14] || '',
      docs.contrato?.driveUrl || existingRow[15] || '',
      liqOrAdendaUrl || existingRow[16] || '',
      condicionLaboral
    ];

    const batchMaster = path.join(DATA_DIR, `update_master_${colab.id}_${Date.now()}.json`);
    const opObj = matchRowNum > 0
      ? { op: 'write', range: `1_PADRON_GENERAL!A${matchRowNum}:R${matchRowNum}`, data: [updatedMasterRow] }
      : { op: 'append', range: '1_PADRON_GENERAL!A1', data: [updatedMasterRow] };
    fs.writeFileSync(batchMaster, JSON.stringify([opObj]), 'utf8');
    runCliSafe('gsheets', ['mutate', 'batch', masterId, '-f', batchMaster]);
    if (fs.existsSync(batchMaster)) fs.unlinkSync(batchMaster);
    sheetSyncResult.masterSynced = true;
    sheetSyncResult.masterRow = matchRowNum > 0 ? matchRowNum : 'append';
  } catch (e) {
    sheetSyncResult.errors.push(`Master Sheet: ${e.message}`);
  }

  // 2) Actualizar fila exacta en Sheet Histórico -> Respuestas de formulario 1 (Cols B..U)
  try {
    const hRows = readSheetRows(histId, "'Respuestas de formulario 1'!A1:U200");
    let hRowNum = -1;
    for (let r = 1; r < hRows.length; r++) {
      const rowDni = String(hRows[r][2] || '').trim();
      if ((oldDni && rowDni === oldDni) || rowDni === newDni) {
        hRowNum = r + 1;
        break;
      }
    }
    if (hRowNum > 0) {
      const ex = hRows[hRowNum - 1] || [];
      const updatedHistColsBtoU = [
        colab.tipoDocumento || ex[1] || 'DNI',
        newDni,
        newNombre,
        area.toUpperCase(),
        cargo.toUpperCase(),
        condicion.toUpperCase(),
        colab.fechaNacimiento || ex[7] || '',
        String(colab.edad || ex[8] || ''),
        String(sueldo),
        fechaInicio || ex[10] || '',
        colab.celular || '',
        colab.banco || '',
        colab.numeroCuenta || '',
        colab.carnetSanitario || 'NO',
        colab.correo || '',
        docs.fotoDni?.driveUrl || ex[16] || '',
        estado === 'CESADO' ? 'CESE' : estado,
        estado === 'CESADO' ? (fechaCese || ex[18] || '') : '',
        condicionLaboral === 'CONTRATO' ? 'SI' : 'NO',
        condicionLaboral
      ];
      const batchHist = path.join(DATA_DIR, `update_hist_${colab.id}_${Date.now()}.json`);
      fs.writeFileSync(batchHist, JSON.stringify([
        { op: 'write', range: `'Respuestas de formulario 1'!B${hRowNum}:U${hRowNum}`, data: [updatedHistColsBtoU] }
      ]), 'utf8');
      runCliSafe('gsheets', ['mutate', 'batch', histId, '-f', batchHist]);
      if (fs.existsSync(batchHist)) fs.unlinkSync(batchHist);
      sheetSyncResult.historicalSynced = true;
      sheetSyncResult.historicalRow = hRowNum;
    }
  } catch (e) {
    sheetSyncResult.errors.push(`Historical Sheet: ${e.message}`);
  }

  return {
    colaborador: colab,
    sheetSyncResult,
    masterSheetUrl: manifest?.sheets?.masterSheetUrl || `https://docs.google.com/spreadsheets/d/${masterId}/edit`,
    historicalSheetUrl: manifest?.sheets?.historicalSheetUrl || `https://docs.google.com/spreadsheets/d/${histId}/edit`
  };
}

module.exports = {
  registrarNuevoIngreso,
  actualizarPersonalExistente
};
