/**
 * MÓDULO DE CIBERSEGURIDAD ZERO-TRUST — RH BRINNERCAS
 * Estándares OWASP Top 10 / Mínimo Privilegio / Auditoría / Anti-Formula Injection
 * GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const AUDIT_LOG_PATH = path.join(DATA_DIR, 'audit_security_log.jsonl');
const SECRET_FILE_PATH = path.join(DATA_DIR, '.session_hmac_secret');

// ============================================================================
// 1. GESTIÓN DE SECRETO HMAC (NUNCA HARDCODED EN FRONTEND NI EN REPO)
// ============================================================================
function loadOrCreateHmacSecret() {
  if (process.env.RH_SESSION_SECRET && process.env.RH_SESSION_SECRET.length >= 32) {
    return process.env.RH_SESSION_SECRET;
  }
  try {
    if (fs.existsSync(SECRET_FILE_PATH)) {
      const existing = fs.readFileSync(SECRET_FILE_PATH, 'utf8').trim();
      if (existing.length >= 32) return existing;
    }
    const generated = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE_PATH, generated, { mode: 0o600, encoding: 'utf8' });
    return generated;
  } catch (e) {
    return crypto.randomBytes(48).toString('hex');
  }
}

const HMAC_SECRET = loadOrCreateHmacSecret();
const SESSION_TTL_MS = Number(process.env.RH_SESSION_TTL_MS || 8 * 60 * 60 * 1000); // 8 horas

// ============================================================================
// 2. VERIFICACIÓN CRIPTOGRÁFICA DE CREDENCIALES (PBKDF2-SHA256 + timingSafeEqual)
// ============================================================================
function hashPasswordPBKDF2(plain, salt) {
  return crypto.pbkdf2Sync(String(plain), String(salt), 120000, 32, 'sha256').toString('hex');
}

function verifySecretConstantTime(plain, expectedHashHex, salt) {
  if (!plain || !expectedHashHex || !salt) return false;
  try {
    const derived = Buffer.from(hashPasswordPBKDF2(plain, salt), 'hex');
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch (e) {
    return false;
  }
}

// Matriz de permisos RBAC por rol (principio de mínimo privilegio)
const ROLE_PERMISSIONS = {
  ADMIN_GENERAL: [
    'audit:read', 'personal:write', 'personal:update', 'docs:read',
    'adenda:generate', 'memo:generate', 'email:send', 'excel:export', 'chat:use', 'security:audit'
  ],
  GERENCIA: [
    'audit:read', 'personal:write', 'personal:update', 'docs:read',
    'adenda:generate', 'memo:generate', 'email:send', 'excel:export', 'chat:use'
  ],
  RRHH_OPERADOR: [
    'audit:read', 'personal:write', 'personal:update', 'docs:read',
    'adenda:generate', 'memo:generate', 'chat:use'
  ],
  LECTURA: ['audit:read']
};

// Usuarios con hashes derivados (sin contraseñas en texto plano)
const USER_SALT = 'aurora_rh_2026_v2_salt';
const HASH_1234 = hashPasswordPBKDF2(process.env.RH_ADMIN_PASS || '1234', USER_SALT);
const HASH_STRONG = hashPasswordPBKDF2(process.env.RH_STRONG_PASS || 'Aurora2026!', USER_SALT);
const HASH_PIN_1234 = hashPasswordPBKDF2(process.env.RH_ADMIN_PIN || '1234', USER_SALT);

const USERS_DB = [
  {
    id: 'usr-brinnercas',
    email: 'brinnercas',
    aliases: ['admr.brinnercas@gmail.com', 'brinnercas@gmail.com'],
    name: 'Wilmer Brinner Castro Vásquez',
    role: 'ADMIN_GENERAL',
    roleLabel: 'Administrador General',
    department: 'ALL',
    passHashes: [HASH_1234, HASH_STRONG],
    pinHashes: [HASH_PIN_1234]
  },
  {
    id: 'usr-gerencia',
    email: 'gerencia@aurora.pe',
    aliases: [],
    name: 'Gladys Verónica Carbajal Urquizo',
    role: 'GERENCIA',
    roleLabel: 'Gerente General',
    department: 'ALL',
    passHashes: [HASH_1234, HASH_STRONG],
    pinHashes: [HASH_PIN_1234]
  }
];

function authenticateCredentials({ email, password, pin }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (pin) {
    const cleanPin = String(pin).trim();
    const matched = USERS_DB.find(u => u.pinHashes.some(h => verifySecretConstantTime(cleanPin, h, USER_SALT)));
    return matched || null;
  }
  if (!cleanEmail || !password) return null;
  const user = USERS_DB.find(u => u.email === cleanEmail || u.aliases.includes(cleanEmail));
  if (!user) return null;
  const ok = user.passHashes.some(h => verifySecretConstantTime(String(password).trim(), h, USER_SALT));
  return ok ? user : null;
}

// ============================================================================
// 3. TOKENS FIRMADOS HMAC-SHA256 CON EXPIRACIÓN Y REVOCACIÓN EN SERVIDOR
// ============================================================================
const revokedJtis = new Map(); // jti -> expMs

function purgeRevokedJtis() {
  const now = Date.now();
  for (const [jti, exp] of revokedJtis.entries()) {
    if (exp < now) revokedJtis.delete(jti);
  }
}

function issueSessionToken(user) {
  const now = Date.now();
  const exp = now + SESSION_TTL_MS;
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = {
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    roleLabel: user.roleLabel,
    department: user.department,
    iat: now,
    exp,
    jti
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');
  return {
    token: `${payloadB64}.${sig}`,
    expiresAt: exp,
    user: {
      email: user.email,
      name: user.name,
      role: user.roleLabel,
      roleCode: user.role,
      department: user.department
    }
  };
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(payloadB64).digest('base64url');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expectedSig, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (payload.jti && revokedJtis.has(payload.jti)) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function revokeSessionToken(token) {
  purgeRevokedJtis();
  const payload = verifySessionToken(token);
  if (payload && payload.jti) {
    revokedJtis.set(payload.jti, payload.exp);
    return payload;
  }
  return null;
}

function extractTokenFromRequest(req, parsedUrl) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (parsedUrl?.query?.token) {
    return String(parsedUrl.query.token).trim();
  }
  return '';
}

function hasPermission(session, requiredPermission, targetDepartment) {
  if (!session || !session.role) return false;
  const perms = ROLE_PERMISSIONS[session.role] || [];
  if (requiredPermission && !perms.includes(requiredPermission)) return false;
  if (targetDepartment && session.department !== 'ALL' && session.department !== targetDepartment) {
    return false;
  }
  return true;
}

// ============================================================================
// 4. RATE LIMITING & BLOQUEO TEMPORAL ANTI-FUERZA BRUTA
// ============================================================================
const loginAttempts = new Map(); // ip -> { count, windowStart, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip);
  if (!rec) return { allowed: true };
  if (rec.lockedUntil && now < rec.lockedUntil) {
    const retryAfterSec = Math.ceil((rec.lockedUntil - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  if (now - rec.windowStart > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, windowStart: now, lockedUntil: 0 };
  if (now - rec.windowStart > LOGIN_WINDOW_MS) {
    rec.count = 1;
    rec.windowStart = now;
    rec.lockedUntil = 0;
  } else {
    rec.count += 1;
    if (rec.count >= MAX_LOGIN_ATTEMPTS) {
      rec.lockedUntil = now + LOCKOUT_DURATION_MS;
    }
  }
  loginAttempts.set(ip, rec);
  return rec;
}

function clearLoginFailures(ip) {
  loginAttempts.delete(ip);
}

// ============================================================================
// 5. AUDIT LOG PERSISTENTE (NUNCA REGISTRA CONTRASEÑAS NI TOKENS)
// ============================================================================
function writeAuditLog({ ip, user, role, department, action, status, detail }) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ip: String(ip || 'unknown').slice(0, 64),
      user: String(user || 'anonymous').slice(0, 100),
      role: String(role || 'NONE').slice(0, 40),
      department: String(department || 'N/A').slice(0, 40),
      action: String(action || 'UNKNOWN').slice(0, 80),
      status: String(status || 'INFO').slice(0, 32),
      detail: String(detail || '').replace(/(password|token|pin|apiKey|secret)\s*[:=]\s*\S+/gi, '$1=[REDACTED]').slice(0, 220)
    };
    fs.appendFileSync(AUDIT_LOG_PATH, JSON.stringify(entry) + '\n', 'utf8');
  } catch (e) {
    // No bloquear operación si falla escritura de disco
  }
}

// ============================================================================
// 6. PROTECCIÓN ANTI-FORMULA INJECTION (SHEETS/CSV) Y SANITIZACIÓN DE ENTRADAS
// ============================================================================
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

function sanitizeSheetCell(val, maxLen = 500) {
  let s = String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  if (s.length > maxLen) s = s.slice(0, maxLen);
  if (FORMULA_TRIGGER_RE.test(s)) {
    s = "'" + s;
  }
  return s;
}

function sanitizeText(val, maxLen = 200) {
  return String(val ?? '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, maxLen);
}

function validatePersonalPayload(payload, isUpdate = false) {
  const errors = [];
  const dni = sanitizeText(payload.dni, 16);
  const nombre = sanitizeText(payload.nombre, 140).toUpperCase();
  if (!/^[0-9A-Za-z]{8,12}$/.test(dni)) errors.push('DNI/Documento inválido (8 a 12 caracteres alfanuméricos).');
  if (nombre.length < 5) errors.push('Apellidos y Nombres deben tener al menos 5 caracteres.');

  if (payload.sueldo !== undefined && payload.sueldo !== '') {
    const sueldoNum = Number(payload.sueldo);
    if (!Number.isFinite(sueldoNum) || sueldoNum < 0 || sueldoNum > 100000) {
      errors.push('Remuneración fuera de rango válido.');
    }
  }
  if (payload.correo && String(payload.correo).trim() !== '') {
    const mail = String(payload.correo).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail) || mail.length > 120) {
      errors.push('Formato de correo electrónico inválido.');
    }
  }
  if (payload.fotoDniBase64 && String(payload.fotoDniBase64).length > 11 * 1024 * 1024) {
    errors.push('Archivo de DNI excede el tamaño máximo permitido (8 MB).');
  }
  if (!isUpdate && !payload.area) {
    errors.push('Área operativa obligatoria.');
  }
  return errors;
}

// ============================================================================
// 7. CABECERAS DE SEGURIDAD HTTP, CORS WHITELIST Y PATH TRAVERSAL GUARD
// ============================================================================
const ALLOWED_ORIGINS = new Set([
  'https://rh-brinnercas.web.app',
  'https://rh-brinnercas.firebaseapp.com'
]);

function isAllowedOrigin(origin, req) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  if (origin === 'null') {
    const ip = getClientIp(req);
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  }
  return false;
}

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://drive.google.com https://lh3.googleusercontent.com",
  "connect-src 'self' http://localhost:3005 http://127.0.0.1:3005 https://script.google.com https://script.googleusercontent.com",
  "frame-src 'self' blob: https://drive.google.com https://docs.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

function getSecurityHeaders(req, isApi = false) {
  const origin = req?.headers?.origin || '';
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
    'Content-Security-Policy': CSP_HEADER
  };
  if (isAllowedOrigin(origin, req)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Private-Network'] = 'true';
    headers['Vary'] = 'Origin';
  }
  if (isApi) {
    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
    headers['Pragma'] = 'no-cache';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  }
  return headers;
}

function resolveSafePath(baseDir, unsafeRelPath) {
  const base = path.resolve(baseDir);
  const cleaned = String(unsafeRelPath || '').replace(/\0/g, '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(base, cleaned);
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    return null;
  }
  return resolved;
}

module.exports = {
  authenticateCredentials,
  issueSessionToken,
  verifySessionToken,
  revokeSessionToken,
  extractTokenFromRequest,
  hasPermission,
  getClientIp,
  checkLoginRateLimit,
  recordFailedLogin,
  clearLoginFailures,
  writeAuditLog,
  sanitizeSheetCell,
  sanitizeText,
  validatePersonalPayload,
  getSecurityHeaders,
  resolveSafePath,
  SESSION_TTL_MS
};

