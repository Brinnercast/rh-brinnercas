/**
 * PUBLICADOR 1-CLIC: RH BRINNERCAS -> GITHUB -> FIREBASE HOSTING
 * Regenera data-bundle.js y sube SOLO los archivos modificados a GitHub (main),
 * lo cual dispara automáticamente el despliegue gratuito en https://rh-brinnercas.web.app
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const OWNER = 'Brinnercast';
const REPO = 'rh-brinnercas';
const BRANCH = 'main';
const PROJECT_DIR = __dirname;

const GH_BIN = fs.existsSync('C:\\Program Files\\GitHub CLI\\gh.exe')
  ? 'C:\\Program Files\\GitHub CLI\\gh.exe'
  : 'gh';

const IGNORE_DIRS = new Set(['node_modules', '.firebase', '.git', 'output']);
const IGNORE_PATTERNS = [
  /^tmp_.*\.md$/i,
  /^append_.*\.json$/i,
  /^update_.*\.json$/i,
  /^\.session_hmac_secret$/i,
  /^audit_security_log\.jsonl$/i,
  /\.log$/i,
  /^Thumbs\.db$/i,
  /^\.DS_Store$/i
];

function gitBlobSha(buf) {
  const header = Buffer.from(`blob ${buf.length}\0`, 'utf8');
  return crypto.createHash('sha1').update(header).update(buf).digest('hex');
}

function rebuildDataBundle() {
  const { calcularAuditoria } = require('./services/audit_engine');
  const { MOTIVOS_PREDEFINIDOS } = require('./services/memo_engine');
  const mofPath = path.join(PROJECT_DIR, 'data', 'mof_puestos_aurora.json');
  const mof = fs.existsSync(mofPath) ? JSON.parse(fs.readFileSync(mofPath, 'utf8')) : [];
  const audit = calcularAuditoria();
  const bundle = 'window.RH_EMBEDDED_DATA = ' + JSON.stringify({ audit, mof, memoMotivos: MOTIVOS_PREDEFINIDOS }, null, 2) + ';\n';
  fs.writeFileSync(path.join(PROJECT_DIR, 'public', 'data-bundle.js'), bundle, 'utf8');
  console.log(`[1/4] data-bundle.js actualizado (${audit.resumen.totalColaboradores} colaboradores, Condicion Laboral: ${JSON.stringify(audit.resumen.porCondicionLaboral)})`);
}

function collectFiles(dir, base = '') {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      results = results.concat(collectFiles(path.join(dir, entry.name), base ? `${base}/${entry.name}` : entry.name));
    } else {
      if (IGNORE_PATTERNS.some(rx => rx.test(entry.name))) continue;
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      if (stat.size > 25 * 1024 * 1024) continue;
      results.push({
        relPath: base ? `${base}/${entry.name}` : entry.name,
        fullPath
      });
    }
  }
  return results;
}

async function ghApi(token, endpoint, method = 'GET', body = null) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'rh-brinnercas-publisher',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${endpoint} -> ${res.status}: ${json?.message || text.slice(0, 200)}`);
  }
  return json;
}

async function main() {
  console.log('===============================================================');
  console.log('  PUBLICADOR RH BRINNERCAS -> GITHUB -> FIREBASE HOSTING');
  console.log('===============================================================');

  rebuildDataBundle();

  const token = execFileSync(GH_BIN, ['auth', 'token'], { encoding: 'utf8' }).trim();
  if (!token) throw new Error('No se encontró sesión activa en GitHub CLI (gh).');

  console.log('[2/4] Comparando archivos locales con GitHub (main)...');
  const ref = await ghApi(token, `/git/ref/heads/${BRANCH}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghApi(token, `/git/commits/${baseCommitSha}`);
  const baseTreeSha = baseCommit.tree.sha;
  const remoteTree = await ghApi(token, `/git/trees/${baseTreeSha}?recursive=1`);

  const remoteShaByPath = new Map();
  for (const item of (remoteTree.tree || [])) {
    if (item.type === 'blob') remoteShaByPath.set(item.path, item.sha);
  }

  const localFiles = collectFiles(PROJECT_DIR);
  const changed = [];
  for (const f of localFiles) {
    const buf = fs.readFileSync(f.fullPath);
    const localSha = gitBlobSha(buf);
    if (remoteShaByPath.get(f.relPath) !== localSha) {
      changed.push({ ...f, buf });
    }
  }

  if (changed.length === 0) {
    console.log('[OK] No hay cambios nuevos pendientes. GitHub y Firebase ya están al día.');
    console.log('     Web en vivo: https://rh-brinnercas.web.app');
    return;
  }

  console.log(`[3/4] Subiendo ${changed.length} archivo(s) nuevo(s)/modificado(s) a GitHub...`);
  const treeEntries = [];
  for (const f of changed) {
    const blob = await ghApi(token, '/git/blobs', 'POST', {
      content: f.buf.toString('base64'),
      encoding: 'base64'
    });
    treeEntries.push({
      path: f.relPath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
    console.log(`      + ${f.relPath}`);
  }

  const newTree = await ghApi(token, '/git/trees', 'POST', {
    base_tree: baseTreeSha,
    tree: treeEntries
  });

  const customMsg = process.argv.slice(2).join(' ').trim();
  const stamp = new Date().toLocaleString('es-PE');
  const commitMsg = customMsg || `sync: actualizacion RH BRINNERCAS (${stamp})`;

  const newCommit = await ghApi(token, '/git/commits', 'POST', {
    message: commitMsg,
    tree: newTree.sha,
    parents: [baseCommitSha]
  });

  await ghApi(token, `/git/refs/heads/${BRANCH}`, 'PATCH', {
    sha: newCommit.sha,
    force: false
  });

  console.log(`[4/4] Commit publicado: ${newCommit.sha.slice(0, 7)} ("${commitMsg}")`);
  console.log('');
  console.log('===============================================================');
  console.log('  LISTO! GitHub Actions actualizara Firebase en ~30 segundos:');
  console.log(`  GitHub:   https://github.com/${OWNER}/${REPO}`);
  console.log(`  Actions:  https://github.com/${OWNER}/${REPO}/actions`);
  console.log('  Web Viva: https://rh-brinnercas.web.app');
  console.log('===============================================================');
}

main().catch(err => {
  console.error('\n[ERROR] No se pudo publicar:', err.message);
  process.exit(1);
});

