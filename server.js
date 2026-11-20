/**
 * SERVIDOR AUTÓNOMO FULL-STACK — RH BRINNERCAS
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

const PORT = process.env.PORT || 3005;
const PUBLIC_DIR = path.join(__dirname, 'public');
const OUTPUT_DIR = path.join(__dirname, 'output');
const DATA_DIR = path.join(__dirname, 'data');

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

// Usuarios autorizados (Administración y Gerencia Aurora)
const AUTH_USERS = [
  { email: 'brinnercas', pass: '1234', pin: '1234', name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General' },
  { email: 'admr.brinnercas@gmail.com', pass: '1234', pin: '1234', name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General' },
  { email: 'admr.brinnercas@gmail.com', pass: 'Aurora2026!', pin: '1234', name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General' },
  { email: 'brinnercas@gmail.com', pass: '1234', pin: '1234', name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General' },
  { email: 'brinnercas@gmail.com', pass: 'Aurora2026!', pin: '1234', name: 'Wilmer Brinner Castro Vásquez', role: 'Administrador General' },
  { email: 'gerencia@aurora.pe', pass: '1234', pin: '1234', name: 'Gladys Verónica Carbajal Urquizo', role: 'Gerente General' },
  { email: 'gerencia@aurora.pe', pass: 'Aurora2026!', pin: '1234', name: 'Gladys Verónica Carbajal Urquizo', role: 'Gerente General' }
];

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
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

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function sendFileDownload(res, filePath, customName, forceDownload = true) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Archivo no encontrado');
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);
  const name = customName || path.basename(filePath);
  const headers = {
    'Content-Type': contentType,
    'Content-Length': stat.size
  };
  if (forceDownload) {
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
  } else {
    headers['Content-Disposition'] = `inline; filename*=UTF-8''${encodeURIComponent(name)}`;
  }
  res.writeHead(200, headers);
  return fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  try {
    // 1. Login Control
    if (req.method === 'POST' && pathname === '/api/auth/login') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const pin = String(body.pin || '').trim();

      let user = null;
      if (pin) {
        if (pin === '1234' || pin === '2026') {
          user = AUTH_USERS[0];
        }
      } else if (email && password) {
        user = AUTH_USERS.find(u => u.email === email && u.pass === password);
      }

      if (!user) {
        return sendJson(res, 401, { success: false, error: 'Credenciales o PIN incorrectos. Verifica tus datos.' });
      }
      return sendJson(res, 200, {
        success: true,
        user: { name: user.name, role: user.role, email: user.email },
        token: Buffer.from(`${user.email}:${Date.now()}`).toString('base64')
      });
    }

    // 2. Auditoría y Padrón Completo
    if (req.method === 'GET' && pathname === '/api/audit') {
      return sendJson(res, 200, calcularAuditoria());
    }

    // 3. MOF de Puestos
    if (req.method === 'GET' && pathname === '/api/mof') {
      const mofPath = path.join(DATA_DIR, 'mof_puestos_aurora.json');
      const mof = JSON.parse(fs.readFileSync(mofPath, 'utf8'));
      return sendJson(res, 200, mof);
    }

    // 4. Motivos predefinidos Memorándum
    if (req.method === 'GET' && pathname === '/api/memo-motivos') {
      return sendJson(res, 200, MOTIVOS_PREDEFINIDOS);
    }

    // 5. Chat Asistente Gemini IA
    if (req.method === 'POST' && pathname === '/api/chat') {
      const body = await parseBody(req);
      const reply = await responderConsulta(body.message || '', {
        apiKey: body.apiKey || '',
        previousInteractionId: body.previousInteractionId || undefined
      });
      return sendJson(res, 200, { reply, model: 'gemini-4-hydrogen' });
    }

    // 5B. Registro y Despacho de Correo Corporativo (con soporte Gmail CLI admr.brinnercas@gmail.com)
    if (req.method === 'POST' && pathname === '/api/email/send') {
      const body = await parseBody(req);
      const histPath = path.join(DATA_DIR, 'historial_correos.json');
      let hist = [];
      if (fs.existsSync(histPath)) {
        try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch (e) { hist = []; }
      }

      const to = String(body.to || '').trim();
      const cc = String(body.cc || '').trim();
      const subject = String(body.subject || 'Documentación Laboral — Grupo Gastronómico Aurora S.A.C.').trim();
      const mailBody = String(body.body || '').trim();
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
          gmailOutput = execFileSync('gmail', args, { encoding: 'utf8', timeout: 15000 }).trim();
          estadoEnvio = 'ENVIADO POR GMAIL API (admr.brinnercas@gmail.com)';
        } catch (cliErr) {
          try {
            const safeSubj = subject.replace(/"/g, "'").replace(/%/g, '%%');
            const draftArgs = ['mutate', 'create-draft', '--to', to, '--subject', safeSubj, '--body-file', tmpBodyPath];
            gmailOutput = execFileSync('gmail', draftArgs, { encoding: 'utf8', timeout: 15000 }).trim();
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
        tipo: String(body.tipo || 'DOCUMENTO').trim(),
        colaborador: String(body.colaboradorNombre || 'General').trim(),
        asunto: subject,
        cuerpo: mailBody,
        adjuntosDrive: Array.isArray(body.driveLinks) ? body.driveLinks : [],
        estado: estadoEnvio,
        gmailOutput
      };
      hist.unshift(entry);
      fs.writeFileSync(histPath, JSON.stringify(hist.slice(0, 100), null, 2), 'utf8');
      return sendJson(res, 200, { success: true, entry, historial: hist.slice(0, 25) });
    }

    if (req.method === 'GET' && pathname === '/api/email/history') {
      const histPath = path.join(DATA_DIR, 'historial_correos.json');
      let hist = [];
      if (fs.existsSync(histPath)) {
        try { hist = JSON.parse(fs.readFileSync(histPath, 'utf8')); } catch (e) { hist = []; }
      }
      return sendJson(res, 200, { success: true, historial: hist });
    }

    // 6. Alta de Nuevo Personal -> Padrón JSON + Drive + Google Sheets
    if (req.method === 'POST' && pathname === '/api/personal/nuevo') {
      const body = await parseBody(req);
      const result = await registrarNuevoIngreso(body);
      return sendJson(res, 200, { success: true, ...result });
    }

    // 6B. Edición de Personal Existente en Planilla -> Padrón JSON + Google Sheets (Maestro + Histórico)
    if ((req.method === 'POST' && pathname === '/api/personal/actualizar') || (req.method === 'PUT' && pathname.startsWith('/api/personal/'))) {
      const body = await parseBody(req);
      const idFromUrl = pathname.startsWith('/api/personal/') && pathname !== '/api/personal/actualizar'
        ? pathname.replace('/api/personal/', '')
        : body.id;
      const result = await actualizarPersonalExistente(idFromUrl, body);
      return sendJson(res, 200, { success: true, ...result });
    }

    // 7. Descargas unificadas de los 5 documentos por colaborador: /api/docs/:tipo/:id
    if (req.method === 'GET' && pathname.startsWith('/api/docs/')) {
      const parts = pathname.replace('/api/docs/', '').split('/');
      const tipo = parts[0];
      const id = parseInt(parts[1], 10);
      const padron = cargarPadron();
      const colab = padron.colaboradores.find(c => c.id === id);
      if (!colab) return sendJson(res, 404, { error: `Colaborador ${id} no encontrado` });

      const inlineMode = parsedUrl.query.inline === '1';

      if (tipo === 'dni') {
        if (colab.documentos?.fotoDni?.fileName) {
          const fp = path.join(PUBLIC_DIR, 'docs', 'dni', colab.documentos.fotoDni.fileName);
          if (fs.existsSync(fp)) return sendFileDownload(res, fp, colab.documentos.fotoDni.originalName || colab.documentos.fotoDni.fileName, !inlineMode);
        }
        return sendJson(res, 404, { error: 'Foto de DNI no encontrada localmente.' });
      }

      if (tipo === 'contrato') {
        if (colab.documentos?.contrato?.fileName && parsedUrl.query.format !== 'html') {
          const fp = path.join(PUBLIC_DIR, 'docs', 'contratos', colab.documentos.contrato.fileName);
          if (fs.existsSync(fp)) return sendFileDownload(res, fp, colab.documentos.contrato.fileName, !inlineMode);
        }
        if (inlineMode || parsedUrl.query.format === 'html') {
          const html = generarHtmlContrato(colab);
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          return res.end(html);
        }
        // Si no existe PDF físico, generamos contrato inicial .docx al vuelo (Anexo N° 001 + 18 cláusulas)
        const gen = await generarContratoBuffer(colab);
        res.writeHead(200, {
          'Content-Type': MIME_TYPES['.docx'],
          'Content-Length': gen.buffer.length,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(gen.fileName)}`
        });
        return res.end(gen.buffer);
      }

      if (tipo === 'adenda') {
        const index = parsedUrl.query.index !== undefined ? parseInt(parsedUrl.query.index, 10) : null;
        if (index !== null && colab.documentos?.adendas?.[index]) {
          const fname = colab.documentos.adendas[index].fileName;
          const fp = path.join(PUBLIC_DIR, 'docs', 'adendas', fname);
          if (fs.existsSync(fp)) return sendFileDownload(res, fp, fname, !inlineMode);
        }
        // Si se pide adenda rápida sin índice o nueva
        const gen = await generarAdendaPorId(id, {});
        res.writeHead(200, {
          'Content-Type': MIME_TYPES['.docx'],
          'Content-Length': gen.buffer.length,
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(gen.fileName)}`
        });
        return res.end(gen.buffer);
      }

      if (tipo === 'memo' || tipo === 'memorandum') {
        const index = parsedUrl.query.index !== undefined ? parseInt(parsedUrl.query.index, 10) : 0;
        if (colab.documentos?.memorandums?.[index]) {
          const fname = colab.documentos.memorandums[index].name || colab.documentos.memorandums[index].fileName;
          const fp = path.join(PUBLIC_DIR, 'docs', 'memos', fname);
          if (fs.existsSync(fp)) return sendFileDownload(res, fp, fname, !inlineMode);
        }
        // Emitir memorándum informativo / constancia al vuelo
        const memo = generarMemorandum({
          colaboradorId: id,
          motivoClave: parsedUrl.query.motivo || 'comunicado_general'
        });
        const fname = `MEMORANDUM_${colab.dni}_${colab.nombre.split(' ')[0]}.html`;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': inlineMode ? 'inline' : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        });
        return res.end(memo.html);
      }

      if (tipo === 'liquidacion') {
        if (colab.documentos?.liquidacion?.fileName) {
          const fp = path.join(PUBLIC_DIR, 'docs', 'liquidaciones', colab.documentos.liquidacion.fileName);
          if (fs.existsSync(fp)) return sendFileDownload(res, fp, colab.documentos.liquidacion.fileName, !inlineMode);
        }
        // Calcular y generar Hoja de Liquidación BBSS al vuelo
        const html = generarHtmlLiquidacion(colab, { regimen: parsedUrl.query.regimen || 'GENERAL' });
        const fname = `LIQUIDACION_BBSS_${colab.dni}_${colab.nombre.split(' ')[0]}.html`;
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': inlineMode ? 'inline' : `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`
        });
        return res.end(html);
      }
    }

    // 8. Cálculo JSON de Liquidación BBSS (para modal interactivo / vista previa)
    if (req.method === 'GET' && pathname.startsWith('/api/liquidacion/calc/')) {
      const id = parseInt(pathname.split('/').pop(), 10);
      const padron = cargarPadron();
      const colab = padron.colaboradores.find(c => c.id === id);
      if (!colab) return sendJson(res, 404, { error: 'Colaborador no encontrado' });
      const calc = calcularLiquidacion(colab, {
        regimen: parsedUrl.query.regimen || 'GENERAL',
        fechaCese: parsedUrl.query.fechaCese || undefined
      });
      const html = generarHtmlLiquidacion(colab, {
        regimen: parsedUrl.query.regimen || 'GENERAL',
        fechaCese: parsedUrl.query.fechaCese || undefined
      });
      return sendJson(res, 200, { success: true, calculo: calc, html });
    }

    // 9. Generar Adenda individual o lote
    if (req.method === 'POST' && pathname.startsWith('/api/adenda/generate/')) {
      const id = pathname.split('/').pop();
      const body = await parseBody(req);
      const resultado = await generarAdendaPorId(id, body);
      const outPath = path.join(OUTPUT_DIR, 'adendas', resultado.fileName);
      fs.writeFileSync(outPath, resultado.buffer);
      return sendJson(res, 200, {
        success: true,
        colaborador: resultado.colaborador,
        dni: resultado.dni,
        fileName: resultado.fileName,
        downloadUrl: `/api/download-output/adendas/${encodeURIComponent(resultado.fileName)}`
      });
    }

    if (req.method === 'POST' && pathname === '/api/adenda/generate-all') {
      const body = await parseBody(req);
      const resultado = await generarTodasAdendasActivas(body);
      return sendJson(res, 200, { success: true, ...resultado });
    }

    // 10. Generar Memorándum & Actas (Vista Previa y Guardado)
    if (req.method === 'POST' && pathname === '/api/memo/generate') {
      const body = await parseBody(req);
      const resultado = generarMemorandum(body);
      const fileName = `MEMORANDUM_${resultado.dni}_${Date.now()}.html`;
      fs.writeFileSync(path.join(OUTPUT_DIR, 'memos', fileName), resultado.html, 'utf8');
      return sendJson(res, 200, { success: true, fileName, downloadUrl: `/api/download-output/memos/${encodeURIComponent(fileName)}`, ...resultado });
    }

    if (req.method === 'POST' && pathname === '/api/acta/generate') {
      const body = await parseBody(req);
      const resultado = generarActaEntrega(body);
      const fileName = `ACTA_${resultado.dni}_${Date.now()}.html`;
      fs.writeFileSync(path.join(OUTPUT_DIR, 'memos', fileName), resultado.html, 'utf8');
      return sendJson(res, 200, { success: true, fileName, downloadUrl: `/api/download-output/memos/${encodeURIComponent(fileName)}`, ...resultado });
    }

    // 11. Descargas desde output/
    if (req.method === 'GET' && pathname.startsWith('/api/download-output/')) {
      const rel = decodeURIComponent(pathname.replace('/api/download-output/', ''));
      const safeRel = path.normalize(rel).replace(/^(\.\.[\/\\])+/, '');
      return sendFileDownload(res, path.join(OUTPUT_DIR, safeRel), path.basename(safeRel), true);
    }

    // 12. Descarga directa del Excel Contable Oficial
    if (req.method === 'GET' && pathname === '/api/excel/resumen') {
      const excelPath = 'C:\\Users\\brinn\\OneDrive\\AURORA 2025 - 2026\\RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx';
      return sendFileDownload(res, excelPath, 'RESUMEN_PERSONAL_Y_ADENDAS_AURORA_2026.xlsx', true);
    }

    // 13. Servir archivos estáticos desde public/
    const decodedPath = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
    const safeStatic = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(PUBLIC_DIR, safeStatic);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const headers = { 'Content-Type': contentType };
      if (parsedUrl.query.download === '1') {
        headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.basename(filePath))}`;
      }
      res.writeHead(200, headers);
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback a index.html
    const indexPath = path.join(PUBLIC_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return fs.createReadStream(indexPath).pipe(res);

  } catch (err) {
    console.error('Error en servidor RH BRINNERCAS:', err);
    sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log('  RH BRINNERCAS — PLATAFORMA GLASSMORPHISM DE RRHH');
  console.log(`  Portal Activo: http://localhost:${PORT}`);
  console.log('=======================================================');
});
