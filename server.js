/**
 * SERVIDOR AUTÓNOMO FULL-STACK ENDURECIDO (ZERO-TRUST / OWASP) — RH BRINNERCAS
 * GRUPO GASTRONÓMICO AURORA S.A.C. (RUC 20615117111)
 * Puerto por defecto: 3005
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const { calcularAuditoria, cargarPadron } = require('./services/audit_engine');
const { generarAdendaPorId, generarTodasAdendasActivas } = require('./services/adenda_engine');
const { generarContratoBuffer, generarHtmlContrato } = require('./services/contrato_engine');
const { generarMemorandum, MOTIVOS_PREDEFINIDOS } = require('./services/memo_engine');
const { generarActaEntrega } = require('./services/acta_engine');
const { calcularLiquidacion, generarHtmlLiquidacion } = require('./services/liquidacion_engine');
const { registrarNuevoIngreso, actualizarPersonalExistente } = require('./services/sheets_drive_sync');
const { responderConsulta } = require('./services/assistant_ai');
const {
  authenticateCredentials,
  createResetOtp,
  verifyAndResetPasswordWithOtp,
  changeUserPassword,
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
  getSecurityHeaders,
  resolveSafePath
} = require('./services/security');

const PORT = process.env.PORT || 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, 'data');
const MAX_BODY_BYTES = 12 * 1024 * 1024; // 12 MB máximo (para adjuntos DNI en Base64)

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function parseBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', chunk => {
      total += chunk.length;
      if (total > maxBytes) {
        reject(Object.assign(new Error('PAYLOAD_TOO_LARGE'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendJson(req, res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    ...getSecurityHeaders(req, true)
  });
  res.end(JSON.stringify(data));
}

function sendFileDownload(req, res, filePath, customName, forceDownload = true) {
  if (!filePath || !fs.existsSync(filePath)) {
    return sendJson(req, res, 404, { success: false, error: 'Recurso no encontrado.' });
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const name = path.basename(customName || path.basename(filePath));
  const headers = {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    ...getSecurityHeaders(req, false)
  };
  headers['Content-Disposition'] = forceDownload
    ? `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
    : `inline; filename*=UTF-8''${encodeURIComponent(name)}`;
  res.writeHead(200, headers);
  return fs.createReadStream(filePath).pipe(res);
}

/**
 * Validación Zero-Trust obligatoria en servidor para cualquier endpoint protegido.
 */
function requireAuth(req, res, parsedUrl, requiredPermission, actionName = 'API_ACCESS') {
  const ip = getClientIp(req);
  const token = extractTokenFromRequest(req, parsedUrl);
  const session = verifySessionToken(token);

  if (!session) {
    writeAuditLog({
      ip,
      user: 'anonymous',
      role: 'NONE',
      department: 'N/A',
      action: actionName,
      status: 'DENIED_UNAUTHENTICATED',
      detail: `${req.method} ${parsedUrl.pathname}`
    });
    sendJson(req, res, 401, { success: false, error: 'Sesión expirada o no autorizada. Inicia sesión nuevamente.' });
    return null;
  }

  if (!hasPermission(session, requiredPermission)) {
    writeAuditLog({
      ip,
      user: session.email,
      role: session.role,
      department: session.department,
      action: actionName,
      status: 'DENIED_FORBIDDEN',
      detail: `Permiso requerido: ${requiredPermission}`
    });
    sendJson(req, res, 403, { success: false, error: 'No cuentas con permisos suficientes para esta operación.' });
    return null;
  }

  return session;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const ip = getClientIp(req);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, getSecurityHeaders(req, true));
    return res.end();
  }

  try {
    // ========================================================================
    // 1. AUTENTICACIÓN, RATE LIMITING, SESIÓN Y LOGOUT
    // ========================================================================
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const rate = checkLoginRateLimit(ip);
      if (!rate.allowed) {
        writeAuditLog({
          ip,
          user: 'unknown',
          role: 'NONE',
          action: 'LOGIN',
          status: 'RATE_LIMITED',
          detail: `Bloqueado por ${rate.retryAfterSec}s`
        });
        return sendJson(req, res, 429, {
          success: false,
          error: `Demasiados intentos fallidos. Espera ${Math.ceil(rate.retryAfterSec / 60)} minutos e intenta nuevamente.`
        });
      }

      const body = await parseBody(req, 16 * 1024);
      const user = authenticateCredentials({
        email: body.email,
        password: body.password,
        pin: body.pin
      });

      if (!user) {
        const failInfo = recordFailedLogin(ip);
        writeAuditLog({
          ip,
          user: String(body.email || (body.pin ? 'PIN_LOGIN' : 'unknown')).slice(0, 80),
          role: 'NONE',
          action: 'LOGIN',
          status: 'FAILED',
          detail: `Intento fallido #${failInfo.count}`
        });
        return sendJson(req, res, 401, { success: false, error: 'Usuario, correo o contraseña inválidos.' });
      }

      clearLoginFailures(ip);
      const issued = issueSessionToken(user);
      writeAuditLog({
        ip,
        user: user.email,
        role: user.role,
        department: user.department,
        action: 'LOGIN',
        status: 'SUCCESS',
        detail: body.pin ? 'Autenticación por PIN' : 'Autenticación por credenciales'
      });

      return sendJson(req, res, 200, {
        success: true,
        user: issued.user,
        token: issued.token,
        expiresAt: issued.expiresAt
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/logout') {
      const token = extractTokenFromRequest(req, parsedUrl);
      const revoked = revokeSessionToken(token);
      writeAuditLog({
        ip,
        user: revoked?.email || 'unknown',
        role: revoked?.role || 'NONE',
        department: revoked?.department || 'N/A',
        action: 'LOGOUT',
        status: 'SUCCESS',
        detail: 'Sesión revocada en servidor'
      });
      return sendJson(req, res, 200, { success: true });
    }

    // 1B. Recuperar contraseña por código OTP (Correo o WhatsApp)
    if (req.method === 'POST' && pathname === '/api/auth/recover-request') {
      const rate = checkLoginRateLimit(ip);
      if (!rate.allowed) {
        return sendJson(req, res, 429, { success: false, error: 'Demasiados intentos. Intenta nuevamente en 15 minutos.' });
      }
      const body = await parseBody(req, 16 * 1024);
      const identifier = String(body.email || '').trim();
      const channel = String(body.channel || 'email').toLowerCase();
      const created = createResetOtp(identifier);
      if (!created) {
        writeAuditLog({ ip, user: identifier.slice(0, 80), role: 'NONE', action: 'PASSWORD_RECOVER_REQ', status: 'FAILED', detail: 'Usuario no encontrado' });
        return sendJson(req, res, 404, { success: false, error: 'Usuario o correo inválido.' });
      }

      let emailSent = false;
      let whatsappUrl = null;
      const maskedEmail = created.user.recoveryEmail.replace(/(.{2}).+(@.+)/, '$1***$2');

      if (channel === 'whatsapp') {
        const msg = `RH BRINNERCAS - Código de recuperación de contraseña: ${created.code} (Válido por 10 minutos).`;
        whatsappUrl = `https://wa.me/${created.user.whatsapp}?text=${encodeURIComponent(msg)}`;
      } else {
        try {
          const { execFileSync } = require('child_process');
          const tmpOtp = path.join(DATA_DIR, `tmp_otp_${Date.now()}.md`);
          fs.writeFileSync(tmpOtp, `Hola ${created.user.name},\n\nTu código de recuperación para RH BRINNERCAS es:\n\n**${created.code}**\n\nEste código expira en 10 minutos. Si no solicitaste este cambio, ignora este mensaje.`, 'utf8');
          const args = ['mutate', 'send', '--to', created.user.recoveryEmail, '--subject', 'RH BRINNERCAS — Código de recuperación de contraseña', '--body-file', tmpOtp];
          if (process.platform === 'win32') {
            execFileSync('cmd.exe', ['/d', '/c', 'gmail', ...args], { encoding: 'utf8', timeout: 15000, shell: false });
          } else {
            execFileSync('gmail', args, { encoding: 'utf8', timeout: 15000, shell: false });
          }
          if (fs.existsSync(tmpOtp)) fs.unlinkSync(tmpOtp);
          emailSent = true;
        } catch (e) {
          emailSent = false;
        }
      }

      writeAuditLog({ ip, user: created.user.email, role: created.user.role, department: created.user.department, action: 'PASSWORD_RECOVER_REQ', status: 'SUCCESS', detail: `Canal=${channel}` });
      return sendJson(req, res, 200, {
        success: true,
        channel,
        maskedEmail,
        emailSent,
        whatsappUrl,
        message: channel === 'whatsapp'
          ? 'Código generado. Abre WhatsApp para enviarlo a tu número registrado e ingrésalo abajo.'
          : (emailSent ? `Código de 6 dígitos enviado a ${maskedEmail}.` : `Código generado para ${maskedEmail}.`)
      });
    }

    if (req.method === 'POST' && pathname === '/api/auth/recover-reset') {
      const body = await parseBody(req, 16 * 1024);
      const result = verifyAndResetPasswordWithOtp(body.email, body.code, body.newPassword);
      if (!result.ok) {
        writeAuditLog({ ip, user: String(body.email || '').slice(0, 80), role: 'NONE', action: 'PASSWORD_RESET', status: 'FAILED', detail: result.error });
        return sendJson(req, res, 400, { success: false, error: result.error });
      }
      writeAuditLog({ ip, user: result.user.email, role: result.user.role, department: result.user.department, action: 'PASSWORD_RESET', status: 'SUCCESS', detail: 'Contraseña restablecida vía OTP' });
      return sendJson(req, res, 200, { success: true, message: 'Contraseña restablecida correctamente. Ya puedes iniciar sesión.' });
    }

    // 1C. Cambiar contraseña desde dentro de la web (Zero-Trust autenticado)
    if (req.method === 'POST' && pathname === '/api/auth/change-password') {
      const session = requireAuth(req, res, parsedUrl, 'audit:read', 'PASSWORD_CHANGE');
      if (!session) return;
      const body = await parseBody(req, 16 * 1024);
      const result = changeUserPassword(session.email, body.currentPassword, body.newPassword);
      if (!result.ok) {
        writeAuditLog({ ip, user: session.email, role: session.role, department: session.department, action: 'PASSWORD_CHANGE', status: 'FAILED', detail: result.error });
        return sendJson(req, res, 400, { success: false, error: result.error });
      }
      writeAuditLog({ ip, user: session.email, role: session.role, department: session.department, action: 'PASSWORD_CHANGE', status: 'SUCCESS', detail: 'Contraseña actualizada desde Dock' });
      return sendJson(req, res, 200, { success: true, message: 'Contraseña actualizada correctamente.' });
    }

    if (req.method === 'GET' && pathname === '/api/auth/session') {
      const session = requireAuth(req, res, parsedUrl, 'audit:read', 'SESSION_CHECK');
      if (!session) return;
      return sendJson(req, res, 200, {
        success: true,
        user: {
          email: session.email,
          name: session.name,
          role: session.roleLabel,
          roleCode: session.role,
          department: session.department
        },
        expiresAt: session.exp
      });
    }

    // ========================================================================
    // 2. AUDITORÍA, PADRÓN, MOF Y MOTIVOS (PROTEGIDOS ZERO-TRUST)
    // ========================================================================
    if (req.method === 'GET' && pathname === '/api/audit') {
      const session = requireAuth(req, res, parsedUrl, 'audit:read', 'AUDIT_READ');
      if (!session) return;
      return sendJson(req, res, 200, calcularAuditoria());
    }

    if (req.method === 'GET' && pathname === '/api/mof') {
      const session = requireAuth(req, res, parsedUrl, 'audit:read', 'MOF_READ');
      if (!session) return;
      const mofPath = path.join(DATA_DIR, 'mof_puestos_aurora.json');
      const mof = JSON.parse(fs.readFileSync(mofPath, 'utf8'));
      return sendJson(req, res, 200, mof);
    }

    if (req.method === 'GET' && pathname === '/api/memo-motivos') {
      const session = requireAuth(req, res, parsedUrl, 'audit:read', 'MEMO_MOTIVOS_READ');
      if (!session) return;
      return sendJson(req, res, 200, MOTIVOS_PREDEFINIDOS);
    }

    // ========================================================================
    // 3. CHAT ASISTENTE GEMINI IA
    // ========================================================================
    if (req.method === 'POST' && pathname === '/api/chat') {
      const session = requireAuth(req, res, parsedUrl, 'chat:use', 'AI_CHAT');
      if (!session) return;
      const body = await parseBody(req, 256 * 1024);
      const reply = await responderConsulta(String(body.message || '').slice(0, 4000), {
        apiKey: body.apiKey || '',
        previousInteractionId: body.previousInteractionId || undefined
      });
      return sendJson(req, res, 200, { reply, model: 'gemini-4-hydrogen' });
    }

    // ========================================================================
    // 4. DESPACHO DE CORREO CORPORATIVO (CON AUDIT LOG)
    // ========================================================================
    if (req.method === 'POST' && pathname === '/api/email/send') {
      const session = requireAuth(req, res, parsedUrl, 'email:send', 'EMAIL_SEND');
      if (!session) return;
      const body = await parseBody(req, 512 * 1024);
      const histPath = path.join(DATA_DIR, 'historial_correos.json');
      let hist = [];
      if (fs.existsSync(histPath)) {
        try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch (e) { hist = []; }
      }

      const to = String(body.to || '').trim().slice(0, 180);
      const cc = String(body.cc || '').trim().slice(0, 180);
      const subject = String(body.subject || 'Documentación Laboral — Grupo Gastronómico Aurora S.A.C.').trim().slice(0, 220);
      const mailBody = String(body.body || '').trim().slice(0, 15000);
      let estadoEnvio = 'REGISTRADO / LISTO PARA DESPACHO';
      let gmailOutput = null;

      if (body.sendViaGmailCli && to && mailBody) {
        const { execFileSync } = require('child_process');
        const tmpBodyPath = path.join(DATA_DIR, `tmp_mail_${Date.now()}.md`);
        try {
          fs.writeFileSync(tmpBodyPath, mailBody, 'utf8');
          const safeSubj = subject.replace(/"/g, "'").replace(/%/g, '%%');
          const args = ['mutate', 'send', '--to', to, '--subject', safeSubj, '--body-file', tmpBodyPath];
          if (cc) args.push('--cc', cc);
          gmailOutput = execFileSync('gmail', args, { encoding: 'utf8', timeout: 15000, shell: false }).trim();
          estadoEnvio = 'ENVIADO POR GMAIL API (admr.brinnercas@gmail.com)';
        } catch (cliErr) {
          try {
            const safeSubj = subject.replace(/"/g, "'").replace(/%/g, '%%');
            const draftArgs = ['mutate', 'create-draft', '--to', to, '--subject', safeSubj, '--body-file', tmpBodyPath];
            gmailOutput = execFileSync('gmail', draftArgs, { encoding: 'utf8', timeout: 15000, shell: false }).trim();
            estadoEnvio = 'BORRADOR CREADO EN GMAIL (admr.brinnercas@gmail.com)';
          } catch (e2) {
            estadoEnvio = 'PREPARADO EN SISTEMA';
          }
        } finally {
          if (fs.existsSync(tmpBodyPath)) {
            try { fs.unlinkSync(tmpBodyPath); } catch (e) {}
          }
        }
      }

      const entry = {
        id: Date.now(),
        fecha: new Date().toLocaleString('es-PE'),
        de: 'admr.brinnercas@gmail.com',
        para: to,
        cc,
        tipo: String(body.tipo || 'DOCUMENTO').trim().slice(0, 40),
        colaborador: String(body.colaboradorNombre || 'General').trim().slice(0, 120),
        asunto: subject,
        cuerpo: mailBody,
        adjuntosDrive: Array.isArray(body.driveLinks) ? body.driveLinks.slice(0, 10) : [],
        estado: estadoEnvio,
        gmailOutput
      };
      hist.unshift(entry);
      fs.writeFileSync(histPath, JSON.stringify(hist.slice(0, 100), null, 2), 'utf8');

      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'EMAIL_SEND',
        status: 'SUCCESS',
        detail: `Tipo=${entry.tipo}, Para=${to}`
      });

      return sendJson(req, res, 200, { success: true, entry, historial: hist.slice(0, 25) });
    }

    if (req.method === 'GET' && pathname === '/api/email/history') {
      const session = requireAuth(req, res, parsedUrl, 'email:send', 'EMAIL_HISTORY_READ');
      if (!session) return;
      const histPath = path.join(DATA_DIR, 'historial_correos.json');
      let hist = [];
      if (fs.existsSync(histPath)) {
        try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch (e) { hist = []; }
      }
      return sendJson(req, res, 200, { success: true, historial: hist });
    }

    // ========================================================================
    // 5. ALTA Y EDICIÓN DE PERSONAL (CON VALIDACIÓN, ANTI-FORMULA INJECTION Y AUDIT LOG)
    // ========================================================================
    if (req.method === 'POST' && pathname === '/api/personal/nuevo') {
      const session = requireAuth(req, res, parsedUrl, 'personal:write', 'PERSONAL_CREATE');
      if (!session) return;
      const body = await parseBody(req);
      const result = await registrarNuevoIngreso(body);
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'PERSONAL_CREATE',
        status: 'SUCCESS',
        detail: `ID=${result.colaborador?.id}, DNI=${result.colaborador?.dni}`
      });
      return sendJson(req, res, 200, { success: true, ...result });
    }

    if ((req.method === 'POST' && pathname === '/api/personal/actualizar') || (req.method === 'PUT' && pathname.startsWith('/api/personal/'))) {
      const session = requireAuth(req, res, parsedUrl, 'personal:update', 'PERSONAL_UPDATE');
      if (!session) return;
      const body = await parseBody(req);
      const idFromUrl = pathname.startsWith('/api/personal/') && pathname !== '/api/personal/actualizar'
        ? pathname.replace('/api/personal/', '')
        : body.id;
      const result = await actualizarPersonalExistente(idFromUrl, body);
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'PERSONAL_UPDATE',
        status: 'SUCCESS',
        detail: `ID=${result.colaborador?.id}, DNI=${result.colaborador?.dni}, Cond=${result.colaborador?.condicionLaboral}`
      });
      return sendJson(req, res, 200, { success: true, ...result });
    }

    // ========================================================================
    // 6. DESCARGAS DE LOS 5 DOCUMENTOS POR COLABORADOR
    // ========================================================================
    if (req.method === 'GET' && pathname.startsWith('/api/docs/')) {
      const session = requireAuth(req, res, parsedUrl, 'docs:read', 'DOC_DOWNLOAD');
      if (!session) return;
      const parts = pathname.replace('/api/docs/', '').split('/');
      const tipo = parts[0];
      const id = parseInt(parts[1], 10);
      const padron = cargarPadron();
      const colab = padron.colaboradores.find(c => c.id === id);
      if (!colab) return sendJson(req, res, 404, { success: false, error: 'Colaborador no encontrado.' });

      const inlineMode = parsedUrl.query.inline === '1';

      if (tipo === 'dni') {
        if (colab.documentos?.fotoDni?.fileName) {
          const fp = resolveSafePath(path.join(PUBLIC_DIR, 'docs', 'dni'), colab.documentos.fotoDni.fileName);
          if (fp && fs.existsSync(fp)) return sendFileDownload(req, res, fp, colab.documentos.fotoDni.originalName || colab.documentos.fotoDni.fileName, !inlineMode);
        }
        return sendJson(req, res, 404, { success: false, error: 'Foto de DNI no encontrada.' });
      }

      if (tipo === 'contrato') {
        if (colab.documentos?.contrato?.fileName && parsedUrl.query.format !== 'html') {
          const fp = resolveSafePath(path.join(PUBLIC_DIR, 'docs', 'contratos'), colab.documentos.contrato.fileName);
          if (fp && fs.existsSync(fp)) return sendFileDownload(req, res, fp, colab.documentos.contrato.fileName, !inlineMode);
        }
        if (inlineMode || parsedUrl.query.format === 'html') {
          const html = generarHtmlContrato(colab);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...getSecurityHeaders(req, false) });
          return res.end(html);
        }
        const gen = await generarContratoBuffer(colab);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES['.docx'],
          'Content-Length': gen.buffer.length,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(gen.fileName)}`,
          ...getSecurityHeaders(req, false)
        });
        return res.end(gen.buffer);
      }

      if (tipo === 'adenda') {
        const index = parsedUrl.query.index !== undefined ? parseInt(parsedUrl.query.index, 10) : null;
        if (index !== null && colab.documentos?.adendas?.[index]) {
          const fname = colab.documentos.adendas[index].fileName;
          const fp = resolveSafePath(path.join(PUBLIC_DIR, 'docs', 'adendas'), fname);
          if (fp && fs.existsSync(fp)) return sendFileDownload(req, res, fp, fname, !inlineMode);
        }
        const gen = await generarAdendaPorId(id, {});
        res.writeHead(200, {
          'Content-Type': MIME_TYPES['.docx'],
          'Content-Length': gen.buffer.length,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(gen.fileName)}`,
          ...getSecurityHeaders(req, false)
        });
        return res.end(gen.buffer);
      }

      if (tipo === 'memo' || tipo === 'memorandum') {
        const index = parsedUrl.query.index !== undefined ? parseInt(parsedUrl.query.index, 10) : 0;
        if (colab.documentos?.memorandums?.[index]) {
          const fname = colab.documentos.memorandums[index].name || colab.documentos.memorandums[index].fileName;
          const fp = resolveSafePath(path.join(PUBLIC_DIR, 'docs', 'memos'), fname);
          if (fp && fs.existsSync(fp)) return sendFileDownload(req, res, fp, fname, !inlineMode);
        }
        const memo = generarMemorandum({
          colaboradorId: id,
          motivoClave: parsedUrl.query.motivo || 'comunicado_general'
        });
        const fname = `MEMORANDUM_${colab.dni}_${colab.nombre.split(' ')[0]}.html`;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': inlineMode ? 'inline' : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
          ...getSecurityHeaders(req, false)
        });
        return res.end(memo.html);
      }

      if (tipo === 'liquidacion') {
        if (colab.documentos?.liquidacion?.fileName) {
          const fp = resolveSafePath(path.join(PUBLIC_DIR, 'docs', 'liquidaciones'), colab.documentos.liquidacion.fileName);
          if (fp && fs.existsSync(fp)) return sendFileDownload(req, res, fp, colab.documentos.liquidacion.fileName, !inlineMode);
        }
        const html = generarHtmlLiquidacion(colab, { regimen: parsedUrl.query.regimen || 'GENERAL' });
        const fname = `LIQUIDACION_BBSS_${colab.dni}_${colab.nombre.split(' ')[0]}.html`;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': inlineMode ? 'inline' : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
          ...getSecurityHeaders(req, false)
        });
        return res.end(html);
      }
    }

    // ========================================================================
    // 7. LIQUIDACIONES, ADENDAS, MEMOS, ACTAS Y EXPORTACIÓN EXCEL
    // ========================================================================
    if (req.method === 'GET' && pathname.startsWith('/api/liquidacion/calc/')) {
      const session = requireAuth(req, res, parsedUrl, 'docs:read', 'LIQUIDACION_CALC');
      if (!session) return;
      const id = parseInt(pathname.split('/').pop(), 10);
      const padron = cargarPadron();
      const colab = padron.colaboradores.find(c => c.id === id);
      if (!colab) return sendJson(req, res, 404, { success: false, error: 'Colaborador no encontrado.' });
      const calc = calcularLiquidacion(colab, {
        regimen: parsedUrl.query.regimen || 'GENERAL',
        fechaCese: parsedUrl.query.fechaCese || undefined
      });
      const html = generarHtmlLiquidacion(colab, {
        regimen: parsedUrl.query.regimen || 'GENERAL',
        fechaCese: parsedUrl.query.fechaCese || undefined
      });
      return sendJson(req, res, 200, { success: true, calculo: calc, html });
    }

    if (req.method === 'POST' && pathname.startsWith('/api/adenda/generate/')) {
      const session = requireAuth(req, res, parsedUrl, 'adenda:generate', 'ADENDA_GENERATE');
      if (!session) return;
      const id = pathname.split('/').pop();
      const body = await parseBody(req, 128 * 1024);
      const resultado = await generarAdendaPorId(id, body);
      const outPath = resolveSafePath(path.join(OUTPUT_DIR, 'adendas'), resultado.fileName);
      if (!outPath) return sendJson(req, res, 400, { success: false, error: 'Nombre de archivo inválido.' });
      fs.writeFileSync(outPath, resultado.buffer);
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'ADENDA_GENERATE',
        status: 'SUCCESS',
        detail: `Colab=${resultado.colaborador}`
      });
      return sendJson(req, res, 200, {
        success: true,
        colaborador: resultado.colaborador,
        dni: resultado.dni,
        fileName: resultado.fileName,
        downloadUrl: `/api/download-output/adendas/${encodeURIComponent(resultado.fileName)}`
      });
    }

    if (req.method === 'POST' && pathname === '/api/adenda/generate-all') {
      const session = requireAuth(req, res, parsedUrl, 'adenda:generate', 'ADENDA_BATCH_GENERATE');
      if (!session) return;
      const body = await parseBody(req, 128 * 1024);
      const resultado = await generarTodasAdendasActivas(body);
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'ADENDA_BATCH_GENERATE',
        status: 'SUCCESS',
        detail: `Lote generado`
      });
      return sendJson(req, res, 200, { success: true, ...resultado });
    }

    if (req.method === 'POST' && pathname === '/api/memo/generate') {
      const session = requireAuth(req, res, parsedUrl, 'memo:generate', 'MEMO_GENERATE');
      if (!session) return;
      const body = await parseBody(req, 256 * 1024);
      const resultado = generarMemorandum(body);
      const fileName = `MEMORANDUM_${resultado.dni}_${Date.now()}.html`;
      const outPath = resolveSafePath(path.join(OUTPUT_DIR, 'memos'), fileName);
      if (!outPath) return sendJson(req, res, 400, { success: false, error: 'Ruta de salida inválida.' });
      fs.writeFileSync(outPath, resultado.html, 'utf8');
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'MEMO_GENERATE',
        status: 'SUCCESS',
        detail: `DNI=${resultado.dni}`
      });
      return sendJson(req, res, 200, { success: true, fileName, downloadUrl: `/api/download-output/memos/${encodeURIComponent(fileName)}`, ...resultado });
    }

    if (req.method === 'POST' && pathname === '/api/acta/generate') {
      const session = requireAuth(req, res, parsedUrl, 'memo:generate', 'ACTA_GENERATE');
      if (!session) return;
      const body = await parseBody(req, 256 * 1024);
      const resultado = generarActaEntrega(body);
      const fileName = `ACTA_${resultado.dni}_${Date.now()}.html`;
      const outPath = resolveSafePath(path.join(OUTPUT_DIR, 'memos'), fileName);
      if (!outPath) return sendJson(req, res, 400, { success: false, error: 'Ruta de salida inválida.' });
      fs.writeFileSync(outPath, resultado.html, 'utf8');
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'ACTA_GENERATE',
        status: 'SUCCESS',
        detail: `DNI=${resultado.dni}`
      });
      return sendJson(req, res, 200, { success: true, fileName, downloadUrl: `/api/download-output/memos/${encodeURIComponent(fileName)}`, ...resultado });
    }

    if (req.method === 'GET' && pathname.startsWith('/api/download-output/')) {
      const session = requireAuth(req, res, parsedUrl, 'docs:read', 'OUTPUT_DOWNLOAD');
      if (!session) return;
      const rel = decodeURIComponent(pathname.replace('/api/download-output/', ''));
      const safeOut = resolveSafePath(OUTPUT_DIR, rel);
      if (!safeOut) return sendJson(req, res, 403, { success: false, error: 'Acceso denegado.' });
      return sendFileDownload(req, res, safeOut, path.basename(safeOut), true);
    }

    if (req.method === 'GET' && pathname === '/api/excel/resumen') {
      const session = requireAuth(req, res, parsedUrl, 'excel:export', 'EXCEL_EXPORT');
      if (!session) return;
      writeAuditLog({
        ip,
        user: session.email,
        role: session.role,
        department: session.department,
        action: 'EXCEL_EXPORT',
        status: 'SUCCESS',
        detail: 'Descarga RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx'
      });
      const excelPath = 'C:\\Users\\brinn\\OneDrive\\AURORA 2025 - 2026\\RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx';
      return sendFileDownload(req, res, excelPath, 'RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx', true);
    }

    // ========================================================================
    // 8. ARCHIVOS ESTÁTICOS DESDE public/ (CON PROTECCIÓN PATH TRAVERSAL + CSP)
    // ========================================================================
    const decodedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const filePath = resolveSafePath(PUBLIC_DIR, decodedPath);

    if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = { 'Content-Type': contentType, ...getSecurityHeaders(req, false) };
      if (parsedUrl.query.download === '1') {
        headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`;
      }
      res.writeHead(200, headers);
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback SPA a index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', ...getSecurityHeaders(req, false) });
    return fs.createReadStream(indexPath).pipe(res);

  } catch (err) {
    // Manejo seguro de errores: nunca exponer stack traces ni rutas internas al cliente
    console.error('[SECURITY_ERR]', err.message);
    if (err.statusCode === 413) {
      return sendJson(req, res, 413, { success: false, error: 'El archivo o solicitud excede el tamaño máximo permitido.' });
    }
    const isValidation = /DNI|obligatorio|inválido|rango|existe/i.test(err.message || '');
    return sendJson(req, res, isValidation ? 400 : 500, {
      success: false,
      error: isValidation ? err.message : 'Ocurrió un error interno procesando la solicitud.'
    });
  }
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log('  RH BRINNERCAS — SERVIDOR ZERO-TRUST ENDURECIDO');
  console.log(`  Portal Activo: http://localhost:${PORT}`);
  console.log('=======================================================');
});
