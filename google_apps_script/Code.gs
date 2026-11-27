/**
 * ============================================================================
 * RH BRINNERCAS — BACKEND GOOGLE APPS SCRIPT ENDURECIDO (ZERO-TRUST / OWASP)
 * GRUPO GASTRONÓMICO AURORA S.A.C. (100% GRATIS • HTTPS • CERO FAILED TO FETCH)
 *
 * INSTRUCCIONES RÁPIDAS (1 SOLA VEZ):
 *   1. Pega este código en https://script.new y guarda el proyecto como "RH_BRINNERCAS_API".
 *   2. Selecciona la función "setupInicialPropiedades" arriba y pulsa "Ejecutar" (acepta permisos con admr.brinnercas@gmail.com).
 *   3. Pulsa "Implementar" -> "Nueva implementación" -> Tipo: "Aplicación web"
 *      - Ejecutar como: "Yo (admr.brinnercas@gmail.com)"
 *      - Quién tiene acceso: "Cualquier persona"
 *   4. Copia la URL terminada en /exec y pégala en RH BRINNERCAS/public/app.js (GAS_WEBAPP_URL).
 * ============================================================================
 */

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 900; // 15 minutos

const ROLE_PERMISSIONS = {
  ADMIN_GENERAL: ['padron:read', 'personal:create', 'personal:update', 'export:run', 'audit:read'],
  GERENCIA: ['padron:read', 'personal:create', 'personal:update', 'export:run'],
  RRHH_OPERADOR: ['padron:read', 'personal:create', 'personal:update'],
  LECTURA: ['padron:read']
};

/**
 * Ejecutar 1 sola vez desde el editor de Apps Script para inicializar PropertiesService de forma segura.
 */
function setupInicialPropiedades() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('HMAC_SECRET')) {
    props.setProperty('HMAC_SECRET', Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''));
  }
  props.setProperty('MASTER_SHEET_ID', '1SUJymC5eFiNERhbm-fg5KeCDWcLLTOiSV8NC9SYSwVk');
  props.setProperty('HIST_SHEET_ID', '1Wrelu9FcxOF7g82u2n5sw8LegBMeI1wecNIUfh1EwWM');
  props.setProperty('DNI_FOLDER_ID', '18iMe_-p5JAyd1HE3ToMvmkwp0O8B73qp'); // 03_FOTOS_DNI_IDENTIDAD_PDF

  // Verificar carpeta real 03_FOTOS_DNI_IDENTIDAD_PDF en Drive
  try {
    const folders = DriveApp.getFoldersByName('03_FOTOS_DNI_IDENTIDAD_PDF');
    if (folders.hasNext()) {
      props.setProperty('DNI_FOLDER_ID', folders.next().getId());
    }
  } catch (e) {}

  // Usuarios con hashes SHA-256 + salt (sin contraseñas en texto plano)
  const users = [
    {
      email: 'brinnercas',
      aliases: ['admr.brinnercas@gmail.com', 'brinnercas@gmail.com'],
      name: 'Wilmer Brinner Castro Vásquez',
      role: 'ADMIN_GENERAL',
      roleLabel: 'Administrador General',
      department: 'ALL',
      salt: 'aurora_web_v2',
      passHashes: [
        '02537d52a6512eec5023fcda6e7cc650bfd1a58e47b60d85d8b4a052d6b71b8b',
        '2ffc8a814e8fa64dcf4958355d06a65a9dd18a5afd8bec715dd4949aad098744'
      ]
    },
    {
      email: 'gerencia@aurora.pe',
      aliases: [],
      name: 'Gladys Verónica Carbajal Urquizo',
      role: 'GERENCIA',
      roleLabel: 'Gerente General',
      department: 'ALL',
      salt: 'aurora_web_v2',
      passHashes: [
        '02537d52a6512eec5023fcda6e7cc650bfd1a58e47b60d85d8b4a052d6b71b8b',
        '2ffc8a814e8fa64dcf4958355d06a65a9dd18a5afd8bec715dd4949aad098744'
      ]
    }
  ];
  props.setProperty('USERS_JSON', JSON.stringify(users));
  Logger.log('SETUP_OK: PropertiesService configurado correctamente.');
}

// ============================================================================
// 1. PUNTOS DE ENTRADA ZERO-TRUST (doGet / doPost)
// ============================================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || '').trim();
    const token = String(params.token || '').trim();

    if (action === 'health' || !action) {
      return jsonResponse({ success: true, service: 'RH_BRINNERCAS_GAS', status: 'OK' });
    }

    const session = requireSession_(token, 'padron:read', action);
    if (!session.ok) return jsonResponse({ success: false, error: session.error });

    if (action === 'padron') {
      const data = readPadronByScope_(session.user);
      logAudit_(session.user, 'PADRON_READ', 'SUCCESS', `Filas=${data.length}`);
      return jsonResponse({ success: true, colaboradores: data });
    }

    return jsonResponse({ success: false, error: 'Acción no reconocida.' });
  } catch (err) {
    console.error('[GAS_GET_ERR]', err.message);
    return jsonResponse({ success: false, error: 'Error procesando la solicitud.' });
  }
}

function doPost(e) {
  try {
    const rawBody = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    if (rawBody.length > 12 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'Tamaño de solicitud excede el límite permitido.' });
    }
    const body = JSON.parse(rawBody);
    const action = String(body.action || '').trim();

    if (action === 'login') {
      return handleLogin_(body);
    }

    if (action === 'logout') {
      const session = verifyToken_(body.token);
      if (session) {
        revokeToken_(session.jti);
        logAudit_(session, 'LOGOUT', 'SUCCESS', 'Token revocado');
      }
      return jsonResponse({ success: true });
    }

    if (action === 'create_personal') {
      const targetDept = sanitizeText_(body.area, 60);
      const auth = requireSession_(body.token, 'personal:create', 'PERSONAL_CREATE', targetDept);
      if (!auth.ok) return jsonResponse({ success: false, error: auth.error });

      const validationErrs = validatePersonalInput_(body);
      if (validationErrs.length > 0) {
        return jsonResponse({ success: false, error: validationErrs.join(' ') });
      }

      const result = createPersonalInSheets_(body, auth.user);
      logAudit_(auth.user, 'PERSONAL_CREATE', 'SUCCESS', `DNI=${sanitizeText_(body.dni, 16)}`);
      return jsonResponse({ success: true, ...result });
    }

    if (action === 'update_personal') {
      const targetDept = sanitizeText_(body.area, 60);
      const auth = requireSession_(body.token, 'personal:update', 'PERSONAL_UPDATE', targetDept);
      if (!auth.ok) return jsonResponse({ success: false, error: auth.error });

      const validationErrs = validatePersonalInput_(body);
      if (validationErrs.length > 0) {
        return jsonResponse({ success: false, error: validationErrs.join(' ') });
      }

      const result = updatePersonalInSheets_(body, auth.user);
      logAudit_(auth.user, 'PERSONAL_UPDATE', 'SUCCESS', `DNI=${sanitizeText_(body.dni, 16)}`);
      return jsonResponse({ success: true, ...result });
    }

    return jsonResponse({ success: false, error: 'Operación no permitida.' });
  } catch (err) {
    console.error('[GAS_POST_ERR]', err.message);
    return jsonResponse({ success: false, error: 'Error interno al procesar la operación.' });
  }
}

// ============================================================================
// 2. AUTENTICACIÓN, RATE LIMITING Y TOKENS HMAC CON EXPIRACIÓN
// ============================================================================
function handleLogin_(body) {
  const email = sanitizeText_(body.email, 100).toLowerCase();
  const password = String(body.password || '').trim();
  const pin = String(body.pin || '').trim();
  const rateKey = `rl_login_${email || (pin ? 'pin' : 'anon')}`;
  const cache = CacheService.getScriptCache();

  if (cache.get(`${rateKey}_lock`)) {
    logAudit_({ email: email || 'anonymous', role: 'NONE', department: 'N/A' }, 'LOGIN', 'RATE_LIMITED', 'Bloqueo activo');
    return jsonResponse({ success: false, error: 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.' });
  }

  const usersJson = PropertiesService.getScriptProperties().getProperty('USERS_JSON');
  if (!usersJson) {
    return jsonResponse({ success: false, error: 'Ejecuta setupInicialPropiedades() primero en Apps Script.' });
  }

  const users = JSON.parse(usersJson);
  let found = null;
  if (pin) {
    found = users.find(u => Array.isArray(u.passHashes) && u.passHashes.some(h => verifySha256ConstantTime_(pin, u.salt, h)));
  } else {
    const candidate = users.find(u => u.email === email || (Array.isArray(u.aliases) && u.aliases.includes(email)));
    if (candidate && Array.isArray(candidate.passHashes) && candidate.passHashes.some(h => verifySha256ConstantTime_(password, candidate.salt, h))) {
      found = candidate;
    }
  }

  if (!found) {
    const attempts = Number(cache.get(rateKey) || 0) + 1;
    cache.put(rateKey, String(attempts), LOCKOUT_SECONDS);
    if (attempts >= MAX_LOGIN_ATTEMPTS) cache.put(`${rateKey}_lock`, '1', LOCKOUT_SECONDS);
    logAudit_({ email: email || 'PIN', role: 'NONE', department: 'N/A' }, 'LOGIN', 'FAILED', `Intento #${attempts}`);
    return jsonResponse({ success: false, error: 'Credenciales inválidas.' });
  }

  cache.remove(rateKey);
  cache.remove(`${rateKey}_lock`);

  const issued = issueToken_(found);
  logAudit_(found, 'LOGIN', 'SUCCESS', 'Acceso autorizado GAS');
  return jsonResponse({
    success: true,
    token: issued.token,
    expiresAt: issued.expiresAt,
    user: { email: found.email, name: found.name, role: found.roleLabel, roleCode: found.role, department: found.department }
  });
}

function getHmacSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('HMAC_SECRET');
  if (!secret || secret.length < 32) throw new Error('HMAC_SECRET no configurado.');
  return secret;
}

function issueToken_(user) {
  const now = Date.now();
  const exp = now + SESSION_TTL_MS;
  const payload = {
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel || user.role,
    department: user.department || 'ALL',
    iat: now,
    exp: exp,
    jti: Utilities.getUuid()
  };
  const payloadB64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const sigB64 = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payloadB64, getHmacSecret_()));
  return { token: `${payloadB64}.${sigB64}`, expiresAt: exp };
}

function verifyToken_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') === -1) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payloadB64, getHmacSecret_()));
  if (!constantTimeEquals_(sigB64, expected)) return null;
  const payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadB64)).getDataAsString('UTF-8'));
  if (!payload.exp || Date.now() > payload.exp) return null;
  if (CacheService.getScriptCache().get(`revoked_${payload.jti}`)) return null;
  return payload;
}

function revokeToken_(jti) {
  if (jti) CacheService.getScriptCache().put(`revoked_${jti}`, '1', 21600);
}

function requireSession_(token, requiredPermission, actionName, targetDepartment) {
  const session = verifyToken_(token);
  if (!session) {
    logAudit_({ email: 'anonymous', role: 'NONE', department: 'N/A' }, actionName, 'DENIED_UNAUTHENTICATED', 'Token inválido o expirado');
    return { ok: false, error: 'Sesión inválida o expirada.' };
  }
  if (!hasRolePermission_(session, requiredPermission, targetDepartment)) {
    logAudit_(session, actionName, 'DENIED_FORBIDDEN', `Permiso=${requiredPermission}`);
    return { ok: false, error: 'Acceso denegado por política de rol/departamento.' };
  }
  return { ok: true, user: session };
}

function hasRolePermission_(session, perm, targetDepartment) {
  const allowed = ROLE_PERMISSIONS[session.role] || [];
  if (perm && allowed.indexOf(perm) === -1) return false;
  if (targetDepartment && session.department !== 'ALL' && session.department.toUpperCase() !== targetDepartment.toUpperCase()) {
    return false;
  }
  return true;
}

// ============================================================================
// 3. SANITIZACIÓN ANTI-FORMULA INJECTION (SHEETS/CSV) Y VALIDACIÓN
// ============================================================================
function sanitizeSheetCell_(val, maxLen) {
  const limit = maxLen || 500;
  let s = String(val === null || val === undefined ? '' : val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (s.length > limit) s = s.slice(0, limit);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function sanitizeText_(val, maxLen) {
  return String(val === null || val === undefined ? '' : val)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen || 200);
}

function validatePersonalInput_(body) {
  const errs = [];
  const dni = sanitizeText_(body.dni, 16);
  const nombre = sanitizeText_(body.nombre, 140);
  if (!/^[0-9A-Za-z]{8,12}$/.test(dni)) errs.push('DNI inválido (8 a 12 caracteres).');
  if (nombre.length < 5) errs.push('Apellidos y Nombres muy cortos.');
  const cl = String(body.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  if (['CONTRATO', 'RXH', 'OTROS'].indexOf(cl) === -1) errs.push('Condición laboral inválida.');
  if (body.sueldo !== undefined && body.sueldo !== '') {
    const n = Number(body.sueldo);
    if (isNaN(n) || n < 0 || n > 100000) errs.push('Remuneración fuera de rango.');
  }
  return errs;
}

function uploadDniToDrive_(base64Data, fileName, dni, nombre) {
  if (!base64Data || !fileName) return null;
  const DEFAULT_DNI_FOLDER_ID = '18iMe_-p5JAyd1HE3ToMvmkwp0O8B73qp'; // 03_FOTOS_DNI_IDENTIDAD_PDF
  try {
    let folder = null;
    const savedId = PropertiesService.getScriptProperties().getProperty('DNI_FOLDER_ID');
    const candidateIds = [savedId, DEFAULT_DNI_FOLDER_ID].filter(Boolean);
    for (let i = 0; i < candidateIds.length; i++) {
      try {
        folder = DriveApp.getFolderById(candidateIds[i]);
        if (folder) break;
      } catch (eFolder) {}
    }
    if (!folder) {
      const byName = DriveApp.getFoldersByName('03_FOTOS_DNI_IDENTIDAD_PDF');
      folder = byName.hasNext() ? byName.next() : DriveApp.getRootFolder();
    }

    const rawStr = String(base64Data);
    const parts = rawStr.split('base64,');
    const ext = fileName.indexOf('.') !== -1 ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '.pdf';
    const mimeByExt = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };
    const mimeMatch = parts[0].match(/data:([^;]+);/);
    const mime = (mimeMatch && mimeMatch[1] && mimeMatch[1] !== 'application/octet-stream')
      ? mimeMatch[1]
      : (mimeByExt[ext] || 'application/pdf');
    const rawB64 = (parts.length > 1 ? parts[1] : parts[0]).replace(/\s+/g, '');

    const safeFileName = `DNI_${dni}_${nombre.replace(/[^A-Z0-9]/g, '_')}${ext}`;
    const blob = Utilities.newBlob(Utilities.base64Decode(rawB64), mime, safeFileName);
    const created = folder.createFile(blob);
    return {
      fileName: safeFileName,
      originalName: fileName,
      driveId: created.getId(),
      driveUrl: `https://drive.google.com/file/d/${created.getId()}/view`
    };
  } catch (e) {
    console.error('[GAS_DRIVE_ERR]', e.message);
    return { error: e.message };
  }
}

// ============================================================================
// 4. LECTURA Y ESCRITURA EN GOOGLE SHEETS (MAESTRO + HISTÓRICO) + AUDIT LOG
// ============================================================================
function readPadronByScope_(user) {
  const sheetId = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName('1_PADRON_GENERAL');
  const values = sh.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const rows = values.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i]; });
    return obj;
  });
  if (user.department === 'ALL') return rows;
  return rows.filter(r => String(r['Área'] || '').toUpperCase() === user.department.toUpperCase());
}

function createPersonalInSheets_(body, user) {
  const props = PropertiesService.getScriptProperties();
  const masterId = props.getProperty('MASTER_SHEET_ID');
  const histId = props.getProperty('HIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(masterId);
  const shPadron = ss.getSheetByName('1_PADRON_GENERAL');
  const shNuevos = ss.getSheetByName('2_NUEVOS_INGRESOS');

  const dni = sanitizeText_(body.dni, 16);
  const nombre = sanitizeText_(body.nombre, 140).toUpperCase();
  const cl = String(body.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  const estado = cl === 'RXH' ? 'RXH' : (cl === 'OTROS' ? 'APOYO' : 'ACTIVO');
  const nowStr = Utilities.formatDate(new Date(), 'America/Lima', 'dd/MM/yyyy HH:mm:ss');

  const dniUpload = uploadDniToDrive_(body.fotoDniBase64, body.fotoDniName, dni, nombre);
  const dniUrl = (dniUpload && dniUpload.driveUrl) ? dniUpload.driveUrl : '';
  const dniError = (dniUpload && dniUpload.error) ? dniUpload.error : null;
  const nextId = shPadron.getLastRow();

  shPadron.appendRow([
    String(nextId),
    sanitizeSheetCell_(dni, 16),
    sanitizeSheetCell_(nombre, 140),
    sanitizeSheetCell_(body.area, 60),
    sanitizeSheetCell_(body.cargo, 80),
    sanitizeSheetCell_(body.condicion || 'FULL TIME', 40),
    sanitizeSheetCell_(estado, 30),
    sanitizeSheetCell_(body.fechaInicio, 20),
    sanitizeSheetCell_(body.fechaFin, 20),
    sanitizeSheetCell_(body.sueldo, 15),
    sanitizeSheetCell_(body.domicilio, 220),
    sanitizeSheetCell_(body.celular, 25),
    sanitizeSheetCell_(body.correo, 120),
    sanitizeSheetCell_(`${body.banco || ''} ${body.numeroCuenta || ''}`.trim(), 80),
    dniUrl, '', '',
    sanitizeSheetCell_(cl, 20)
  ]);

  if (shNuevos) {
    shNuevos.appendRow([
      nowStr,
      sanitizeSheetCell_(body.tipoDocumento || 'DNI', 10),
      sanitizeSheetCell_(dni, 16),
      sanitizeSheetCell_(nombre, 140),
      sanitizeSheetCell_(body.area, 60),
      sanitizeSheetCell_(body.cargo, 80),
      sanitizeSheetCell_(body.condicion || 'FULL TIME', 40),
      sanitizeSheetCell_(body.fechaNacimiento, 20),
      sanitizeSheetCell_(body.edad, 6),
      sanitizeSheetCell_(body.sueldo, 15),
      sanitizeSheetCell_(body.fechaInicio, 20),
      sanitizeSheetCell_(body.fechaFin, 20),
      sanitizeSheetCell_(body.domicilio, 220),
      sanitizeSheetCell_(body.celular, 25),
      sanitizeSheetCell_(body.banco, 40),
      sanitizeSheetCell_(body.numeroCuenta, 40),
      sanitizeSheetCell_(body.carnetSanitario || 'NO', 20),
      sanitizeSheetCell_(body.correo, 120),
      dniUrl, '',
      sanitizeSheetCell_(cl, 20)
    ]);
  }

  let historicalSynced = false;
  if (histId) {
    try {
      const shHist = SpreadsheetApp.openById(histId).getSheetByName('Respuestas de formulario 1');
      if (shHist) {
        shHist.appendRow([
          nowStr,
          sanitizeSheetCell_(body.tipoDocumento || 'DNI', 10),
          sanitizeSheetCell_(dni, 16),
          sanitizeSheetCell_(nombre, 140),
          sanitizeSheetCell_(String(body.area || '').toUpperCase(), 60),
          sanitizeSheetCell_(String(body.cargo || '').toUpperCase(), 80),
          sanitizeSheetCell_(String(body.condicion || 'FULL TIME').toUpperCase(), 40),
          sanitizeSheetCell_(body.fechaNacimiento, 20),
          sanitizeSheetCell_(body.edad, 6),
          sanitizeSheetCell_(body.sueldo, 15),
          sanitizeSheetCell_(body.fechaInicio, 20),
          sanitizeSheetCell_(body.celular, 25),
          sanitizeSheetCell_(body.banco, 40),
          sanitizeSheetCell_(body.numeroCuenta, 40),
          sanitizeSheetCell_(body.carnetSanitario || 'NO', 20),
          sanitizeSheetCell_(body.correo, 120),
          dniUrl,
          'ACTIVO',
          '',
          cl === 'CONTRATO' ? 'SI' : 'NO',
          sanitizeSheetCell_(cl, 20)
        ]);
        historicalSynced = true;
      }
    } catch (e) {}
  }

  return {
    colaborador: { id: nextId, nombre, dni, condicionLaboral: cl, estado, remuneracionActual: Number(body.sueldo || 0), documentos: { fotoDni: dniUrl ? dniUpload : null } },
    dniUpdated: Boolean(dniUrl),
    dniError,
    sheetSyncResult: { masterSynced: true, historicalSynced },
    masterSheetUrl: `https://docs.google.com/spreadsheets/d/${masterId}/edit`,
    historicalSheetUrl: `https://docs.google.com/spreadsheets/d/${histId}/edit`
  };
}

function updatePersonalInSheets_(body, user) {
  const props = PropertiesService.getScriptProperties();
  const masterId = props.getProperty('MASTER_SHEET_ID');
  const histId = props.getProperty('HIST_SHEET_ID');
  const ss = SpreadsheetApp.openById(masterId);
  const sh = ss.getSheetByName('1_PADRON_GENERAL');
  const data = sh.getDataRange().getValues();
  const targetDni = sanitizeText_(body.originalDni || body.dni, 16);
  const newDni = sanitizeText_(body.dni, 16);
  const newNombre = sanitizeText_(body.nombre, 140).toUpperCase();
  const cl = String(body.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  const estado = String(body.estado || 'ACTIVO').toUpperCase().trim();

  const dniUpload = uploadDniToDrive_(body.fotoDniBase64, body.fotoDniName, newDni, newNombre);

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === targetDni || String(data[i][0]).trim() === String(body.id || '').trim()) {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) throw new Error('Colaborador no encontrado.');

  const cur = data[rowIdx - 1];
  const dniUrl = (dniUpload && dniUpload.driveUrl) ? dniUpload.driveUrl : cur[14];
  const dniError = (dniUpload && dniUpload.error) ? dniUpload.error : null;
  const safeRow = [
    cur[0],
    sanitizeSheetCell_(newDni, 16),
    sanitizeSheetCell_(newNombre, 140),
    sanitizeSheetCell_(body.area, 60),
    sanitizeSheetCell_(body.cargo, 80),
    sanitizeSheetCell_(body.condicion || cur[5], 40),
    sanitizeSheetCell_(estado, 30),
    sanitizeSheetCell_(body.fechaInicio || cur[7], 20),
    sanitizeSheetCell_(estado === 'CESADO' ? (body.fechaCese || body.fechaFin || cur[8]) : (body.fechaFin || cur[8]), 20),
    sanitizeSheetCell_(body.sueldo, 15),
    sanitizeSheetCell_(body.domicilio, 220),
    sanitizeSheetCell_(body.celular, 25),
    sanitizeSheetCell_(body.correo, 120),
    sanitizeSheetCell_(`${body.banco || ''} ${body.numeroCuenta || ''}`.trim(), 80),
    dniUrl,
    cur[15],
    cur[16],
    sanitizeSheetCell_(cl, 20)
  ];

  sh.getRange(rowIdx, 1, 1, safeRow.length).setValues([safeRow]);

  let historicalRow = null;
  if (histId) {
    try {
      const shHist = SpreadsheetApp.openById(histId).getSheetByName('Respuestas de formulario 1');
      if (shHist) {
        const hData = shHist.getDataRange().getValues();
        for (let r = 1; r < hData.length; r++) {
          if (String(hData[r][2]).trim() === targetDni) {
            historicalRow = r + 1;
            const ex = hData[r];
            shHist.getRange(historicalRow, 2, 1, 20).setValues([[
              sanitizeSheetCell_(body.tipoDocumento || ex[1] || 'DNI', 10),
              sanitizeSheetCell_(newDni, 16),
              sanitizeSheetCell_(newNombre, 140),
              sanitizeSheetCell_(String(body.area || '').toUpperCase(), 60),
              sanitizeSheetCell_(String(body.cargo || '').toUpperCase(), 80),
              sanitizeSheetCell_(String(body.condicion || 'FULL TIME').toUpperCase(), 40),
              sanitizeSheetCell_(body.fechaNacimiento || ex[7], 20),
              sanitizeSheetCell_(body.edad || ex[8], 6),
              sanitizeSheetCell_(body.sueldo, 15),
              sanitizeSheetCell_(body.fechaInicio || ex[10], 20),
              sanitizeSheetCell_(body.celular, 25),
              sanitizeSheetCell_(body.banco, 40),
              sanitizeSheetCell_(body.numeroCuenta, 40),
              sanitizeSheetCell_(body.carnetSanitario || 'NO', 20),
              sanitizeSheetCell_(body.correo, 120),
              dniUrl || ex[16],
              estado === 'CESADO' ? 'CESE' : estado,
              estado === 'CESADO' ? sanitizeSheetCell_(body.fechaCese || ex[18], 20) : '',
              cl === 'CONTRATO' ? 'SI' : 'NO',
              sanitizeSheetCell_(cl, 20)
            ]]);
            break;
          }
        }
      }
    } catch (e) {}
  }

  return {
    colaborador: { id: Number(cur[0]), nombre: newNombre, dni: newDni, condicionLaboral: cl, estado, remuneracionActual: Number(body.sueldo || 0), documentos: { fotoDni: (dniUpload && dniUpload.driveUrl) ? dniUpload : null } },
    dniUpdated: Boolean(dniUpload && dniUpload.driveUrl),
    dniError,
    sheetSyncResult: { masterSynced: true, masterRow: rowIdx, historicalSynced: Boolean(historicalRow), historicalRow },
    masterSheetUrl: `https://docs.google.com/spreadsheets/d/${masterId}/edit`,
    historicalSheetUrl: `https://docs.google.com/spreadsheets/d/${histId}/edit`
  };
}

function logAudit_(userObj, action, status, detail) {
  try {
    const sheetId = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
    if (!sheetId) return;
    const ss = SpreadsheetApp.openById(sheetId);
    let logSh = ss.getSheetByName('AUDIT_LOG_SEGURIDAD');
    if (!logSh) {
      logSh = ss.insertSheet('AUDIT_LOG_SEGURIDAD');
      logSh.appendRow(['Fecha_Hora_ISO', 'Usuario', 'Rol', 'Departamento', 'Accion', 'Estado', 'Detalle']);
    }
    const cleanDetail = sanitizeSheetCell_(
      String(detail || '').replace(/(password|token|pin|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]'),
      200
    );
    logSh.appendRow([
      new Date().toISOString(),
      sanitizeSheetCell_(userObj?.email || 'anonymous', 100),
      sanitizeSheetCell_(userObj?.role || 'NONE', 40),
      sanitizeSheetCell_(userObj?.department || 'N/A', 40),
      sanitizeSheetCell_(action, 60),
      sanitizeSheetCell_(status, 32),
      cleanDetail
    ]);
  } catch (e) {}
}

// ============================================================================
// 5. UTILIDADES CRIPTOGRÁFICAS Y RESPUESTA JSON
// ============================================================================
function verifySha256ConstantTime_(plain, salt, expectedHex) {
  if (!plain || !salt || !expectedHex) return false;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, `${salt}:${plain}`);
  const hex = digest.map(b => ('0' + ((b < 0 ? b + 256 : b).toString(16))).slice(-2)).join('');
  return constantTimeEquals_(hex, expectedHex);
}

function constantTimeEquals_(a, b) {
  const s1 = String(a || '');
  const s2 = String(b || '');
  if (s1.length !== s2.length) return false;
  let diff = 0;
  for (let i = 0; i < s1.length; i++) diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  return diff === 0;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
