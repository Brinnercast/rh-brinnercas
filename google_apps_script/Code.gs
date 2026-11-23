/**
 * ============================================================================
 * RH BRINNERCAS — BACKEND GOOGLE APPS SCRIPT ENDURECIDO (ZERO-TRUST / OWASP)
 * GRUPO GASTRONÓMICO AURORA S.A.C.
 *
 * CONFIGURACIÓN EN PROPIEDADES DEL SCRIPT (Configuración del proyecto -> Propiedades):
 *   - HMAC_SECRET           : Secreto aleatorio >= 32 caracteres (generar en PropertiesService)
 *   - MASTER_SHEET_ID       : ID del Google Sheet Maestro (1_PADRON_GENERAL)
 *   - HIST_SHEET_ID         : ID del Google Sheet Histórico (Respuestas de formulario 1)
 *   - DNI_FOLDER_ID         : ID de la carpeta Drive 05_FOTOS_DNI_PERSONAL
 *   - USERS_JSON            : JSON de usuarios con hash SHA-256 + salt (sin contraseñas en texto plano)
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

// ============================================================================
// 1. PUNTOS DE ENTRADA ZERO-TRUST (doGet / doPost)
// ============================================================================
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = String(params.action || '').trim();
    const token = String(params.token || '').trim();

    if (action === 'health') {
      return jsonResponse({ success: true, service: 'RH_BRINNERCAS_GAS', status: 'OK' });
    }

    const session = requireSession_(token, 'padron:read', action || 'GET_UNKNOWN');
    if (!session.ok) return jsonResponse({ success: false, error: session.error });

    if (action === 'padron') {
      const data = readPadronByScope_(session.user);
      logAudit_(session.user, 'PADRON_READ', 'SUCCESS', `Filas=${data.length}`);
      return jsonResponse({ success: true, colaboradores: data });
    }

    if (action === 'export') {
      if (!hasRolePermission_(session.user, 'export:run')) {
        logAudit_(session.user, 'EXPORT_PADRON', 'DENIED_FORBIDDEN', 'Sin permiso export:run');
        return jsonResponse({ success: false, error: 'Permisos insuficientes para exportar.' });
      }
      const data = readPadronByScope_(session.user);
      logAudit_(session.user, 'EXPORT_PADRON', 'SUCCESS', `Exportados=${data.length}`);
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
    if (rawBody.length > 10 * 1024 * 1024) {
      return jsonResponse({ success: false, error: 'Tamaño de solicitud excede el límite permitido.' });
    }
    const body = JSON.parse(rawBody);
    const action = String(body.action || '').trim();

    // 1. Inicio de sesión con rate limiting y bloqueo temporal
    if (action === 'login') {
      return handleLogin_(body);
    }

    // 2. Cierre de sesión con revocación en CacheService
    if (action === 'logout') {
      const session = verifyToken_(body.token);
      if (session) {
        revokeToken_(session.jti);
        logAudit_(session, 'LOGOUT', 'SUCCESS', 'Token revocado');
      }
      return jsonResponse({ success: true });
    }

    // 3. Validación obligatoria de identidad y permisos para toda escritura
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
  const rateKey = `rl_login_${email || 'anon'}`;
  const cache = CacheService.getScriptCache();

  const lockVal = cache.get(`${rateKey}_lock`);
  if (lockVal) {
    logAudit_({ email: email || 'anonymous', role: 'NONE', department: 'N/A' }, 'LOGIN', 'RATE_LIMITED', 'Bloqueo activo');
    return jsonResponse({ success: false, error: 'Demasiados intentos fallidos. Intenta nuevamente en 15 minutos.' });
  }

  const props = PropertiesService.getScriptProperties();
  const usersJson = props.getProperty('USERS_JSON');
  if (!usersJson) {
    return jsonResponse({ success: false, error: 'Configuración de autenticación pendiente en PropertiesService.' });
  }

  const users = JSON.parse(usersJson);
  const found = users.find(u => u.email === email || (Array.isArray(u.aliases) && u.aliases.includes(email)));
  const valid = found && verifySha256ConstantTime_(password, found.salt, found.passHash);

  if (!valid) {
    const attempts = Number(cache.get(rateKey) || 0) + 1;
    cache.put(rateKey, String(attempts), LOCKOUT_SECONDS);
    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      cache.put(`${rateKey}_lock`, '1', LOCKOUT_SECONDS);
    }
    logAudit_({ email: email || 'anonymous', role: 'NONE', department: 'N/A' }, 'LOGIN', 'FAILED', `Intento #${attempts}`);
    return jsonResponse({ success: false, error: 'Credenciales inválidas.' });
  }

  cache.remove(rateKey);
  cache.remove(`${rateKey}_lock`);

  const issued = issueToken_(found);
  logAudit_(found, 'LOGIN', 'SUCCESS', 'Acceso autorizado');
  return jsonResponse({
    success: true,
    token: issued.token,
    expiresAt: issued.expiresAt,
    user: { email: found.email, name: found.name, role: found.roleLabel, roleCode: found.role, department: found.department }
  });
}

function getHmacSecret_() {
  const secret = PropertiesService.getScriptProperties().getProperty('HMAC_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error('HMAC_SECRET no configurado en ScriptProperties.');
  }
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
  const sigBytes = Utilities.computeHmacSha256Signature(payloadB64, getHmacSecret_());
  const sigB64 = Utilities.base64EncodeWebSafe(sigBytes);
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
    logAudit_(session, actionName, 'DENIED_FORBIDDEN', `Permiso=${requiredPermission}, Dept=${targetDepartment || 'N/A'}`);
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
  // Protección Formula Injection: prefijar con apóstrofo si inicia con =, +, -, @, tab o CR
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
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
  if (!/^[0-9A-Za-z]{8,12}$/.test(dni)) errs.push('DNI inválido.');
  if (nombre.length < 5) errs.push('Nombre demasiado corto.');
  const cl = String(body.condicionLaboral || 'CONTRATO').toUpperCase().trim();
  if (['CONTRATO', 'RXH', 'OTROS'].indexOf(cl) === -1) errs.push('Condición laboral no permitida.');
  if (body.sueldo !== undefined && body.sueldo !== '') {
    const n = Number(body.sueldo);
    if (isNaN(n) || n < 0 || n > 100000) errs.push('Remuneración inválida.');
  }
  return errs;
}

// ============================================================================
// 4. LECTURA Y ESCRITURA SEGURA EN GOOGLE SHEETS + AUDIT LOG
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

function updatePersonalInSheets_(body, user) {
  const sheetId = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName('1_PADRON_GENERAL');
  const data = sh.getDataRange().getValues();
  const targetDni = sanitizeText_(body.originalDni || body.dni, 16);

  let rowIdx = -1;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]).trim() === targetDni) {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) throw new Error('Colaborador no encontrado.');

  const cur = data[rowIdx - 1];
  const safeRow = [
    cur[0],
    sanitizeSheetCell_(body.dni, 16),
    sanitizeSheetCell_(String(body.nombre || '').toUpperCase(), 140),
    sanitizeSheetCell_(body.area, 60),
    sanitizeSheetCell_(body.cargo, 80),
    sanitizeSheetCell_(body.condicion || cur[5], 40),
    sanitizeSheetCell_(body.estado || cur[6], 30),
    sanitizeSheetCell_(body.fechaInicio || cur[7], 20),
    sanitizeSheetCell_(body.fechaFin || cur[8], 20),
    sanitizeSheetCell_(body.sueldo, 15),
    sanitizeSheetCell_(body.domicilio, 220),
    sanitizeSheetCell_(body.celular, 25),
    sanitizeSheetCell_(body.correo, 120),
    sanitizeSheetCell_(`${body.banco || ''} ${body.numeroCuenta || ''}`.trim(), 80),
    cur[14],
    cur[15],
    cur[16],
    sanitizeSheetCell_(String(body.condicionLaboral || 'CONTRATO').toUpperCase(), 20)
  ];

  sh.getRange(rowIdx, 1, 1, safeRow.length).setValues([safeRow]);
  return { updatedRow: rowIdx };
}

function createPersonalInSheets_(body, user) {
  const sheetId = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID');
  const ss = SpreadsheetApp.openById(sheetId);
  const sh = ss.getSheetByName('1_PADRON_GENERAL');
  const nextId = sh.getLastRow();
  const safeRow = [
    String(nextId),
    sanitizeSheetCell_(body.dni, 16),
    sanitizeSheetCell_(String(body.nombre || '').toUpperCase(), 140),
    sanitizeSheetCell_(body.area, 60),
    sanitizeSheetCell_(body.cargo, 80),
    sanitizeSheetCell_(body.condicion || 'FULL TIME', 40),
    sanitizeSheetCell_(body.estado || 'ACTIVO', 30),
    sanitizeSheetCell_(body.fechaInicio, 20),
    sanitizeSheetCell_(body.fechaFin, 20),
    sanitizeSheetCell_(body.sueldo, 15),
    sanitizeSheetCell_(body.domicilio, 220),
    sanitizeSheetCell_(body.celular, 25),
    sanitizeSheetCell_(body.correo, 120),
    sanitizeSheetCell_(`${body.banco || ''} ${body.numeroCuenta || ''}`.trim(), 80),
    '', '', '',
    sanitizeSheetCell_(String(body.condicionLaboral || 'CONTRATO').toUpperCase(), 20)
  ];
  sh.appendRow(safeRow);
  return { createdId: nextId };
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
  } catch (e) {
    // Nunca fallar la operación principal por un error de log
  }
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
  for (let i = 0; i < s1.length; i++) {
    diff |= s1.charCodeAt(i) ^ s2.charCodeAt(i);
  }
  return diff === 0;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

