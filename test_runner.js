/**
 * test_runner.js
 * Suite integral de pruebas unitarias y de integración para el Laboratorio #1 y su Extensión.
 * Valida POO pura, herencia, polimorfismo, manejo de errores y análisis de tendencia.
 *
 * Ejecución: node test_runner.js
 */

const fs = require('fs');
const path = require('path');
const {
  CalendarioLaboral,
  Factura,
  FacturaNacional,
  FacturaInternacional,
  FacturaFactory,
  HistorialTendencia,
  ServicioFacturacion
} = require('./dominio_facturacion');

// Colores ANSI para reporte visual en terminal
const C_RESET = '\x1b[0m';
const C_GREEN = '\x1b[32m';
const C_RED = '\x1b[31m';
const C_CYAN = '\x1b[36m';
const C_YELLOW = '\x1b[33m';
const C_BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condicion, descripcion, detalleError = '') {
  totalTests++;
  if (condicion) {
    passedTests++;
    console.log(`  ${C_GREEN}✔ [PASS]${C_RESET} ${descripcion}`);
  } else {
    failedTests++;
    console.error(`  ${C_RED}✖ [FAIL]${C_RESET} ${descripcion}`);
    if (detalleError) {
      console.error(`    ${C_YELLOW}Detalle: ${detalleError}${C_RESET}`);
    }
  }
}

console.log(`\n${C_BOLD}${C_CYAN}======================================================================${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN} LABORATORIO #1 + EXTENSIÓN: SUITE DE PRUEBAS AUTOMATIZADAS (POO)${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN} Central de Facturación con Días Hábiles, Polimorfismo y Tendencias${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN}======================================================================${C_RESET}\n`);

// -------------------------------------------------------------------------
// BLOQUE 1: Pruebas Unitarias de CalendarioLaboral
// -------------------------------------------------------------------------
console.log(`${C_BOLD}1. Pruebas Unitarias: CalendarioLaboral (POO pura)${C_RESET}`);
const calendarioAPI = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw: [
    { date: '2026-01-01', localName: 'Año Nuevo' },
    { date: '2026-04-02', localName: 'Jueves Santo' },
    { date: '2026-04-03', localName: 'Viernes Santo' },
    { date: '2026-04-11', localName: 'Día de Juan Santamaría' },
    { date: '2026-05-01', localName: 'Día del Trabajo' },
    { date: '2026-07-25', localName: 'Anexión de Nicoya' },
    { date: '2026-08-02', localName: 'Virgen de los Ángeles' },
    { date: '2026-08-15', localName: 'Día de la Madre' },
    { date: '2026-09-15', localName: 'Día de la Independencia' },
    { date: '2026-12-01', localName: 'Abolición del Ejército' },
    { date: '2026-12-25', localName: 'Navidad' }
  ]
});

assert(calendarioAPI.esFinDeSemana('2026-09-12') === true, 'Sábado 2026-09-12 es fin de semana');
assert(calendarioAPI.esFinDeSemana('2026-09-13') === true, 'Domingo 2026-09-13 es fin de semana');
assert(calendarioAPI.esFinDeSemana('2026-09-14') === false, 'Lunes 2026-09-14 NO es fin de semana');
assert(calendarioAPI.esFeriado('2026-09-15') === true, '2026-09-15 (Independencia) es feriado oficial');
assert(calendarioAPI.esFeriado('2026-09-14') === false, '2026-09-14 NO es feriado');
assert(calendarioAPI.esDiaHabil('2026-09-14') === true, 'Lunes 2026-09-14 es día hábil');
assert(calendarioAPI.esDiaHabil('2026-09-15') === false, 'Martes 2026-09-15 (Feriado) NO es día hábil');
assert(calendarioAPI.esDiaHabil('2026-09-19') === false, 'Sábado 2026-09-19 NO es día hábil');

const fechaVenc1 = calendarioAPI.sumarDiasHabiles('2026-09-10', 15);
assert(
  fechaVenc1 === '2026-10-02',
  'RN1: sumarDiasHabiles("2026-09-10", 15) calcula exactamente "2026-10-02"',
  `Calculado: ${fechaVenc1}`
);

const diasRestantesPositivos = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-22');
assert(diasRestantesPositivos === 3, 'contarDiasHabilesEntre devuelve +3 días hábiles restantes');

const diasAtrasoNegativos = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-02');
assert(diasAtrasoNegativos === -11, 'contarDiasHabilesEntre devuelve -11 días hábiles de mora');

const diasMismoDia = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-19');
assert(diasMismoDia === 0, 'contarDiasHabilesEntre para el mismo día devuelve 0');

// -------------------------------------------------------------------------
// BLOQUE 2: Pruebas de las 5 Reglas de Negocio Base (RN1 - RN5)
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}2. Pruebas de Reglas de Negocio Base (RN1 - RN5)${C_RESET}`);
const fechaEvaluacion = '2026-10-19';

const facRegular = new Factura({
  id: 'TEST-REG',
  cliente: 'Cliente Regular S.A.',
  monto: 100000,
  fechaEmision: '2026-10-01',
  tipoCliente: 'regular'
});
assert(facRegular.plazoDiasHabiles === 15, 'RN2: Factura regular sin plazo asigna 15 días hábiles');

const facVIP = new Factura({
  id: 'TEST-VIP',
  cliente: 'Cliente VIP S.A.',
  monto: 100000,
  fechaEmision: '2026-10-01',
  tipoCliente: 'vip'
});
assert(facVIP.plazoDiasHabiles === 20, 'RN2: Factura VIP sin plazo asigna 20 días hábiles');

const facPlazoPersonalizado = new Factura({
  id: 'TEST-CUSTOM',
  cliente: 'Cliente Custom',
  monto: 50000,
  fechaEmision: '2026-10-01',
  tipoCliente: 'vip',
  plazoDiasHabiles: 10
});
assert(facPlazoPersonalizado.plazoDiasHabiles === 10, 'RN2: Respeta plazo explícito especificado (10 días)');

const facVencidaRegular = new Factura({
  id: 'FAC-001',
  cliente: 'Distribuidora del Pacífico S.A.',
  tipoCliente: 'regular',
  monto: 250000,
  fechaEmision: '2026-09-10',
  plazoDiasHabiles: 15,
  estado: 'pendiente'
});
facVencidaRegular.evaluarEstado(calendarioAPI, fechaEvaluacion);
assert(facVencidaRegular.estado === 'vencida', 'RN3: Factura regular cambia a estado "vencida"');
assert(facVencidaRegular.recargoMora === 12500, 'RN4: Recargo de mora regular es 5% de 250,000 = 12,500');
assert(facVencidaRegular.montoTotalConMora === 262500, 'RN4: Monto total con mora regular es 262,500');

const facVencidaVIP = new Factura({
  id: 'FAC-002',
  cliente: 'Corporación Transnacional Alajuela S.A.',
  tipoCliente: 'vip',
  monto: 800000,
  fechaEmision: '2026-09-01',
  estado: 'pendiente'
});
facVencidaVIP.evaluarEstado(calendarioAPI, fechaEvaluacion);
assert(facVencidaVIP.estado === 'vencida', 'RN3: Factura VIP cambia a estado "vencida"');
assert(facVencidaVIP.recargoMora === 16000, 'RN4: Recargo de mora VIP es 2% de 800,000 = 16,000');
assert(facVencidaVIP.montoTotalConMora === 816000, 'RN4: Monto total con mora VIP es 816,000');

const facProximaVencer = new Factura({
  id: 'FAC-003',
  cliente: 'Comercializadora San José Limitada',
  tipoCliente: 'regular',
  monto: 420000,
  fechaEmision: '2026-10-01',
  plazoDiasHabiles: 15,
  estado: 'pendiente'
});
facProximaVencer.evaluarEstado(calendarioAPI, fechaEvaluacion);
assert(facProximaVencer.estado === 'pendiente', 'Factura próxima a vencer sigue en estado "pendiente"');
assert(facProximaVencer.diasHabilesRestantes === 3, 'Factura próxima a vencer tiene 3 días hábiles restantes');
assert(facProximaVencer.alertaPrioridad === 'ALTA - Próxima a vencer', 'RN5: Asigna alerta "ALTA - Próxima a vencer"');

// -------------------------------------------------------------------------
// BLOQUE 3: RETO 1 - Jerarquía de Clases, Herencia y Polimorfismo
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}3. RETO 1: Jerarquía de Clases (Herencia y Polimorfismo)${C_RESET}`);

// Aserciones de Herencia
const facNac = FacturaFactory.crear({
  id: 'NAC-01',
  cliente: 'Compañía Tica S.A.',
  monto: 500000,
  fechaEmision: '2026-10-01',
  categoria: 'nacional'
});
assert(facNac instanceof Factura, 'FacturaNacional hereda de Factura (instanceof Factura)');
assert(facNac instanceof FacturaNacional, 'facNac es instancia de FacturaNacional');
assert(facNac.moneda === 'CRC', 'FacturaNacional opera en moneda CRC por defecto');

const facInter = FacturaFactory.crear({
  id: 'INT-01',
  cliente: 'Silicon Valley Exports Inc.',
  monto: 2000,
  fechaEmision: '2026-10-01',
  categoria: 'internacional',
  tipoCliente: 'vip'
});
assert(facInter instanceof Factura, 'FacturaInternacional hereda de Factura (instanceof Factura)');
assert(facInter instanceof FacturaInternacional, 'facInter es instancia de FacturaInternacional');
assert(facInter.moneda === 'USD', 'FacturaInternacional opera en moneda USD');
assert(facInter.diasTramiteBancario === 3, 'FacturaInternacional tiene 3 días de trámite bancario internacional');

// Aserción de FacturaFactory.crearDesdeJSON
const facCreadaDesdeJSON = FacturaFactory.crearDesdeJSON({
  id: 'INT-JSON',
  cliente: 'Test JSON Client',
  monto: 1000,
  fechaEmision: '2026-10-01',
  moneda: 'USD'
});
assert(facCreadaDesdeJSON instanceof FacturaInternacional, 'FacturaFactory.crearDesdeJSON reconoce moneda USD');

// Demostración de Polimorfismo en evaluarEstado()
const TIPO_CAMBIO_TEST = 520; // ₡520 por $1 USD
facNac.evaluarEstado(calendarioAPI, fechaEvaluacion, { tipoCambio: TIPO_CAMBIO_TEST });
facInter.evaluarEstado(calendarioAPI, fechaEvaluacion, { tipoCambio: TIPO_CAMBIO_TEST });

// 1. Polimorfismo en fecha de vencimiento internacional (agrega 3 días hábiles de trámite)
// Emisión: 2026-10-01, VIP base = 20 días + 3 días trámite = 23 días hábiles
const vencimientoEsperadoInter = calendarioAPI.sumarDiasHabiles('2026-10-01', 23);
assert(
  facInter.fechaVencimiento === vencimientoEsperadoInter,
  `Polimorfismo en plazo: FacturaInternacional vence el ${facInter.fechaVencimiento} (23 días hábiles)`
);

// 2. Polimorfismo en conversión cambiaria a CRC
assert(
  facInter.montoCRC === 2000 * TIPO_CAMBIO_TEST,
  `Polimorfismo en moneda: Convierte USD $2000 a ₡${facInter.montoCRC} CRC (Tipo cambio 520)`
);

// 3. Polimorfismo en mora internacional con comisión de transferencia
const facInterVencida = new FacturaInternacional({
  id: 'INT-VENCIDA',
  cliente: 'Global Import Miami LLC',
  monto: 3000,
  fechaEmision: '2026-09-01',
  tipoCliente: 'vip',
  plazoDiasHabiles: 15
});
facInterVencida.evaluarEstado(calendarioAPI, fechaEvaluacion, { tipoCambio: TIPO_CAMBIO_TEST });

assert(facInterVencida.estado === 'vencida', 'Factura internacional vencida cambia a estado "vencida"');
// VIP 2% de $3000 = $60 + $25 de comisión bancaria = $85 USD
assert(
  facInterVencida.recargoMora === 85,
  `Polimorfismo en mora: Recargo incluye $60 mora (2%) + $25 comisión SWIFT = $85 USD`,
  `Obtenido: $${facInterVencida.recargoMora}`
);
assert(
  facInterVencida.recargoMoraCRC === 85 * TIPO_CAMBIO_TEST,
  `Mora convertida a CRC: $85 * 520 = ₡${facInterVencida.recargoMoraCRC} CRC`
);

// -------------------------------------------------------------------------
// BLOQUE 4: RETO 4 - Historial y Análisis de Tendencia
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}4. RETO 4: Historial y Análisis de Tendencia (HistorialTendencia)${C_RESET}`);

const historialMock = [
  {
    id: 'EJEC-001',
    fechaEjecucion: '2026-10-16T08:00:00.000Z',
    totalFacturasEvaluadas: 6,
    cantidadFacturasVencidas: 1,
    porcentajeMorosidad: 16.67,
    montoTotalVencido: 250000
  },
  {
    id: 'EJEC-002',
    fechaEjecucion: '2026-10-17T08:00:00.000Z',
    totalFacturasEvaluadas: 7,
    cantidadFacturasVencidas: 2,
    porcentajeMorosidad: 28.57,
    montoTotalVencido: 1050000
  }
];

const analizador = new HistorialTendencia(historialMock);

// Caso A: Empeorando (Morosidad sube a 50%)
const diagnosticoEmpeorando = analizador.analizarTendencia({
  totalFacturasEvaluadas: 6,
  cantidadFacturasVencidas: 3,
  montoTotalVencido: 1850000
});
assert(
  diagnosticoEmpeorando.estadoTendencia === 'EMPEORANDO',
  'Diagnóstico detecta tendencia "EMPEORANDO" cuando la morosidad sube'
);
assert(
  diagnosticoEmpeorando.alertaCritica === true,
  'alertaCritica se activa en true al detectar tendencia EMPEORANDO'
);

// Caso B: Mejorando (Morosidad baja a 14%)
const diagnosticoMejorando = analizador.analizarTendencia({
  totalFacturasEvaluadas: 7,
  cantidadFacturasVencidas: 1,
  montoTotalVencido: 250000
});
assert(
  diagnosticoMejorando.estadoTendencia === 'MEJORANDO',
  'Diagnóstico detecta tendencia "MEJORANDO" cuando la morosidad baja'
);
assert(
  diagnosticoMejorando.alertaCritica === false,
  'alertaCritica es false cuando la tendencia es MEJORANDO'
);

// Caso C: Generación de registro para POST /historial_ejecuciones
const nuevoRegistro = analizador.generarRegistroHistorico(
  { totalFacturasEvaluadas: 6, cantidadFacturasVencidas: 3, montoTotalVencido: 1850000 },
  diagnosticoEmpeorando
);
assert(nuevoRegistro.id.startsWith('EJEC-'), 'generarRegistroHistorico asigna ID correlativo EJEC-');
assert(nuevoRegistro.estadoTendencia === 'EMPEORANDO', 'Registro histórico contiene estadoTendencia');
assert(nuevoRegistro.alertaCritica === true, 'Registro histórico contiene bandera alertaCritica');

// -------------------------------------------------------------------------
// BLOQUE 5: Situaciones de Error Obligatorias
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}5. Pruebas de Situaciones de Error Obligatorias${C_RESET}`);

const facMontoNegativo = FacturaFactory.crear({
  id: 'FAC-005',
  cliente: 'Ferretería El Tornillo Oxidado',
  monto: -50000,
  fechaEmision: '2026-10-05'
});
assert(facMontoNegativo.errorValidacion === true, 'Error 1A: Captura factura con monto <= 0');

const facFechaInvalida = FacturaFactory.crear({
  id: 'FAC-006',
  cliente: 'Supermercado La Confianza',
  monto: 310000,
  fechaEmision: '2026-02-31'
});
assert(facFechaInvalida.errorValidacion === true, 'Error 1B: Captura fecha de emisión inexistente');

const calContingencia = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw: []
});
assert(calContingencia.modoContingenciaSinAPI === true, 'Error 2: Si API falla activa contingencia');
assert(calContingencia.feriados.size === 11, 'Error 2: Carga 11 feriados base de Costa Rica');

// -------------------------------------------------------------------------
// BLOQUE 6: Integración Integral del Lote Extendido con ServicioFacturacion
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}6. Prueba de Integración: Lote Extendido de db.json${C_RESET}`);
const dbPath = path.join(__dirname, 'db.json');
const dbRaw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
const facturasPendientes = dbRaw.facturas.filter(f => f.estado === 'pendiente');

const resultadoServicio = ServicioFacturacion.procesarLote({
  facturasRaw: facturasPendientes,
  feriadosRaw: calendarioAPI.obtenerListaFeriados().map(d => ({ date: d })),
  fechaReferencia: '2026-10-19',
  tipoCambioUSD: 520,
  historialPrevio: dbRaw.historial_ejecuciones
});

assert(resultadoServicio.validas.length === 6, 'Lote procesa 6 facturas válidas (incluyendo internacionales)');
assert(resultadoServicio.rechazadas.length === 2, 'Lote aísla 2 facturas corruptas');
assert(resultadoServicio.resumen.tendencia.estadoTendencia === 'EMPEORANDO', 'Lote detecta tendencia global EMPEORANDO');
assert(resultadoServicio.nuevoRegistroHistorico.id !== undefined, 'Servicio genera nuevo registro histórico para BD');

// -------------------------------------------------------------------------
// RESUMEN FINAL
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}${C_CYAN}----------------------------------------------------------------------${C_RESET}`);
console.log(`${C_BOLD}RESUMEN DE PRUEBAS AUTOMATIZADAS:${C_RESET}`);
console.log(`  Total evaluadas: ${totalTests}`);
console.log(`  Exitosas:        ${C_GREEN}${passedTests}${C_RESET}`);
console.log(`  Fallidas:        ${failedTests > 0 ? C_RED : C_GREEN}${failedTests}${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN}----------------------------------------------------------------------${C_RESET}\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(`${C_BOLD}${C_GREEN}✔ TODAS LAS PRUEBAS DE LA EXTENSIÓN (HERENCIA, POLIMORFISMO Y TENDENCIAS) PASARON EXITOSAMENTE.${C_RESET}\n`);
}
