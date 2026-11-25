/**
 * SINCRONIZADOR MAESTRO GOOGLE DRIVE & GOOGLE SHEETS — RH BRINNERCAS
 * Crea la estructura organizada en Google Drive, sube y vincula contratos, adendas,
 * fotos de DNI en PDF, memorándums, liquidaciones y crea el Google Sheet maestro.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generarHtmlLiquidacion } = require('../services/liquidacion_engine');

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DOCS_DIR = path.join(ROOT_DIR, 'public', 'docs');
const PADRON_PATH = path.join(DATA_DIR, 'padron_personal_aurora_2026.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'drive_manifest.json');

const HISTORICAL_SHEET_ID = '1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM';
const DRIVE_CONTRATOS_SRC_FOLDER = '19DdIPPpNnSfsRDD5rArmDU8VmGcodvn8';
const DRIVE_DNI_FOLDERS = [
  '1oS4BfGlTaDbnHKtwJcNxI8-t2TWODWoQArv3PPTudSIy0R_825U0wt-MtCU4kBi7551tHyXC',
  '1e9yJKlr944xYROVNBS4c2bn3Ma4TifcxpqAhqzpVZtxWnUcANG8OyRhSBZ7PTCLCitVKVPEg'
];
const EXCEL_CONTABLE_LOCAL = 'C:\\Users\\brinn\\OneDrive\\AURORA 2025 - 2026\\RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx';
const RIT_FOLDER_LOCAL = 'C:\\Users\\brinn\\OneDrive\\AURORA 2025 - 2026\\REGLAMENTO INT Y MANUAL FUNCIONES';

// Mapeo verificado DNI -> fileId principal en Drive para cada colaborador
const DNI_DRIVE_MAP = {
  '44031290': { id: '1zKpUcjlohkuGnR13Q4tMVg2v8CsZnzHO', name: 'FOTOS DNI CASTRO VASQUEZ BRINNER.pdf', ext: '.pdf' },
  '73709422': { id: '14IMHdwZljUIEtX0IBvy1sEKUQp1Wjb1h', name: 'FOTOS DNI MINCHON ALVAREZ DIEGO.pdf', ext: '.pdf' },
  '47658476': { id: '1ub87mwWAdsWz5aGJtZu8naIQ1eO3uQ4b', name: 'FOTOS DNI RIOS PONCE DE LEON GABRIEL.pdf', ext: '.pdf' },
  '76766492': { id: '1Z-axJEQMLvOBloO9X9-OitwGbPyMjCIp', name: 'FOTO DNI NICOLE RODRIGUEZ CAPA.pdf', ext: '.pdf' },
  '74805963': { id: '1_m5ZOugAa035l1o-PxM2hIpmUrXuUQso', name: 'Dni edwin - Edwin Peña (Edwin Peña).pdf', ext: '.pdf' },
  '70378576': { id: '1uh1HBvh-9wjmEUbrv1tY4SchWBYWdD43', name: 'Dni - Bryam Sanchez.pdf', ext: '.pdf' },
  '48306117': { id: '1FCf-ABXAgKVJG0xURthjPwepVxeD_AkT', name: 'Solange - xiomara abad alvarez.pdf', ext: '.pdf' },
  '60877846': { id: '1mPP3j_shiVtfTYYf9o7sEyfldm_uCogt', name: 'IMG_20260220_014555 - ALAN IMANOL BAZAN.jpg', ext: '.jpg' },
  '70287707': { id: '1uJHQe-HFYIVEoKJGcOOpb_LgE-yTDJXY', name: 'dni aldair.pdf', ext: '.pdf' },
  '73576771': { id: '1qy8UXdPdg9_vWA3-TRxJKaEI6RPVY_7l', name: 'Dni - Dayana Rodriguez.pdf', ext: '.pdf' },
  '70405132': { id: '1KgPMTudAAUempC3CrJw5_qjQLKGp5S6I', name: 'DNI ANDREA - Andrea Cueva.pdf', ext: '.pdf' },
  '74968621': { id: '1tj6OHtiSsX_JAdKlCnklnoxQNA8HeyiI', name: 'FOTOS DNI SEBASTIAN CERNA ALVITES.pdf', ext: '.pdf' },
  '74303945': { id: '1QtNpZp8V-c_N_f0D75BqKxSWMQh7ZMTQ', name: 'FOTOS DNI SANDRO TERRONES.pdf', ext: '.pdf' },
  '70824901': { id: '1EIkNSdBSqkr3QkzIr2zamDruUptzgXWQ', name: 'dni lucas - Lucas Andres Serey Bardales.pdf', ext: '.pdf' },
  '75008865': { id: '1CV332aPmAAnxagiuIn88hjqueQ5A5Xwg', name: 'FOTOS DNI JOSE FLORES CALDERON.pdf', ext: '.pdf' },
  '47924719': { id: '1hrdA9zhvJcXWrbwBBUfrup-DtAH8PyJh', name: 'IMG-20260129-WA0035 - Pedro Cárdenas.jpg', ext: '.jpg' },
  '45385820': { id: '1XuXWF4blLznErGWqc1wQynstjIgsXI64', name: 'FOTOS DNI CASTRO VASQUEZ JIMMY.pdf', ext: '.pdf' },
  '76590395': { id: '1om1Iar6MVNQ37_BcZ9PmWNV-E7LHQ21e', name: 'FOTOS DNI QUIÑONES CALDERON ANDY.pdf', ext: '.pdf' },
  '48325353': { id: '1Rq42jkD9Phu_49YHqZ5Ci0L1IzVh9Avl', name: 'FOTOS DNI CALDERON MARTEL GUSTAVO.pdf', ext: '.pdf' },
  '60731243': { id: '1bBwc2HXXTh2Soh0-BP34NbRkCIx64QXI', name: 'DNI CLA - Claudia Monji.pdf', ext: '.pdf' },
  '74935872': { id: '1QiW9W-y2uYeJnNQzFTqgYfH0pvSbGE_K', name: 'FOTOS DNI ARTEAGA BERNARDO EMERSON.pdf', ext: '.pdf' },
  '60554635': { id: '1IZy6i-JHWUJ-6Alz18v_kRPAn1-CsYQq', name: 'Luis Serey - Brinner Castro Vasquez.pdf', ext: '.pdf' },
  // Adicionales en Drive / Sheet
  '43341525': { id: '1xcMyYvQXoBDkRcnki7INatIgV4p-nXq5', name: 'DNI BILLY SILVA.pdf', ext: '.pdf' },
  '19693465': { id: '1lGnYk_Q7clJjZgpu_8ljDPzjRC06jZbq', name: 'DNI JOSE DIONICIO.pdf', ext: '.pdf' },
  '77822206': { id: '1M2IJtVR1v3uuHd9D-4yaKJRbcHS2T78Q', name: 'DNI DEIDI.pdf', ext: '.pdf' },
  '72242662': { id: '1CRYDTK7lY_nDZk7irL0DAsJrlNZlSrKl', name: 'DNI JEREMY.pdf', ext: '.pdf' },
  '73633434': { id: '15Ab17BNcGPI3y8JBHCRe_jgo3ff2VBwJ', name: 'IMG_20261002_145811 - FLOR RODRIGUEZ DAVALOS.jpg', ext: '.jpg' }
};

function quoteArg(arg) {
  const s = String(arg);
  if (s === '') return '""';
  if (/[\s"&|<>^()%]/.test(s)) {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return s;
}

function runCli(bin, args) {
  const cmd = `${bin} ${args.map(quoteArg).join(' ')}`;
  try {
    const out = execSync(cmd, {
      encoding: 'utf8',
      maxBuffer: 25 * 1024 * 1024
    });
    return out.trim();
  } catch (err) {
    console.error(`[CLI ERROR] ${cmd}:`, err.stderr || err.message);
    throw err;
  }
}

function runJson(bin, args) {
  const out = runCli(bin, args);
  if (!out) return null;
  const idxObj = out.indexOf('{');
  const idxArr = out.indexOf('[');
  let start = -1;
  if (idxObj !== -1 && idxArr !== -1) start = Math.min(idxObj, idxArr);
  else start = Math.max(idxObj, idxArr);
  if (start !== -1) {
    try {
      return JSON.parse(out.slice(start));
    } catch (e) {}
  }
  const m = out.match(/\(ID:\s*([a-zA-Z0-9_-]+)\)/i)
    || out.match(/ID:\s*([a-zA-Z0-9_-]+)/i)
    || out.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (m) return { id: m[1], spreadsheetId: m[1], raw: out };
  return null;
}

function findOrCreateFolder(name, parentId = null) {
  const args = ['readonly', 'search', '--name-exact', name, '--type', 'folder', '--json'];
  if (parentId) args.push('--parent-id', parentId);
  const existing = runJson('gdrive', args);
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`[FOLDER OK] ${name} -> ${existing[0].id}`);
    return existing[0];
  }
  const mkdirArgs = ['mutate', 'mkdir', name, '--json'];
  if (parentId) mkdirArgs.push('--parent', parentId);
  const created = runJson('gdrive', mkdirArgs);
  if (!created || !created.id) {
    throw new Error(`No se pudo obtener ID al crear carpeta ${name}`);
  }
  console.log(`[FOLDER CREADA] ${name} -> ${created.id}`);
  return created;
}

function listFolderItems(folderId) {
  return runJson('gdrive', ['readonly', 'ls', folderId, '--max', '200', '--json']) || [];
}

function normalizeStr(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function matchWorkerToFile(workerName, fileName) {
  const fn = normalizeStr(fileName);
  const wn = normalizeStr(workerName);
  if (fn.includes(wn)) return true;
  const tokens = wn.split(/\s+/).filter(t => t.length >= 3);
  if (tokens.length === 0) return false;
  let matches = 0;
  for (const t of tokens) {
    if (fn.includes(t)) matches++;
  }
  if (tokens.length >= 3) {
    // Requerir primer apellido (tokens[0]) + al menos un nombre propio (tokens[2+]) para no confundir hermanos
    const firstSurnameMatch = fn.includes(tokens[0]);
    const givenNameMatch = tokens.slice(2).some(t => fn.includes(t));
    return (firstSurnameMatch && givenNameMatch) || matches >= 3;
  }
  return matches >= 2 || (tokens.length === 1 && matches === 1);
}

async function main() {
  console.log('=== 1. LEYENDO PADRÓN Y SHEET HISTÓRICO ===');
  const padron = JSON.parse(fs.readFileSync(PADRON_PATH, 'utf8'));

  // Leer Sheet histórico para enriquecer datos de contacto/banco
  let sheetRows = [];
  try {
    const rawSheet = runCli('gsheets', ['readonly', 'read-all', HISTORICAL_SHEET_ID, '--markdown-links', '--json']);
    const startIdx = rawSheet.indexOf('{') !== -1 && (rawSheet.indexOf('[') === -1 || rawSheet.indexOf('{') < rawSheet.indexOf('['))
      ? rawSheet.indexOf('{')
      : rawSheet.indexOf('[');
    if (startIdx !== -1) {
      const parsed = JSON.parse(rawSheet.slice(startIdx));
      if (Array.isArray(parsed)) sheetRows = parsed;
      else {
        const firstKey = Object.keys(parsed)[0];
        if (firstKey && Array.isArray(parsed[firstKey])) sheetRows = parsed[firstKey];
      }
    }
  } catch (e) {
    console.warn('Advertencia leyendo sheet histórico:', e.message);
  }

  const sheetByDni = {};
  for (let i = 1; i < sheetRows.length; i++) {
    const row = sheetRows[i];
    const dni = String(row[2] || '').trim();
    if (dni) {
      sheetByDni[dni] = {
        nombreSheet: String(row[3] || '').trim(),
        condicionLaborable: String(row[6] || 'FULL TIME').trim(),
        fechaNacimiento: String(row[7] || '').trim(),
        edad: String(row[8] || '').trim(),
        celular: String(row[11] || '').trim(),
        banco: String(row[12] || '').trim(),
        numeroCuenta: String(row[13] || '').trim(),
        carnetSanitario: String(row[14] || '').trim(),
        correo: String(row[15] || '').trim()
      };
    }
  }
  console.log(`Registros extraídos del Google Sheet histórico: ${Object.keys(sheetByDni).length}`);

  console.log('\n=== 2. CREANDO ESTRUCTURA EN GOOGLE DRIVE ===');
  const rootFolder = findOrCreateFolder('RH BRINNERCAS - GRUPO GASTRONOMICO AURORA SAC');
  const subContratos = findOrCreateFolder('01_CONTRATOS_PERSONAL_PDF', rootFolder.id);
  const subAdendas = findOrCreateFolder('02_ADENDAS_MODALIDAD_DOCX', rootFolder.id);
  const subDni = findOrCreateFolder('03_FOTOS_DNI_IDENTIDAD_PDF', rootFolder.id);
  const subMemos = findOrCreateFolder('04_MEMORANDUMS_Y_ACTAS', rootFolder.id);
  const subLiq = findOrCreateFolder('05_LIQUIDACIONES_Y_BOLETAS', rootFolder.id);
  const subBd = findOrCreateFolder('06_BASE_DATOS_SHEETS_Y_EXCEL', rootFolder.id);

  // Obtener listas actuales en las subcarpetas para idempotencia
  const existingContratos = listFolderItems(subContratos.id);
  const existingAdendas = listFolderItems(subAdendas.id);
  const existingDnis = listFolderItems(subDni.id);
  const existingMemos = listFolderItems(subMemos.id);
  const existingLiqs = listFolderItems(subLiq.id);
  const existingBd = listFolderItems(subBd.id);

  // 3. Copiar Contratos PDF desde Drive origen
  console.log('\n=== 3. ORGANIZANDO CONTRATOS PDF EN DRIVE ===');
  const srcContratos = listFolderItems(DRIVE_CONTRATOS_SRC_FOLDER);
  const contratosDriveMap = [];
  for (const file of srcContratos) {
    let found = existingContratos.find(x => x.name === file.name);
    if (!found) {
      found = runJson('gdrive', ['mutate', 'cp', file.id, file.name, '--parent', subContratos.id, '--json']);
      console.log(`  [CP CONTRATO] ${file.name}`);
    }
    contratosDriveMap.push({
      id: found?.id || file.id,
      name: (found && found.name) || file.name,
      webViewLink: `https://drive.google.com/file/d/${found?.id || file.id}/view`
    });
  }
  // Subir contratos locales que no estuvieran en srcContratos (p.ej. Luis Ignacio Serey y Terrones si faltaron en ls max 20)
  const localContratos = fs.readdirSync(path.join(DOCS_DIR, 'contratos')).filter(f => f.endsWith('.pdf'));
  for (const fileName of localContratos) {
    if (!contratosDriveMap.some(x => x.name === fileName)) {
      let found = existingContratos.find(x => x.name === fileName);
      if (!found) {
        found = runJson('gdrive', ['mutate', 'upload', path.join(DOCS_DIR, 'contratos', fileName), '--parent', subContratos.id, '--json']);
        console.log(`  [UPLOAD CONTRATO] ${fileName}`);
      }
      contratosDriveMap.push({
        id: found?.id || '',
        name: (found && found.name) || fileName,
        webViewLink: `https://drive.google.com/file/d/${found?.id || ''}/view`
      });
    }
  }

  // 4. Subir Adendas DOCX
  console.log('\n=== 4. SUBIENDO ADENDAS DOCX A DRIVE ===');
  const localAdendas = fs.readdirSync(path.join(DOCS_DIR, 'adendas')).filter(f => f.endsWith('.docx'));
  const adendasDriveMap = [];
  for (const fileName of localAdendas) {
    let found = existingAdendas.find(x => x.name === fileName);
    if (!found) {
      found = runJson('gdrive', ['mutate', 'upload', path.join(DOCS_DIR, 'adendas', fileName), '--parent', subAdendas.id, '--json']);
      console.log(`  [UPLOAD ADENDA] ${fileName}`);
    }
    adendasDriveMap.push({
      id: found?.id || '',
      name: (found && found.name) || fileName,
      webViewLink: `https://drive.google.com/file/d/${found?.id || ''}/view`
    });
  }

  // 5. Copiar y descargar Fotos de DNI
  console.log('\n=== 5. ORGANIZANDO Y RESPALDANDO FOTOS DE DNI ===');
  const dniDriveMap = {};
  for (const [dni, meta] of Object.entries(DNI_DRIVE_MAP)) {
    const localFileName = `DNI_${dni}_${meta.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const localPath = path.join(DOCS_DIR, 'dni', localFileName);
    if (!fs.existsSync(localPath)) {
      try {
        runCli('gdrive', ['readonly', 'download', meta.id, '--out', localPath]);
        console.log(`  [DOWNLOAD DNI] ${localFileName}`);
      } catch (e) {
        console.warn(`  [WARN DOWNLOAD DNI] ${meta.name}: ${e.message}`);
      }
    }
    let copied = existingDnis.find(x => x.name === meta.name);
    if (!copied) {
      try {
        copied = runJson('gdrive', ['mutate', 'cp', meta.id, meta.name, '--parent', subDni.id, '--json']);
        console.log(`  [CP DNI DRIVE] ${meta.name}`);
      } catch (e) {
        // Si es archivo compartido sin permiso cp o algo, subimos desde localPath
        if (fs.existsSync(localPath)) {
          copied = runJson('gdrive', ['mutate', 'upload', localPath, '--parent', subDni.id, '--json']);
          console.log(`  [UPLOAD DNI FALLBACK] ${meta.name}`);
        }
      }
    }
    dniDriveMap[dni] = {
      fileName: localFileName,
      originalName: meta.name,
      localUrl: `/docs/dni/${encodeURIComponent(localFileName)}`,
      driveId: copied ? copied.id : meta.id,
      driveUrl: `https://drive.google.com/file/d/${copied ? copied.id : meta.id}/view`
    };
  }

  // Copiar también los otros DNIs encontrados en las carpetas Drive de DNI para no perder ninguno
  const refreshedDnis = listFolderItems(subDni.id);
  for (const srcDniFolder of DRIVE_DNI_FOLDERS) {
    const items = listFolderItems(srcDniFolder);
    for (const item of items) {
      if (item.mimeType === 'application/vnd.google-apps.folder') continue;
      if (!refreshedDnis.some(x => x.name === item.name)) {
        try {
          const cp = runJson('gdrive', ['mutate', 'cp', item.id, item.name, '--parent', subDni.id, '--json']);
          if (cp) refreshedDnis.push({ id: cp.id, name: item.name });
          console.log(`  [CP DNI EXTRA] ${item.name}`);
        } catch (e) {
          // ignore if Google Doc / duplicate
        }
      }
    }
  }

  // 6. Memorándums y Actas
  console.log('\n=== 6. SUBIENDO MEMORÁNDUMS Y ACTAS ===');
  const localMemos = fs.readdirSync(path.join(DOCS_DIR, 'memos'));
  const memosDriveMap = [];
  for (const fileName of localMemos) {
    let found = existingMemos.find(x => x.name === fileName);
    if (!found) {
      found = runJson('gdrive', ['mutate', 'upload', path.join(DOCS_DIR, 'memos', fileName), '--parent', subMemos.id, '--json']);
      console.log(`  [UPLOAD MEMO] ${fileName}`);
    }
    memosDriveMap.push({
      id: found?.id || '',
      name: (found && found.name) || fileName,
      localUrl: `/docs/memos/${encodeURIComponent(fileName)}`,
      driveUrl: `https://drive.google.com/file/d/${found?.id || ''}/view`
    });
  }
  // Subir Actas RIT locales si existen
  if (fs.existsSync(RIT_FOLDER_LOCAL)) {
    const actasFiles = fs.readdirSync(RIT_FOLDER_LOCAL).filter(f => f.startsWith('ACTA DE ENTREGA') && f.endsWith('.pdf'));
    for (const f of actasFiles) {
      if (!existingMemos.some(x => x.name === f)) {
        runJson('gdrive', ['mutate', 'upload', path.join(RIT_FOLDER_LOCAL, f), '--parent', subMemos.id, '--json']);
        console.log(`  [UPLOAD ACTA] ${f}`);
      }
    }
  }

  // 7. Generar Liquidaciones de Cesados y subir Liquidaciones PDF
  console.log('\n=== 7. GENERANDO Y SUBIENDO LIQUIDACIONES BBSS ===');
  const liqDriveMap = [];
  // Subir los 2 PDFs reales existentes (Jimmy Castro y Victor Quiñones)
  const localLiqs = fs.readdirSync(path.join(DOCS_DIR, 'liquidaciones')).filter(f => f.endsWith('.pdf'));
  for (const fileName of localLiqs) {
    let found = existingLiqs.find(x => x.name === fileName);
    if (!found) {
      found = runJson('gdrive', ['mutate', 'upload', path.join(DOCS_DIR, 'liquidaciones', fileName), '--parent', subLiq.id, '--json']);
      console.log(`  [UPLOAD LIQ PDF] ${fileName}`);
    }
    liqDriveMap.push({
      id: found?.id || '',
      name: (found && found.name) || fileName,
      localUrl: `/docs/liquidaciones/${encodeURIComponent(fileName)}`,
      driveUrl: `https://drive.google.com/file/d/${found?.id || ''}/view`
    });
  }
  // Generar hojas HTML oficiales para todos los cesados
  for (const colab of padron.colaboradores) {
    if (colab.estado === 'CESADO') {
      const liqHtmlName = `LIQUIDACION_BBSS_${colab.dni}_${colab.nombre.split(' ')[0]}.html`;
      const liqHtmlPath = path.join(DOCS_DIR, 'liquidaciones', liqHtmlName);
      fs.writeFileSync(liqHtmlPath, generarHtmlLiquidacion(colab), 'utf8');
      let found = existingLiqs.find(x => x.name === liqHtmlName);
      if (!found) {
        found = runJson('gdrive', ['mutate', 'upload', liqHtmlPath, '--parent', subLiq.id, '--json']);
      }
      liqDriveMap.push({
        dni: colab.dni,
        id: found?.id || '',
        name: (found && found.name) || liqHtmlName,
        localUrl: `/docs/liquidaciones/${encodeURIComponent(liqHtmlName)}`,
        driveUrl: `https://drive.google.com/file/d/${found?.id || ''}/view`
      });
    }
  }

  // 8. Enriquecer Padrón con contactos y enlaces Drive/Locales
  console.log('\n=== 8. ENRIQUECIENDO PADRÓN Y CREANDO GOOGLE SHEET MAESTRO ===');
  padron.colaboradores = padron.colaboradores.map(c => {
    const extra = sheetByDni[c.dni] || {};
    // Buscar contrato
    const contratoMatch = contratosDriveMap.find(f => f?.name && (matchWorkerToFile(c.nombre, f.name) || f.name.includes(c.dni)));
    const localContratoFile = localContratos.find(f => matchWorkerToFile(c.nombre, f));

    // Buscar adendas (tanto en padron como en archivos físicos .docx)
    const adendasFiles = adendasDriveMap.filter(f => {
      if (c.carpetaAdendas && normalizeStr(f.name).includes(normalizeStr(c.carpetaAdendas))) return true;
      return matchWorkerToFile(c.nombre, f.name);
    });
    const uniqueAdendas = [];
    const seenAd = new Set();
    adendasFiles.forEach(af => {
      if (!seenAd.has(af.name)) {
        seenAd.add(af.name);
        uniqueAdendas.push({
          fileName: af.name,
          localUrl: `/docs/adendas/${encodeURIComponent(af.name)}`,
          driveId: af.id,
          driveUrl: af.webViewLink
        });
      }
    });

    // Buscar memorandums físicos
    const workerMemos = memosDriveMap.filter(m => matchWorkerToFile(c.nombre, m.name));

    // Buscar liquidación PDF o generada
    let workerLiq = null;
    if (c.dni === '45385820') {
      workerLiq = liqDriveMap.find(l => l.name.includes('Castro Jimmy'));
    } else if (c.dni === '76590395') {
      workerLiq = liqDriveMap.find(l => l.name.includes('Quiñones Victor'));
    } else {
      workerLiq = liqDriveMap.find(l => l.dni === c.dni);
    }

    return {
      ...c,
      ...extra,
      documentos: {
        contrato: contratoMatch || localContratoFile ? {
          fileName: (contratoMatch && contratoMatch.name) || localContratoFile,
          localUrl: localContratoFile ? `/docs/contratos/${encodeURIComponent(localContratoFile)}` : null,
          driveId: contratoMatch ? contratoMatch.id : null,
          driveUrl: contratoMatch ? contratoMatch.webViewLink : null
        } : null,
        adendas: uniqueAdendas,
        memorandums: workerMemos,
        liquidacion: workerLiq ? {
          fileName: workerLiq.name,
          localUrl: workerLiq.localUrl,
          driveId: workerLiq.id,
          driveUrl: workerLiq.driveUrl
        } : null,
        fotoDni: dniDriveMap[c.dni] || null
      }
    };
  });

  // Agregar personal adicional encontrado en el Sheet histórico (e.g. Flor Rodríguez RxH y apoyos) si no están por DNI
  const extraSheetWorkers = [
    {
      dni: '73633434',
      nombre: 'RODRIGUEZ DAVALOS FLOR STEFANY',
      area: 'Caja',
      cargoContrato: 'Cajera',
      cargoActual: 'Cajera (Fijo RxH)',
      condicionLaborable: 'FIJO RXH',
      domicilio: 'Trujillo, La Libertad (Registrado en Sheet)',
      contratoBase: { inicio: '04/07/2026', fin: 'Indeterminado RxH', remuneracion: 1500 },
      adendas: [],
      estado: 'RXH',
      remuneracionActual: 1500,
      vigenciaActualHasta: 'Vigente RxH',
      observaciones: 'Registrada vía Formulario de Ingreso Google Sheets el 02/10/2026'
    },
    {
      dni: '43341525',
      nombre: 'SILVA CERNA BILLY ANDRES',
      area: 'Bar',
      cargoContrato: 'Bartender Corporativo',
      cargoActual: 'Bartender Corporativo',
      condicionLaborable: 'FULL TIME',
      domicilio: 'Trujillo, La Libertad (Registrado en Sheet)',
      contratoBase: { inicio: '23/01/2026', fin: 'Sin contrato modal', remuneracion: 2500 },
      adendas: [],
      estado: 'APOYO',
      remuneracionActual: 2500,
      vigenciaActualHasta: 'Sin contrato modal',
      observaciones: 'Personal de apoyo corporativo registrado en Google Sheet'
    },
    {
      dni: '19693465',
      nombre: 'DIONICIO CASTILLO JOSE MARCIAL',
      area: 'Mantenimiento',
      cargoContrato: 'Mantenimiento',
      cargoActual: 'Mantenimiento',
      condicionLaborable: 'FULL TIME',
      domicilio: 'Trujillo, La Libertad (Registrado en Sheet)',
      contratoBase: { inicio: '23/01/2026', fin: 'Sin contrato modal', remuneracion: 2000 },
      adendas: [],
      estado: 'APOYO',
      remuneracionActual: 2000,
      vigenciaActualHasta: 'Sin contrato modal',
      observaciones: 'Personal de mantenimiento registrado en Google Sheet'
    },
    {
      dni: '77822206',
      nombre: 'BANCES ESPINOZA DEYDI FLADIR',
      area: 'Cocina',
      cargoContrato: 'Lavaplatos',
      cargoActual: 'Lavaplatos',
      condicionLaborable: 'FULL TIME',
      domicilio: 'Trujillo, La Libertad (Registrado en Sheet)',
      contratoBase: { inicio: '03/01/2026', fin: 'Sin contrato modal', remuneracion: 1300 },
      adendas: [],
      estado: 'APOYO',
      remuneracionActual: 1300,
      vigenciaActualHasta: 'Sin contrato modal',
      observaciones: 'Personal de apoyo registrado en Google Sheet'
    },
    {
      dni: '72242662',
      nombre: 'CRUZ CORTEZ JEREMY MIJAIL',
      area: 'Cocina',
      cargoContrato: 'Cortador',
      cargoActual: 'Cortador',
      condicionLaborable: 'FULL TIME',
      domicilio: 'Trujillo, La Libertad (Registrado en Sheet)',
      contratoBase: { inicio: '03/01/2026', fin: 'Sin contrato modal', remuneracion: 1600 },
      adendas: [],
      estado: 'APOYO',
      remuneracionActual: 1600,
      vigenciaActualHasta: 'Sin contrato modal',
      observaciones: 'Personal de apoyo registrado en Google Sheet'
    }
  ];

  let nextId = padron.colaboradores.reduce((m, c) => Math.max(m, c.id), 0) + 1;
  for (const ew of extraSheetWorkers) {
    if (!padron.colaboradores.some(c => c.dni === ew.dni)) {
      const extra = sheetByDni[ew.dni] || {};
      padron.colaboradores.push({
        id: nextId++,
        ...ew,
        ...extra,
        documentos: {
          contrato: null,
          adendas: [],
          memorandums: [],
          liquidacion: null,
          fotoDni: dniDriveMap[ew.dni] || null
        }
      });
    }
  }

  fs.writeFileSync(PADRON_PATH, JSON.stringify(padron, null, 2), 'utf8');

  // 9. Subir Excel Contable y crear/mover Sheet Maestro
  if (fs.existsSync(EXCEL_CONTABLE_LOCAL) && !existingBd.some(x => x.name === 'RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx')) {
    runJson('gdrive', ['mutate', 'upload', EXCEL_CONTABLE_LOCAL, '--parent', subBd.id, '--json']);
    console.log('  [UPLOAD EXCEL] RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx');
  }

  if (!existingBd.some(x => x.name === 'REGISTRO DEL PERSONAL DE AURORA')) {
    try {
      runCli('gdrive', ['mutate', 'create-shortcut', HISTORICAL_SHEET_ID, subBd.id]);
      console.log('  [SHORTCUT] REGISTRO DEL PERSONAL DE AURORA');
    } catch (e) {}
  }

  let masterSheet = existingBd.find(x => x.name === 'BD_MAESTRA_RH_BRINNERCAS_AURORA_2026');
  if (!masterSheet) {
    const createdSheet = runJson('gsheets', ['mutate', 'create', '--title', 'BD_MAESTRA_RH_BRINNERCAS_AURORA_2026', '--json']);
    const sheetId = createdSheet.spreadsheetId;
    runCli('gdrive', ['mutate', 'mv', sheetId, subBd.id]);
    masterSheet = { id: sheetId, name: 'BD_MAESTRA_RH_BRINNERCAS_AURORA_2026' };
    console.log(`  [SHEET CREADO] BD_MAESTRA_RH_BRINNERCAS_AURORA_2026 -> ${sheetId}`);

    // Renombrar hoja 0 y agregar pestañas
    runCli('gsheets', ['mutate', 'rename-sheet', sheetId, '--sheet-id', '0', '--title', '1_PADRON_GENERAL']);
    runCli('gsheets', ['mutate', 'add-sheet', sheetId, '--title', '2_NUEVOS_INGRESOS']);
    runCli('gsheets', ['mutate', 'add-sheet', sheetId, '--title', '3_HISTORIAL_ADENDAS_Y_CESES']);
  }

  // Poblar la pestaña 1_PADRON_GENERAL con el padrón actualizado usando archivo JSON de batch
  const headerPadron = [
    'ID', 'DNI', 'Apellidos y Nombres', 'Área', 'Cargo Actual', 'Condición',
    'Estado', 'Ingreso / Contrato', 'Vigencia / Cese', 'Sueldo S/', 'Domicilio',
    'Celular', 'Correo', 'Banco / Cuenta', 'Foto DNI (Drive)', 'Contrato (Drive)', 'Liquidación / Adenda (Drive)'
  ];
  const rowsPadron = [headerPadron];
  for (const c of padron.colaboradores) {
    const adendaLast = c.documentos?.adendas?.length ? c.documentos.adendas[c.documentos.adendas.length - 1].driveUrl : '';
    const liqUrl = c.documentos?.liquidacion?.driveUrl || '';
    rowsPadron.push([
      String(c.id),
      c.dni,
      c.nombre,
      c.area || '',
      c.cargoActual || '',
      c.condicionLaborable || 'FULL TIME',
      c.estado,
      c.contratoBase?.inicio || '',
      c.estado === 'CESADO' ? (c.fechaCese || '') : (c.vigenciaActualHasta || ''),
      String(c.remuneracionActual || c.ultimaRemuneracion || 0),
      c.domicilio || '',
      c.celular || '',
      c.correo || '',
      c.banco ? `${c.banco} ${c.numeroCuenta || ''}`.trim() : '',
      c.documentos?.fotoDni?.driveUrl || '',
      c.documentos?.contrato?.driveUrl || '',
      liqUrl || adendaLast || ''
    ]);
  }

  const headerNuevos = [
    'Fecha Registro', 'Tipo Doc', 'N° Documento', 'Apellidos y Nombres', 'Área',
    'Cargo', 'Condición', 'Fecha Nacimiento', 'Edad', 'Sueldo S/', 'Fecha Ingreso',
    'Fin Contrato Base', 'Domicilio', 'Celular', 'Banco', 'Número de Cuenta',
    'Carnet Sanitario', 'Correo Electrónico', 'Foto DNI (Drive)', 'Contrato Inicial (Drive)'
  ];

  const headerAdendas = ['Colaborador', 'DNI', 'Estado', 'Documento / Adenda', 'Inicio', 'Fin', 'Remuneración S/', 'Enlace Drive'];
  const rowsAdendas = [headerAdendas];
  for (const c of padron.colaboradores) {
    if (Array.isArray(c.adendas)) {
      c.adendas.forEach((a, idx) => {
        const docMatch = c.documentos?.adendas?.[idx];
        rowsAdendas.push([
          c.nombre, c.dni, c.estado, a.numero, a.inicio, a.fin, String(a.remuneracion || c.remuneracionActual || 0),
          docMatch ? docMatch.driveUrl : ''
        ]);
      });
    }
  }

  const batchPath = path.join(DATA_DIR, 'temp_sheet_batch.json');
  fs.writeFileSync(batchPath, JSON.stringify([
    { op: 'write', range: '1_PADRON_GENERAL!A1', data: rowsPadron },
    { op: 'write', range: '2_NUEVOS_INGRESOS!A1', data: [headerNuevos] },
    { op: 'write', range: '3_HISTORIAL_ADENDAS_Y_CESES!A1', data: rowsAdendas }
  ], null, 2), 'utf8');

  runCli('gsheets', ['mutate', 'batch', masterSheet.id, '-f', batchPath]);
  fs.unlinkSync(batchPath);

  // Dar formato limpio al Sheet
  try {
    const sheetsMeta = runJson('gsheets', ['readonly', 'list-sheets', masterSheet.id, '--json']);
    for (const s of sheetsMeta) {
      runCli('gsheets', ['mutate', 'format', masterSheet.id, '--sheet-id', String(s.id), '--start-row', '0', '--end-row', '1', '--start-col', '0', '--end-col', '17', '--bold', '--bg-color', '#1E291F', '--fg-color', '#F0EADF']);
      runCli('gsheets', ['mutate', 'freeze', masterSheet.id, '--sheet-id', String(s.id), '--rows', '1']);
    }
  } catch (e) {}

  // Guardar manifiesto maestro
  const manifest = {
    updatedAt: new Date().toISOString(),
    account: 'admr.brinnercas@gmail.com',
    stats: {
      totalColaboradores: padron.colaboradores.length,
      contratos: contratosDriveMap.length,
      adendas: adendasDriveMap.length,
      dnis: Object.keys(dniDriveMap).length,
      memos: memosDriveMap.length,
      liquidaciones: liqDriveMap.length
    },
    drive: {
      rootFolder: { id: rootFolder.id, name: 'RH BRINNERCAS - GRUPO GASTRONOMICO AURORA SAC', url: `https://drive.google.com/drive/folders/${rootFolder.id}` },
      subfolders: {
        contratos: { id: subContratos.id, name: '01_CONTRATOS_PERSONAL_PDF', url: `https://drive.google.com/drive/folders/${subContratos.id}` },
        adendas: { id: subAdendas.id, name: '02_ADENDAS_MODALIDAD_DOCX', url: `https://drive.google.com/drive/folders/${subAdendas.id}` },
        fotosDni: { id: subDni.id, name: '03_FOTOS_DNI_IDENTIDAD_PDF', url: `https://drive.google.com/drive/folders/${subDni.id}` },
        memosActas: { id: subMemos.id, name: '04_MEMORANDUMS_Y_ACTAS', url: `https://drive.google.com/drive/folders/${subMemos.id}` },
        liquidaciones: { id: subLiq.id, name: '05_LIQUIDACIONES_Y_BOLETAS', url: `https://drive.google.com/drive/folders/${subLiq.id}` },
        baseDatos: { id: subBd.id, name: '06_BASE_DATOS_SHEETS_Y_EXCEL', url: `https://drive.google.com/drive/folders/${subBd.id}` }
      }
    },
    sheets: {
      masterSheetId: masterSheet.id,
      masterSheetName: 'BD_MAESTRA_RH_BRINNERCAS_AURORA_2026',
      masterSheetUrl: `https://docs.google.com/spreadsheets/d/${masterSheet.id}/edit`,
      historicalSheetId: HISTORICAL_SHEET_ID,
      historicalSheetName: 'REGISTRO DEL PERSONAL DE AURORA',
      historicalSheetUrl: `https://docs.google.com/spreadsheets/d/${HISTORICAL_SHEET_ID}/edit`
    }
  };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('\n=== SINCRONIZACIÓN DRIVE & SHEETS COMPLETADA ===');
  console.log('Carpeta Raíz Drive:', manifest.drive.rootFolder.url);
  console.log('Sheet Maestro:', manifest.sheets.masterSheetUrl);
}

main().catch(err => {
  console.error('Fallo fatal en sincronización:', err);
  process.exit(1);
});
