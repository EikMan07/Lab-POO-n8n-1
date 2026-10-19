/**
 * test_runner.js
 * Suite integral de pruebas unitarias y de integración para el Escenario 1.
 * Ejecuta validaciones de POO pura en Node.js sin dependencias externas.
 *
 * Ejecución: node test_runner.js
 */

const fs = require('fs');
const path = require('path');
const { CalendarioLaboral, Factura, ServicioFacturacion } = require('./dominio_facturacion');

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
console.log(`${C_BOLD}${C_CYAN} LABORATORIO #1: SOLUCIONES DE NEGOCIO (POO + n8n) - SUITE DE PRUEBAS${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN} Escenario 1: Central de Facturación con Días Hábiles (Costa Rica 2026)${C_RESET}`);
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

// esFinDeSemana
assert(calendarioAPI.esFinDeSemana('2026-09-12') === true, 'Sábado 2026-09-12 es fin de semana');
assert(calendarioAPI.esFinDeSemana('2026-09-13') === true, 'Domingo 2026-09-13 es fin de semana');
assert(calendarioAPI.esFinDeSemana('2026-09-14') === false, 'Lunes 2026-09-14 NO es fin de semana');

// esFeriado
assert(calendarioAPI.esFeriado('2026-09-15') === true, '2026-09-15 (Independencia) es feriado oficial');
assert(calendarioAPI.esFeriado('2026-09-14') === false, '2026-09-14 NO es feriado');

// esDiaHabil
assert(calendarioAPI.esDiaHabil('2026-09-14') === true, 'Lunes 2026-09-14 es día hábil');
assert(calendarioAPI.esDiaHabil('2026-09-15') === false, 'Martes 2026-09-15 (Feriado) NO es día hábil');
assert(calendarioAPI.esDiaHabil('2026-09-19') === false, 'Sábado 2026-09-19 NO es día hábil');

// sumarDiasHabiles (RN1)
// Emisión: 2026-09-10 (Jueves), 15 días hábiles saltando fin de semana y feriado del 15 de sept -> Debe ser 2026-10-02 (Viernes)
const fechaVenc1 = calendarioAPI.sumarDiasHabiles('2026-09-10', 15);
assert(
  fechaVenc1 === '2026-10-02',
  'RN1: sumarDiasHabiles("2026-09-10", 15) calcula exactamente "2026-10-02"',
  `Calculado: ${fechaVenc1}`
);

// contarDiasHabilesEntre
const diasRestantesPositivos = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-22');
assert(
  diasRestantesPositivos === 3,
  'contarDiasHabilesEntre("2026-10-19", "2026-10-22") devuelve +3 días hábiles restantes',
  `Resultado: ${diasRestantesPositivos}`
);

const diasAtrasoNegativos = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-02');
assert(
  diasAtrasoNegativos === -11,
  'contarDiasHabilesEntre("2026-10-19", "2026-10-02") devuelve -11 días hábiles de mora',
  `Resultado: ${diasAtrasoNegativos}`
);

const diasMismoDia = calendarioAPI.contarDiasHabilesEntre('2026-10-19', '2026-10-19');
assert(diasMismoDia === 0, 'contarDiasHabilesEntre para el mismo día devuelve 0');

// -------------------------------------------------------------------------
// BLOQUE 2: Pruebas de las 5 Reglas de Negocio (RN1 - RN5) en Clase Factura
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}2. Pruebas de Reglas de Negocio (RN1 - RN5)${C_RESET}`);
const fechaEvaluacion = '2026-10-19'; // Fecha actual de referencia

// RN2: Plazo según tipo de cliente (Regular: 15, VIP: 20 si no se especifica)
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

// RN3 y RN4: Factura vencida y cálculo de recargo de mora
// FAC-001 (Regular, 250,000, vence 2026-10-02 -> evaluada a 2026-10-19 está vencida)
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
assert(
  facVencidaRegular.recargoMora === 12500,
  'RN4: Recargo de mora regular es 5% de 250,000 = 12,500',
  `Recargo: ${facVencidaRegular.recargoMora}`
);
assert(
  facVencidaRegular.montoTotalConMora === 262500,
  'RN4: Monto total con mora regular es 262,500',
  `Total: ${facVencidaRegular.montoTotalConMora}`
);

// FAC-002 (VIP, 800,000, vence 2026-09-29 -> evaluada a 2026-10-19 está vencida)
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
assert(
  facVencidaVIP.recargoMora === 16000,
  'RN4: Recargo de mora VIP es 2% de 800,000 = 16,000',
  `Recargo: ${facVencidaVIP.recargoMora}`
);
assert(
  facVencidaVIP.montoTotalConMora === 816000,
  'RN4: Monto total con mora VIP es 816,000',
  `Total: ${facVencidaVIP.montoTotalConMora}`
);

// RN5: Alerta de vencimiento próximo (diasRestantes <= 3 y >= 0)
// FAC-003: Emisión 2026-10-01, 15 días hábiles -> vence 2026-10-22. A 2026-10-19 faltan 3 días hábiles
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
assert(
  facProximaVencer.diasHabilesRestantes === 3,
  'Factura próxima a vencer tiene exactamente 3 días hábiles restantes',
  `Días: ${facProximaVencer.diasHabilesRestantes}`
);
assert(
  facProximaVencer.alertaPrioridad === 'ALTA - Próxima a vencer',
  'RN5: Se asigna alertaPrioridad "ALTA - Próxima a vencer"',
  `Alerta: ${facProximaVencer.alertaPrioridad}`
);

// Factura con holgura (más de 3 días) -> Alerta NORMAL
const facHolgada = new Factura({
  id: 'FAC-004',
  cliente: 'Tecnologías Globales de Cartago S.A.',
  tipoCliente: 'vip',
  monto: 1250000,
  fechaEmision: '2026-10-12',
  estado: 'pendiente'
});
facHolgada.evaluarEstado(calendarioAPI, fechaEvaluacion);

assert(
  facHolgada.diasHabilesRestantes > 3,
  'Factura con holgura tiene más de 3 días hábiles restantes',
  `Días: ${facHolgada.diasHabilesRestantes}`
);
assert(
  facHolgada.alertaPrioridad === 'NORMAL',
  'Factura con holgura mantiene alertaPrioridad "NORMAL"'
);

// -------------------------------------------------------------------------
// BLOQUE 3: Pruebas de Situaciones de Error / Inesperadas
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}3. Pruebas de Situaciones de Error Obligatorias${C_RESET}`);

// Error 1: Datos incompletos o corruptos en la factura
const facMontoNegativo = new Factura({
  id: 'FAC-005',
  cliente: 'Ferretería El Tornillo Oxidado',
  monto: -50000,
  fechaEmision: '2026-10-05'
});
assert(
  facMontoNegativo.errorValidacion === true,
  'Error 1A: Captura factura con monto <= 0 marcando errorValidacion = true'
);
assert(
  facMontoNegativo.motivoError.includes('Monto inválido'),
  'Error 1A: motivoError describe adecuadamente el fallo de monto',
  `Motivo: ${facMontoNegativo.motivoError}`
);

const facFechaInvalida = new Factura({
  id: 'FAC-006',
  cliente: 'Supermercado La Confianza',
  monto: 310000,
  fechaEmision: '2026-02-31' // Fecha inexistente
});
assert(
  facFechaInvalida.errorValidacion === true,
  'Error 1B: Captura factura con fecha de emisión inexistente o corrupta'
);
assert(
  facFechaInvalida.motivoError.includes('no existe en el calendario') || facFechaInvalida.motivoError.includes('inválida'),
  'Error 1B: motivoError describe adecuadamente el fallo de fecha',
  `Motivo: ${facFechaInvalida.motivoError}`
);

// Error 2: Fallo en la API externa date.nager.at o lista de feriados vacía
const calendarioContingencia = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw: [] // Simula respuesta vacía o fallo de red
});
assert(
  calendarioContingencia.modoContingenciaSinAPI === true,
  'Error 2: Si la API de feriados falla, activa modoContingenciaSinAPI = true'
);
assert(
  calendarioContingencia.feriados.size === 11,
  'Error 2: Carga automáticamente el catálogo base de contingencia (11 feriados oficiales de CR)',
  `Cantidad: ${calendarioContingencia.feriados.size}`
);
const vencContingencia = calendarioContingencia.sumarDiasHabiles('2026-09-10', 15);
assert(
  vencContingencia === '2026-10-02',
  'Error 2: Con feriados de contingencia, calcula correctamente el vencimiento de septiembre ("2026-10-02")'
);

// -------------------------------------------------------------------------
// BLOQUE 4: Prueba de Integración con el lote completo de db.json
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}4. Prueba de Integración: Procesamiento de Lote db.json${C_RESET}`);
const dbPath = path.join(__dirname, 'db.json');
const dbRaw = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// Filtrar facturas con estado=pendiente como lo hace el endpoint de JSON Server
const facturasPendientes = dbRaw.facturas.filter(f => f.estado === 'pendiente');

const resultadoLote = ServicioFacturacion.procesarLote({
  facturasRaw: facturasPendientes,
  feriadosRaw: calendarioAPI.obtenerListaFeriados().map(d => ({ date: d })),
  fechaReferencia: '2026-10-19'
});

assert(
  resultadoLote.resumen.totalRecibidas === 7,
  `Recibe 7 facturas pendientes (de 8 totales en db.json, excluyendo la pagada)`
);
assert(
  resultadoLote.resumen.totalValidas === 5,
  `5 facturas superan la validación de integridad (FAC-001, 002, 003, 004, 007)`
);
assert(
  resultadoLote.resumen.totalRechazadas === 2,
  `2 facturas son rechazadas por datos corruptos (FAC-005 monto negativo, FAC-006 fecha inválida)`
);
assert(
  resultadoLote.resumen.totalVencidas === 2,
  `2 facturas pasan a estado vencida con recargo de mora (FAC-001 regular 5%, FAC-002 vip 2%)`
);
assert(
  resultadoLote.resumen.totalProximasVencer === 2,
  `2 facturas reciben alerta ALTA - Próxima a vencer (FAC-003 faltan 3 días, FAC-007 vence hoy)`
);

// -------------------------------------------------------------------------
// RESUMEN FINAL
// -------------------------------------------------------------------------
console.log(`\n${C_BOLD}${C_CYAN}----------------------------------------------------------------------${C_RESET}`);
console.log(`${C_BOLD}RESUMEN DE PRUEBAS:${C_RESET}`);
console.log(`  Total evaluadas: ${totalTests}`);
console.log(`  Exitosas:        ${C_GREEN}${passedTests}${C_RESET}`);
console.log(`  Fallidas:        ${failedTests > 0 ? C_RED : C_GREEN}${failedTests}${C_RESET}`);
console.log(`${C_BOLD}${C_CYAN}----------------------------------------------------------------------${C_RESET}\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log(`${C_BOLD}${C_GREEN}✔ TODAS LAS PRUEBAS UNITARIAS, DE REGLAS DE NEGOCIO Y CASOS DE ERROR PASARON EXITOSAMENTE.${C_RESET}\n`);
}
