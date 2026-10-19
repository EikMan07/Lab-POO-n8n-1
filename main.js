/**
 * main.js
 * ============================================================================
 * LABORATORIO #1 + EXTENSIÓN: SOLUCIONES DE NEGOCIO (POO + n8n)
 * Escenario 1: Central de Facturación con Días Hábiles (Costa Rica 2026)
 * ============================================================================
 * Script de ejecución por consola para probar de forma 100% independiente:
 * - Jerarquía con Herencia y Polimorfismo (FacturaNacional y FacturaInternacional)
 * - Patrón Factory (FacturaFactory.crearDesdeJSON)
 * - Conversión cambiaria multimoneda (USD -> CRC)
 * - Análisis de Historial y Tendencia Financiera (HistorialTendencia)
 * - Sin requerir que n8n ni JSON Server estén corriendo.
 *
 * Ejecución: node main.js
 */

const fs = require('fs');
const path = require('path');

// 1. Importación limpia de las clases reales del proyecto
const { CalendarioLaboral } = require('./calendario_laboral');
const { Factura, FacturaNacional, FacturaInternacional, FacturaFactory } = require('./factura');
const { HistorialTendencia } = require('./historial_tendencia');

// Utilidades de formato visual en terminal
const SEPARADOR = '='.repeat(85);
const SUB_SEP   = '-'.repeat(85);

console.log('\n' + SEPARADOR);
console.log('   CENTRAL DE FACTURACIÓN CON DÍAS HÁBILES - PRUEBAS DE DOMINIO EXTENDIDO (POO)');
console.log('   Herencia, Polimorfismo Multimoneda y Análisis de Tendencia de Cobro');
console.log('   Ejecución 100% independiente en Node.js puro (Sin frameworks ni n8n)');
console.log(SEPARADOR + '\n');

// ============================================================================
// SECCIÓN 1: Instanciación de CalendarioLaboral con Feriados Reales (CR 2026)
// ============================================================================
console.log('📌 SECCIÓN 1: Demostración de Métodos de CalendarioLaboral');
console.log(SUB_SEP);

const feriadosRealesCR2026 = [
  { date: '2026-01-01', localName: 'Año Nuevo' },
  { date: '2026-04-02', localName: 'Jueves Santo' },
  { date: '2026-04-03', localName: 'Viernes Santo' },
  { date: '2026-04-11', localName: 'Día de Juan Santamaría' },
  { date: '2026-05-01', localName: 'Día Internacional del Trabajo' },
  { date: '2026-07-25', localName: 'Anexión del Partido de Nicoya a Costa Rica' },
  { date: '2026-08-02', localName: 'Fiesta de Nuestra Señora de los Ángeles' },
  { date: '2026-08-15', localName: 'Día de la Madre' },
  { date: '2026-09-15', localName: 'Día de la Independencia' },
  { date: '2026-12-01', localName: 'Día de la Abolición del Ejército' },
  { date: '2026-12-25', localName: 'Navidad' }
];

const calendario = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw: feriadosRealesCR2026
});

console.log(`• Calendario creado para: ${calendario.pais} - Año ${calendario.anio}`);
console.log(`• Total de feriados cargados: ${calendario.feriados.size}`);
console.log(`• Modo contingencia activo:   ${calendario.modoContingenciaSinAPI ? 'SÍ' : 'NO (Feriados de API en uso)'}\n`);

// Pruebas rápidas de métodos
console.log('Evaluación de fechas individuales:');
console.log(`  - 2026-09-12 (Sábado):   esFinDeSemana() = ${calendario.esFinDeSemana('2026-09-12')} | esDiaHabil() = ${calendario.esDiaHabil('2026-09-12')}`);
console.log(`  - 2026-09-14 (Lunes):    esFinDeSemana() = ${calendario.esFinDeSemana('2026-09-14')} | esDiaHabil() = ${calendario.esDiaHabil('2026-09-14')}`);
console.log(`  - 2026-09-15 (Feriado):  esFeriado()     = ${calendario.esFeriado('2026-09-15')} | esDiaHabil() = ${calendario.esDiaHabil('2026-09-15')}`);

const fechaVenc1 = calendario.sumarDiasHabiles('2026-09-10', 15);
console.log(`\n• sumarDiasHabiles("2026-09-10", 15) = "${fechaVenc1}" (RN1: Salta fines de semana y feriado 15-Sept)`);
console.log(`• contarDiasHabilesEntre("2026-10-19", "2026-10-22") = +${calendario.contarDiasHabilesEntre('2026-10-19', '2026-10-22')} días restantes`);
console.log(`• contarDiasHabilesEntre("2026-10-19", "2026-10-02") = ${calendario.contarDiasHabilesEntre('2026-10-19', '2026-10-02')} días de mora transcurridos\n`);

// ============================================================================
// SECCIÓN 2: Herencia, Polimorfismo (Reto 1) y 5 Reglas de Negocio
// ============================================================================
console.log('📌 SECCIÓN 2: Demostración de Herencia y Polimorfismo (Reto 1)');
console.log(SUB_SEP);

// Carga de db.json
const dbPath = path.join(__dirname, 'db.json');
const rawDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const facturasDb = rawDb.facturas || [];
const historialDb = rawDb.historial_ejecuciones || [];

console.log(`• Se cargaron ${facturasDb.length} facturas y ${historialDb.length} ejecuciones históricas desde db.json.`);

// Tipo de cambio obtenido o de referencia (API open.er-api.com o fallback)
const TIPO_CAMBIO_USD = 518.50; // ₡518.50 por $1 USD
console.log(`• Tipo de cambio simulado para conversión: ₡${TIPO_CAMBIO_USD} CRC / USD\n`);

const facturasEvaluadas = [];
const facturasRechazadas = [];
const fechaReferencia = '2026-10-19';

facturasDb.forEach(datos => {
  const estadoInicial = (datos.id === 'FAC-008') ? 'pagada' : 'pendiente';

  // RETO 1: Creación polimórfica mediante FacturaFactory
  const factura = FacturaFactory.crearDesdeJSON({
    ...datos,
    estado: estadoInicial
  });

  if (!factura.validarDatos()) {
    facturasRechazadas.push({ instancia: factura, datosOriginales: datos });
    return;
  }

  // Ejecución del método polimórfico evaluarEstado()
  factura.evaluarEstado(calendario, fechaReferencia, { tipoCambio: TIPO_CAMBIO_USD });

  facturasEvaluadas.push({
    instancia: factura,
    estadoInicial
  });
});

console.log('Evidencia de Polimorfismo Real (mismo método evaluarEstado, comportamientos distintos):');

facturasEvaluadas.forEach(({ instancia: f }) => {
  const esInter = f instanceof FacturaInternacional;
  console.log(`\n📄 [${f.id}] ${f.cliente}`);
  console.log(`   Clase Concreta:   ${f.constructor.name} (Hereda de Factura: ${f instanceof Factura})`);
  console.log(`   Tipo de Factura:  ${f.tipoFactura}`);
  console.log(`   Monto Original:   ${f.moneda === 'USD' ? '$' + Number(f.monto).toLocaleString('en-US') : '₡' + Number(f.monto).toLocaleString('es-CR')} ${f.moneda}`);
  if (esInter) {
    console.log(`   Días Trámite:     +${f.diasTramiteBancario} días hábiles (Polimorfismo: SWIFT bancario extendido)`);
    console.log(`   Conversión a CRC: ₡${Number(f.montoCRC).toLocaleString('es-CR')} (T.C: ₡${f.tipoCambioAplicado})`);
  }
  console.log(`   Fecha Vencimiento:${f.fechaVencimiento} (RN1 + Regla de subclase)`);
  console.log(`   Días Restantes:   ${f.diasHabilesRestantes} días hábiles a ${fechaReferencia}`);
  console.log(`   Estado Evaluado:  ${f.estado.toUpperCase()} (RN3)`);
  if (f.estado === 'vencida') {
    const descMora = esInter
      ? `$${f.recargoMora} USD ($${f.monto * (f.tipoCliente === 'vip' ? 0.02 : 0.05)} mora + $${f.comisionTransferenciaUSD} comisión SWIFT)`
      : `₡${Number(f.recargoMora).toLocaleString('es-CR')} CRC`;
    console.log(`   Recargo de Mora:  ${descMora} (RN4: Polimórfico)`);
    console.log(`   Monto Mora CRC:   ₡${Number(f.montoTotalConMoraCRC || f.montoTotalConMora).toLocaleString('es-CR')}`);
  }
  console.log(`   Alerta Asignada:  ${f.alertaPrioridad} (RN5)`);
});
console.log('\n');

// ============================================================================
// SECCIÓN 3: Demostración de Situaciones de Error (Error 1 y Error 2)
// ============================================================================
console.log('📌 SECCIÓN 3: Demostración de las 2 Situaciones de Error');
console.log(SUB_SEP);

console.log('🔹 ERROR 1: Facturas con Datos Incompletos o Corruptos');
facturasRechazadas.forEach(({ instancia: f }) => {
  console.log(`   ✖ Factura rechazada [${f.id}]:`);
  console.log(`     Cliente:         ${f.cliente}`);
  console.log(`     Monto:           ${f.monto}`);
  console.log(`     Fecha Emisión:   ${f.fechaEmision}`);
  console.log(`     errorValidacion: ${f.errorValidacion}`);
  console.log(`     motivoError:     "${f.motivoError}"`);
});

console.log('\n🔹 ERROR 2: Fallo o Caída de API Externa (date.nager.at)');
const calContingencia = new CalendarioLaboral({ anio: 2026, pais: 'CR', feriadosRaw: [] });
console.log(`   - modoContingenciaSinAPI: ${calContingencia.modoContingenciaSinAPI ? 'SÍ (Activado automáticamente)' : 'NO'}`);
console.log(`   - Feriados base oficiales: ${calContingencia.feriados.size} feriados de Costa Rica cargados`);
console.log(`   - Cálculo en contingencia: sumarDiasHabiles("2026-09-10", 15) = "${calContingencia.sumarDiasHabiles('2026-09-10', 15)}"\n`);

// ============================================================================
// SECCIÓN 4: Análisis de Historial y Tendencia (Reto 4)
// ============================================================================
console.log('📌 SECCIÓN 4: Análisis de Historial y Tendencia Financiera (Reto 4)');
console.log(SUB_SEP);

const analizadorTendencia = new HistorialTendencia(historialDb);

// Cálculo de métricas de la ejecución actual
const vencidas = facturasEvaluadas.filter(i => i.instancia.estado === 'vencida');
const montoTotalVencidoCRC = vencidas.reduce((sum, i) => sum + (i.instancia.montoTotalConMoraCRC || i.instancia.montoTotalConMora || 0), 0);

const ejecucionActualMetricas = {
  totalFacturasEvaluadas: facturasEvaluadas.length,
  cantidadFacturasVencidas: vencidas.length,
  montoTotalVencido: Math.round(montoTotalVencidoCRC * 100) / 100,
  porcentajeMorosidad: facturasEvaluadas.length > 0
    ? Math.round((vencidas.length / facturasEvaluadas.length) * 10000) / 100
    : 0
};

const diagnosticoTendencia = analizadorTendencia.analizarTendencia(ejecucionActualMetricas);
const nuevoRegistroHistorico = analizadorTendencia.generarRegistroHistorico(ejecucionActualMetricas, diagnosticoTendencia);

console.log('📊 Métricas de la Ejecución Actual:');
console.log(`   • Total Evaluadas:         ${ejecucionActualMetricas.totalFacturasEvaluadas} facturas válidas`);
console.log(`   • Cantidad Vencidas:       ${ejecucionActualMetricas.cantidadFacturasVencidas} facturas en mora`);
console.log(`   • Porcentaje de Morosidad: ${ejecucionActualMetricas.porcentajeMorosidad}%`);
console.log(`   • Monto Total Vencido:     ₡${ejecucionActualMetricas.montoTotalVencido.toLocaleString('es-CR')} CRC`);

console.log('\n📈 Comparativa Contra el Historial:');
console.log(`   • Morosidad Corte Previo:  ${diagnosticoTendencia.porcentajePrevio}%`);
console.log(`   • Promedio Histórico:      ${diagnosticoTendencia.promedioHistorico}%`);
console.log(`   • Variación Porcentual:    ${diagnosticoTendencia.variacionPorcentual > 0 ? '+' : ''}${diagnosticoTendencia.variacionPorcentual}%`);
console.log(`   • Estado de Tendencia:     ${diagnosticoTendencia.estadoTendencia}`);
console.log(`   • Alerta Crítica (Email):  ${diagnosticoTendencia.alertaCritica ? 'ACTIVADA (Dispara notificación)' : 'DESACTIVADA'}`);
console.log(`   • Diagnóstico de Negocio:  ${diagnosticoTendencia.mensajeDiagnostico}`);

console.log('\n💾 Nuevo Registro Generado para POST /historial_ejecuciones:');
console.log(JSON.stringify(nuevoRegistroHistorico, null, 2) + '\n');

// ============================================================================
// SECCIÓN 5: Resumen Tabular Limpio (console.table)
// ============================================================================
console.log('📌 SECCIÓN 5: Resumen Tabular de Resultados');
console.log(SUB_SEP);

const tablaFacturas = facturasEvaluadas.map(({ instancia: f, estadoInicial }) => ({
  ID: f.id,
  Cliente: f.cliente.length > 22 ? f.cliente.substring(0, 19) + '...' : f.cliente,
  Clase: f.constructor.name,
  Monto: `${f.moneda === 'USD' ? '$' : '₡'}${Number(f.monto).toLocaleString()}`,
  'Monto CRC': `₡${Number(f.montoCRC || f.monto).toLocaleString('es-CR')}`,
  'Est. Ini': estadoInicial,
  'Est. Fin': f.estado,
  Vence: f.fechaVencimiento,
  'Días Rest': f.diasHabilesRestantes,
  Mora: `${f.moneda === 'USD' ? '$' : '₡'}${Number(f.recargoMora).toLocaleString()}`,
  'Total Final CRC': `₡${Number(f.montoTotalConMoraCRC || f.montoTotalConMora).toLocaleString('es-CR')}`,
  Prioridad: f.alertaPrioridad
}));

console.log('✅ FACTURAS EVALUADAS CON HERENCIA Y POLIMORFISMO:');
console.table(tablaFacturas);

console.log('\n📜 HISTORIAL DE EJECUCIONES Y TENDENCIA:');
const tablaHistorial = [
  ...historialDb.map(h => ({
    ID: h.id,
    Fecha: h.fechaEjecucion.split('T')[0],
    Evaluadas: h.totalFacturasEvaluadas,
    Vencidas: h.cantidadFacturasVencidas,
    Morosidad: `${h.porcentajeMorosidad}%`,
    'Monto Vencido': `₡${Number(h.montoTotalVencido).toLocaleString('es-CR')}`,
    Tendencia: h.estadoTendencia || 'N/A'
  })),
  {
    ID: nuevoRegistroHistorico.id + ' (ACTUAL)',
    Fecha: nuevoRegistroHistorico.fechaEjecucion.split('T')[0],
    Evaluadas: nuevoRegistroHistorico.totalFacturasEvaluadas,
    Vencidas: nuevoRegistroHistorico.cantidadFacturasVencidas,
    Morosidad: `${nuevoRegistroHistorico.porcentajeMorosidad}%`,
    'Monto Vencido': `₡${Number(nuevoRegistroHistorico.montoTotalVencido).toLocaleString('es-CR')}`,
    Tendencia: `${nuevoRegistroHistorico.estadoTendencia} 🚨`
  }
];
console.table(tablaHistorial);

console.log('\n' + SEPARADOR);
console.log('   EJECUCIÓN DE main.js COMPLETADA EXITOSAMENTE');
console.log(SEPARADOR + '\n');
