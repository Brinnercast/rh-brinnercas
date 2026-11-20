/**
 * MOTOR DE LIQUIDACIÓN DE BENEFICIOS SOCIALES (D.LEG. 728 / LEY CTS / LEY 27735)
 * GRUPO GASTRONÓMICO AURORA S.A.C.
 */

const fs = require('fs');
const path = require('path');

function parseFechaDDMMYYYY(str) {
  if (!str) return null;
  const clean = String(str).trim().split(' ')[0];
  const parts = clean.split('/');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  const y = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

/**
 * Calcula meses y días computables aproximados según criterio comercial laboral (30 días/mes)
 */
function calcularTiempoComputable(inicioStr, finStr) {
  const f1 = parseFechaDDMMYYYY(inicioStr);
  const f2 = parseFechaDDMMYYYY(finStr);
  if (!f1 || !f2 || f2 < f1) {
    return { meses: 3, dias: 0, totalDias: 90, texto: '3 meses, 0 días' };
  }

  let years = f2.getFullYear() - f1.getFullYear();
  let months = f2.getMonth() - f1.getMonth();
  let days = f2.getDate() - f1.getDate() + 1;

  if (days >= 30) {
    months += Math.floor(days / 30);
    days = days % 30;
  } else if (days < 0) {
    months -= 1;
    days += 30;
  }

  const totalMeses = years * 12 + months;
  const totalDias = totalMeses * 30 + days;
  return {
    meses: totalMeses,
    dias: days,
    totalDias,
    texto: `${totalMeses} mes(es), ${days} día(s)`
  };
}

function calcularLiquidacion(colab, opciones = {}) {
  const fechaInicio = opciones.fechaInicio || colab.contratoBase?.inicio || '01/02/2026';
  const fechaCese = opciones.fechaCese || colab.fechaCese || colab.vigenciaActualHasta || '31/10/2026';
  const remuneracion = parseFloat(opciones.remuneracion || colab.ultimaRemuneracion || colab.remuneracionActual || 1500);
  const regimen = opciones.regimen || 'GENERAL'; // GENERAL o MYPE_PEQUENA
  const factor = regimen === 'MYPE_PEQUENA' ? 0.5 : 1.0;

  const tiempo = calcularTiempoComputable(fechaInicio, fechaCese);
  const mesDecimal = tiempo.totalDias / 30;

  // 1. Compensación por Tiempo de Servicios (CTS Trunca): (Rem / 12) * meses
  // Nota: Si trabajó < 1 mes no hay CTS, aquí todos tienen >= 3 meses
  const ctsBase = (remuneracion / 12) * mesDecimal * factor;

  // 2. Vacaciones Truncas: (Rem / 12) * meses
  const vacBase = (remuneracion / 12) * mesDecimal * (regimen === 'MYPE_PEQUENA' ? 0.5 : 1.0);
  const descuentoOnpVac = vacBase * 0.13; // Referencial ONP 13%
  const vacNeto = vacBase - descuentoOnpVac;

  // 3. Gratificación Trunca (según semestre calendario: Jul-Dic o Ene-Jun)
  const fCese = parseFechaDDMMYYYY(fechaCese) || new Date(2026, 9, 31);
  const semMesesCompletos = Math.min(tiempo.meses, ((fCese.getMonth() % 6) + 1));
  const gratiBase = (remuneracion / 6) * semMesesCompletos * factor;
  const bonifExtra9 = gratiBase * 0.09; // Bonificación Extraordinaria Ley 30334 (9% EsSalud)

  const totalBruto = ctsBase + vacBase + gratiBase + bonifExtra9;
  const totalDescuentos = descuentoOnpVac;
  const totalNeto = totalBruto - totalDescuentos;

  return {
    colaborador: colab.nombre,
    dni: colab.dni,
    cargo: colab.cargoActual || colab.cargoContrato,
    area: colab.area,
    domicilio: colab.domicilio || 'Trujillo, La Libertad',
    fechaIngreso: fechaInicio,
    fechaCese,
    tiempoTexto: tiempo.texto,
    remuneracionComputable: remuneracion,
    regimen,
    conceptos: {
      ctsTrunca: Number(ctsBase.toFixed(2)),
      vacacionesTruncasBruto: Number(vacBase.toFixed(2)),
      descuentoPension13: Number(descuentoOnpVac.toFixed(2)),
      vacacionesTruncasNeto: Number(vacNeto.toFixed(2)),
      gratificacionTrunca: Number(gratiBase.toFixed(2)),
      bonifExtraordinaria9: Number(bonifExtra9.toFixed(2)),
      mesesSemestreGrati: semMesesCompletos
    },
    totalBruto: Number(totalBruto.toFixed(2)),
    totalDescuentos: Number(totalDescuentos.toFixed(2)),
    totalNeto: Number(totalNeto.toFixed(2))
  };
}

function generarHtmlLiquidacion(colab, opciones = {}) {
  const calc = calcularLiquidacion(colab, opciones);
  const fmt = (n) => `S/ ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Liquidación BBSS - ${calc.colaborador}</title>
<style>
  body { font-family: 'Aptos', 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 36px; line-height: 1.5; }
  .sheet { max-width: 780px; margin: 0 auto; border: 1.5px solid #1E291F; padding: 36px; background: #fff; }
  .head { text-align: center; border-bottom: 2px solid #C5A059; padding-bottom: 14px; margin-bottom: 22px; }
  .brand { font-size: 20pt; font-weight: 700; color: #121913; letter-spacing: 2px; }
  .ruc { font-size: 9pt; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  .doc-title { margin-top: 12px; font-size: 13pt; font-weight: 700; color: #1E291F; text-transform: uppercase; }
  .grid-meta { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt; }
  .grid-meta td { padding: 6px 10px; border: 1px solid #d9d4c7; }
  .lbl { font-weight: 700; background: #f7f4ec; width: 22%; color: #1E291F; }
  .calc-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10.5pt; }
  .calc-table th { background: #1E291F; color: #F0EADF; text-align: left; padding: 9px 10px; font-size: 10pt; }
  .calc-table td { padding: 8px 10px; border-bottom: 1px solid #e5e0d5; }
  .amt { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .total-row td { background: #f2ece0; font-weight: 700; font-size: 11.5pt; border-top: 2px solid #1E291F; border-bottom: 2px solid #1E291F; }
  .legal-note { margin-top: 22px; font-size: 9.5pt; text-align: justify; color: #444; background: #faf8f4; padding: 12px; border-left: 3px solid #C5A059; }
  .sigs { margin-top: 64px; display: flex; justify-content: space-between; text-align: center; font-size: 9.5pt; }
  .sig { width: 42%; border-top: 1px solid #222; padding-top: 8px; }
  @media print { body { margin: 0; } .sheet { border: none; } }
</style>
</head>
<body>
<div class="sheet">
  <div class="head">
    <div class="brand">AURORA RESTAURANT</div>
    <div class="ruc">GRUPO GASTRONÓMICO AURORA S.A.C. • RUC N.º 20615117111</div>
    <div class="doc-title">HOJA DE LIQUIDACIÓN DE BENEFICIOS SOCIALES (D.LEG. 728)</div>
  </div>

  <table class="grid-meta">
    <tr><td class="lbl">TRABAJADOR</td><td><strong>${calc.colaborador}</strong></td><td class="lbl">DNI N.º</td><td>${calc.dni}</td></tr>
    <tr><td class="lbl">CARGO / ÁREA</td><td>${calc.cargo} (${calc.area})</td><td class="lbl">REMUN. COMPUTABLE</td><td><strong>${fmt(calc.remuneracionComputable)}</strong></td></tr>
    <tr><td class="lbl">FECHA INGRESO</td><td>${calc.fechaIngreso}</td><td class="lbl">FECHA DE CESE</td><td><strong>${calc.fechaCese}</strong></td></tr>
    <tr><td class="lbl">TIEMPO COMPUTABLE</td><td>${calc.tiempoTexto}</td><td class="lbl">RÉGIMEN</td><td>${calc.regimen === 'MYPE_PEQUENA' ? 'Pequeña Empresa (50%)' : 'Régimen General D.Leg. 728'}</td></tr>
    <tr><td class="lbl">DOMICILIO</td><td colspan="3">${calc.domicilio}</td></tr>
  </table>

  <table class="calc-table">
    <thead>
      <tr><th>Concepto Legal de Liquidación</th><th>Base de Cálculo / Período</th><th style="text-align:right">Importe</th></tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>1. Compensación por Tiempo de Servicios (CTS Trunca)</strong><br><small>D.S. N.º 001-97-TR</small></td>
        <td>${calc.tiempoTexto} sobre ${fmt(calc.remuneracionComputable)}</td>
        <td class="amt">${fmt(calc.conceptos.ctsTrunca)}</td>
      </tr>
      <tr>
        <td><strong>2. Vacaciones Truncas</strong><br><small>D.Leg. N.º 713</small></td>
        <td>${calc.tiempoTexto} (bruto antes de aporte pensionario)</td>
        <td class="amt">${fmt(calc.conceptos.vacacionesTruncasBruto)}</td>
      </tr>
      <tr>
        <td><strong>3. Gratificación Trunca Proporcional</strong><br><small>Ley N.º 27735</small></td>
        <td>${calc.conceptos.mesesSemestreGrati} mes(es) completos del semestre</td>
        <td class="amt">${fmt(calc.conceptos.gratificacionTrunca)}</td>
      </tr>
      <tr>
        <td><strong>4. Bonificación Extraordinaria 9% (EsSalud)</strong><br><small>Ley N.º 30334</small></td>
        <td>9% sobre Gratificación Trunca</td>
        <td class="amt">${fmt(calc.conceptos.bonifExtraordinaria9)}</td>
      </tr>
      <tr>
        <td><strong>(-) Descuento Previsional Referencial (13% ONP)</strong><br><small>Aplicado sobre Vacaciones Truncas</small></td>
        <td>Retención de ley</td>
        <td class="amt" style="color:#b71c1c;">- ${fmt(calc.conceptos.descuentoPension13)}</td>
      </tr>
      <tr class="total-row">
        <td colspan="2">NETO TOTAL A PAGAR AL TRABAJADOR</td>
        <td class="amt">${fmt(calc.totalNeto)}</td>
      </tr>
    </tbody>
  </table>

  <div class="legal-note">
    <strong>CONSTANCIA DE RECEPCIÓN Y CANCELACIÓN:</strong> El trabajador declara haber recibido de <strong>GRUPO GASTRONÓMICO AURORA S.A.C.</strong> el detalle íntegro de sus beneficios sociales devengados hasta la fecha de cese (${calc.fechaCese}), extendiendo su conformidad administrativa de acuerdo con las leyes laborales vigentes en el Perú.
  </div>

  <div class="sigs">
    <div class="sig">
      <strong>GRUPO GASTRONÓMICO AURORA S.A.C.</strong><br>
      CARBAJAL URQUIZO GLADYS VERÓNICA<br>
      Gerente General • DNI 42892738
    </div>
    <div class="sig">
      <strong>${calc.colaborador}</strong><br>
      DNI N.º ${calc.dni}<br>
      <em>Recibí Conforme</em>
    </div>
  </div>
</div>
</body>
</html>`;
}

module.exports = {
  calcularLiquidacion,
  generarHtmlLiquidacion
};
