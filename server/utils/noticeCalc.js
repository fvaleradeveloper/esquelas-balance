// ============================================
// Esquelas-Balance - Motor de cálculo de avisos de cobranza
// Módulo independiente: datos + reglas de cálculo, sin presentación.
// Reglas (especificación 10):
//  - Diferencia = lectura actual - lectura anterior.
//  - El consumo de agua se calcula con la tarifa configurada para el periodo.
//  - Saldo deuda anterior = deuda - pagos aplicados.
//  - Total agua = conceptos de agua + saldos incluidos.
//  - Deuda de mantenimiento se calcula independientemente.
//  - Pagos de medidor/bomba solo descuentan sus propios conceptos.
//  - Si hay discrepancia fórmula-vs-referencia, se REGISTRA, no se altera.
// ============================================

function toNum(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Tarifa configurable por periodo: cargo fijo, m3 incluidos y tarifa por m3 adicional.
// Valores por defecto: los de la nota del documento de ejemplo.
function defaultTariff() {
  return { fixedCharge: 10.50, includedM3: 3, ratePerM3: 6.50 };
}

// Extrae la tarifa de los datos de entrada (tariff fijo/incluidos/tasa opcionales).
function tariffFrom(input) {
  return {
    fixedCharge: input.tariffFixed !== undefined && input.tariffFixed !== null && input.tariffFixed !== ''
      ? toNum(input.tariffFixed) : defaultTariff().fixedCharge,
    includedM3: input.tariffIncludedM3 !== undefined && input.tariffIncludedM3 !== null && input.tariffIncludedM3 !== ''
      ? toNum(input.tariffIncludedM3) : defaultTariff().includedM3,
    ratePerM3: input.tariffRate !== undefined && input.tariffRate !== null && input.tariffRate !== ''
      ? toNum(input.tariffRate) : defaultTariff().ratePerM3,
  };
}

function computeWaterConsumption(diffM3, tariff = defaultTariff()) {
  const m3 = Math.max(0, diffM3);
  const extra = Math.max(0, m3 - tariff.includedM3);
  return round2(tariff.fixedCharge + extra * tariff.ratePerM3);
}

// Entrada: objeto con lecturas, pagos, referencias opcionales y tarifa.
// Salida: { computed, discrepancies[], tariff }
function computeNotice(input, tariffOverride) {
  const discrepancies = [];
  const tariff = tariffOverride || tariffFrom(input || {});

  const current = toNum(input.currentReading);
  const previous = toNum(input.previousReading);
  const diff = round2(current - previous);
  if (diff < 0) {
    discrepancies.push({
      field: 'reading_diff_m3',
      reason: 'La lectura actual es menor que la anterior',
      current, previous,
    });
  }

  const consumption = computeWaterConsumption(diff, tariff);
  const singlePayment = round2(toNum(input.singlePayment));
  const monthDebt = round2(consumption - singlePayment);

  const prevDebt = round2(toNum(input.prevDebt));
  const prevPay1 = round2(toNum(input.prevPayment1));
  const prevPay2 = round2(toNum(input.prevPayment2));
  const prevBalance = round2(prevDebt - prevPay1 - prevPay2);

  const meterCharge = round2(toNum(input.meterCharge));
  const meterPayment = round2(toNum(input.meterPayment));
  const meterBalance = round2(meterCharge - meterPayment);

  const pumpCharge = round2(toNum(input.pumpCharge));
  const pumpPayment = round2(toNum(input.pumpPayment));
  const pumpBalance = round2(pumpCharge - pumpPayment);

  const waterTotal = round2(monthDebt);
  const totalWaterDebt = round2(waterTotal + prevBalance + meterBalance);
  const maintDebt = round2(toNum(input.maintDebtNextMonth));

  // Validación contra referencias transcritas (valores del documento).
  // Solo registra discrepancias; nunca modifica los datos.
  const refs = input.references || {};
  const checks = [
    ['reading_diff_m3', diff, refs.readingDiffM3],
    ['water_consumption', consumption, refs.waterConsumption],
    ['month_debt', monthDebt, refs.monthDebt],
    ['water_total', waterTotal, refs.waterTotal],
    ['prev_balance', prevBalance, refs.prevBalance],
    ['meter_balance', meterBalance, refs.meterBalance],
    ['pump_balance', pumpBalance, refs.pumpBalance],
    ['total_water_debt', totalWaterDebt, refs.totalWaterDebt],
    ['maint_debt_next_month', maintDebt, refs.maintDebtNextMonth],
  ];
  for (const [field, computed, ref] of checks) {
    if (ref !== undefined && ref !== null && ref !== '') {
      const r = round2(toNum(ref));
      if (Math.abs(computed - r) > 0.005) {
        discrepancies.push({ field, computed, reference: r, reason: 'La fórmula configurada difiere del importe de referencia' });
      }
    }
  }

  return {
    tariff,
    computed: {
      readingDiffM3: diff,
      waterConsumption: consumption,
      monthDebt,
      prevBalance,
      meterBalance,
      pumpBalance,
      waterTotal,
      totalWaterDebt,
      maintDebtNextMonth: maintDebt,
    },
    discrepancies,
  };
}

module.exports = { computeNotice, computeWaterConsumption, defaultTariff, tariffFrom, round2 };