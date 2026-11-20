/**
 * MOTOR DE AUDITORÍA LABORAL Y NÓMINA - RH BRINNERCAS
 * GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const jsonPath = path.join(dataDir, 'padron_personal_aurora_2026.json');
const manifestPath = path.join(dataDir, 'drive_manifest.json');

function cargarPadron() {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function guardarPadron(padron) {
  fs.writeFileSync(jsonPath, JSON.stringify(padron, null, 2), 'utf8');
}

function cargarManifest() {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function parseFecha(str) {
  if (!str) return null;
  const parts = String(str).trim().split('/');
  if (parts.length === 3) {
    return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
  }
  return null;
}

function calcularAuditoria() {
  const padron = cargarPadron();
  const manifest = cargarManifest();
  const hoy = new Date();

  const activos = padron.colaboradores.filter(c => c.estado === 'ACTIVO');
  const cesados = padron.colaboradores.filter(c => c.estado === 'CESADO');
  const rxhApoyo = padron.colaboradores.filter(c => c.estado === 'RXH' || c.estado === 'APOYO');

  const inferCondicionLaboral = c => {
    const raw = String(c.condicionLaboral || '').toUpperCase().trim();
    if (raw === 'CONTRATO' || raw === 'RXH' || raw === 'OTROS') return raw;
    if (c.estado === 'RXH' || String(c.condicionLaborable || '').toUpperCase().includes('RXH')) return 'RXH';
    if (c.estado === 'APOYO') return 'OTROS';
    return 'CONTRATO';
  };

  const porCondicionLaboral = { CONTRATO: 0, RXH: 0, OTROS: 0 };
  padron.colaboradores.forEach(c => {
    const cl = inferCondicionLaboral(c);
    porCondicionLaboral[cl] = (porCondicionLaboral[cl] || 0) + 1;
  });

  const totalNominaActiva = activos.reduce((sum, c) => sum + (Number(c.remuneracionActual) || 0), 0);
  const masaInicialFeb = 40880;
  const ahorroMensual = Math.max(0, masaInicialFeb - totalNominaActiva);

  const porArea = {};
  activos.forEach(c => {
    const area = c.area || 'General';
    if (!porArea[area]) porArea[area] = { count: 0, total: 0, colaboradores: [] };
    porArea[area].count += 1;
    porArea[area].total += Number(c.remuneracionActual) || 0;
    porArea[area].colaboradores.push(c.nombre);
  });

  const colaboradoresAuditados = padron.colaboradores.map(c => {
    let semaforo = 'gris';
    let estadoTexto = c.estado;

    if (c.estado === 'ACTIVO') {
      const fVig = parseFecha(c.vigenciaActualHasta);
      if (fVig && fVig < hoy) {
        semaforo = 'naranja';
        estadoTexto = 'Renovación Pendiente';
      } else {
        semaforo = 'verde';
        estadoTexto = 'Contrato Vigente';
      }
    } else if (c.estado === 'RXH') {
      semaforo = 'verde';
      estadoTexto = 'Fijo RxH Activo';
    } else if (c.estado === 'APOYO') {
      semaforo = 'amarillo';
      estadoTexto = 'Apoyo / Por Regularizar';
    } else if (c.estado === 'CESADO') {
      semaforo = 'gris';
      estadoTexto = `Cesado (${c.fechaCese || 'Concluido'})`;
    }

    const docs = c.documentos || {};
    const dniFileName = docs.fotoDni?.fileName || '';
    const isDniImg = /\.(jpg|jpeg|png|webp)$/i.test(dniFileName);

    return {
      id: c.id,
      nombre: c.nombre,
      dni: c.dni,
      area: c.area || 'General',
      cargo: c.cargoActual || c.cargoContrato || 'Colaborador',
      cargoContrato: c.cargoContrato || c.cargoActual || '',
      condicionLaborable: c.condicionLaborable || 'FULL TIME',
      condicionLaboral: inferCondicionLaboral(c),
      sueldo: Number(c.remuneracionActual || c.ultimaRemuneracion || 0),
      estado: c.estado,
      estadoTexto,
      semaforo,
      fechaIngreso: c.contratoBase?.inicio || 'N/A',
      finContratoBase: c.contratoBase?.fin || 'N/A',
      vigenciaHasta: c.estado === 'CESADO' ? (c.fechaCese || 'Cesado') : (c.vigenciaActualHasta || c.contratoBase?.fin || 'Vigente'),
      fechaCese: c.fechaCese || null,
      modalidadCese: c.modalidadCese || null,
      tiempoServicio: c.tiempoServicio || null,
      domicilio: c.domicilio || 'No registrado',
      celular: c.celular || 'No registrado',
      correo: c.correo || 'No registrado',
      banco: c.banco || 'No registrado',
      numeroCuenta: c.numeroCuenta || 'No registrado',
      fechaNacimiento: c.fechaNacimiento || 'No registrado',
      edad: c.edad || 'N/A',
      carnetSanitario: c.carnetSanitario || 'NO',
      adendas: c.adendas || [],
      proximaAdenda: c.proximaAdenda || (c.estado === 'ACTIVO' ? 'Nueva Prórroga 3 Meses' : 'N/A'),
      observaciones: c.observaciones || c.obs || (c.estado === 'ACTIVO' ? 'Colaborador activo con expediente auditado.' : 'Vínculo laboral concluido.'),
      documentos: {
        contrato: docs.contrato || null,
        adendas: Array.isArray(docs.adendas) ? docs.adendas : [],
        memorandums: Array.isArray(docs.memorandums) ? docs.memorandums : [],
        liquidacion: docs.liquidacion || null,
        fotoDni: docs.fotoDni ? { ...docs.fotoDni, isImage: isDniImg } : null
      }
    };
  });

  return {
    empresa: padron.empresa,
    rutas: padron.rutas,
    manifest,
    resumen: {
      totalColaboradores: padron.colaboradores.length,
      activosCount: activos.length,
      cesadosCount: cesados.length,
      rxhApoyoCount: rxhApoyo.length,
      totalNominaActiva,
      masaInicialFeb,
      ahorroMensual,
      porcentajeOptimizacion: Number(((ahorroMensual / masaInicialFeb) * 100).toFixed(1)),
      porArea,
      porCondicionLaboral
    },
    colaboradores: colaboradoresAuditados
  };
}

module.exports = {
  calcularAuditoria,
  cargarPadron,
  guardarPadron,
  cargarManifest
};
