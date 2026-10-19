/**
 * simulacion_workflow.js
 * Script de simulación del entorno de ejecución de n8n en vivo (Extensión).
 * Consume:
 * 1. JSON Server: Facturas pendientes (http://localhost:3000/facturas?estado=pendiente)
 * 2. API Pública 1: Feriados de CR (https://date.nager.at/api/v3/PublicHolidays/2026/CR)
 * 3. API Pública 2: Tipo de Cambio USD/CRC (https://open.er-api.com/v6/latest/USD)
 * 4. JSON Server: Historial previo (http://localhost:3000/historial_ejecuciones)
 *
 * Ejecución: node simulacion_workflow.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function main() {
  console.log('\n======================================================================');
  console.log(' SIMULACIÓN EN VIVO DEL WORKFLOW EXTENDIDO DE n8n (ENTORNO REAL)');
  console.log(' Multifuente: 2 APIs Externas + 2 Endpoints JSON Server + Email Alert');
  console.log('======================================================================\n');

  // 1. Obtener facturas desde JSON Server (o fallback local de db.json si el server no está activo)
  console.log('[1/5] Consultando facturas pendientes en JSON Server...');
  let facturasItems = [];
  try {
    const resFacturas = await fetch('http://localhost:3000/facturas?estado=pendiente');
    const facturas = await resFacturas.json();
    facturasItems = facturas.map(f => ({ json: f }));
    console.log(`  ✔ Se obtuvieron ${facturasItems.length} facturas pendientes desde JSON Server.`);
  } catch (err) {
    console.warn(`  ⚠ JSON Server no responde en puerto 3000 (${err.message}).`);
    console.log('    Cargando facturas pendientes directamente desde db.json para simulación...');
    const localDb = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
    facturasItems = (localDb.facturas || [])
      .filter(f => f.estado === 'pendiente')
      .map(f => ({ json: f }));
    console.log(`  ✔ Se cargaron ${facturasItems.length} facturas pendientes desde db.json.`);
  }

  // 2. Obtener feriados desde API Pública (Fuente 1)
  console.log('\n[2/5] Consultando feriados de Costa Rica en date.nager.at...');
  let feriadosItems = [];
  try {
    const resFeriados = await fetch('https://date.nager.at/api/v3/PublicHolidays/2026/CR');
    if (resFeriados.ok) {
      const feriados = await resFeriados.json();
      feriadosItems = feriados.map(h => ({ json: h }));
      console.log(`  ✔ Se obtuvieron ${feriadosItems.length} feriados oficiales desde la API.`);
    } else {
      console.warn(`  ⚠ API retornó status ${resFeriados.status}. Activando ContinueOnFail.`);
      feriadosItems = [{ json: { error: 'API_ERROR_500' } }];
    }
  } catch (err) {
    console.warn(`  ⚠ Red inaccesible: ${err.message}. ContinueOnFail activado.`);
    feriadosItems = [{ json: { error: err.message } }];
  }

  // 3. Obtener Tipo de Cambio USD/CRC desde open.er-api.com (Fuente 2 - Reto 2)
  console.log('\n[3/5] Consultando tipo de cambio USD/CRC en open.er-api.com (Segunda API)...');
  let tipoCambioItems = [];
  try {
    const resTC = await fetch('https://open.er-api.com/v6/latest/USD');
    if (resTC.ok) {
      const tcData = await resTC.json();
      tipoCambioItems = [{ json: tcData }];
      console.log(`  ✔ Tasa de cambio oficial obtenida: $1 USD = ₡${tcData.rates.CRC} CRC.`);
    } else {
      console.warn(`  ⚠ API tipo de cambio status ${resTC.status}. ContinueOnFail activado.`);
      tipoCambioItems = [{ json: { rates: { CRC: 518.50 } } }];
    }
  } catch (err) {
    console.warn(`  ⚠ Fallo en API tipo de cambio: ${err.message}. Fallback a ₡518.50 CRC.`);
    tipoCambioItems = [{ json: { rates: { CRC: 518.50 } } }];
  }

  // 4. Obtener Historial de Ejecuciones desde JSON Server (Fuente 3 - Reto 4)
  console.log('\n[4/5] Consultando historial de ejecuciones previas...');
  let historialItems = [];
  try {
    const resHistorial = await fetch('http://localhost:3000/historial_ejecuciones');
    if (resHistorial.ok) {
      const histData = await resHistorial.json();
      historialItems = histData.map(h => ({ json: h }));
      console.log(`  ✔ Se obtuvieron ${historialItems.length} cortes históricos desde JSON Server.`);
    }
  } catch (err) {
    const localDb = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));
    historialItems = (localDb.historial_ejecuciones || []).map(h => ({ json: h }));
    console.log(`  ✔ Se cargaron ${historialItems.length} cortes históricos desde db.json.`);
  }

  // 5. Ejecutar el código exacto del nodo Code en VM aislada
  console.log('\n[5/5] Ejecutando Nodo Code "Procesar Facturas y Tendencia (POO)"...');
  const combinedItems = [
    ...feriadosItems,
    ...tipoCambioItems,
    ...facturasItems,
    ...historialItems
  ];

  const codeString = fs.readFileSync(path.join(__dirname, 'codigo_nodo_n8n.js'), 'utf8');

  const sandbox = {
    $input: {
      all: () => combinedItems
    },
    $: (nodeName) => {
      if (nodeName.includes('Feriados')) return { all: () => feriadosItems };
      if (nodeName.includes('Tipo de Cambio')) return { all: () => tipoCambioItems };
      if (nodeName.includes('Historial')) return { all: () => historialItems };
      if (nodeName.includes('Facturas')) return { all: () => facturasItems };
      return null;
    },
    Date: Date,
    console: console,
    Math: Math,
    Set: Set,
    Array: Array,
    Object: Object,
    String: String,
    Number: Number,
    Boolean: Boolean,
    JSON: JSON
  };

  const script = new vm.Script(`(() => {\n${codeString}\n})()`);
  const context = vm.createContext(sandbox);
  const resultadoCode = script.runInContext(context);

  console.log(`  ✔ Nodo Code procesó ${resultadoCode.length} registros con POO y Polimorfismo.`);

  // Separar válidas de rechazadas (Nodo IF)
  const validas = resultadoCode.filter(item => item.json.errorValidacion === false);
  const rechazadas = resultadoCode.filter(item => item.json.errorValidacion === true);
  const criticas = validas.filter(item => item.json.estado === 'vencida' || item.json.alertaCriticaTendencia === true);

  console.log('\n--- RESULTADOS DE BIFURCACIÓN Y ALERTAS ---');
  console.log(`  ➡ Facturas Válidas a actualizar por PATCH en JSON Server: ${validas.length}`);
  console.log(`  ➡ Facturas Rechazadas enviadas a Auditoría (Error 1):     ${rechazadas.length}`);
  console.log(`  ➡ Facturas en Situación Crítica que disparan EMAIL:       ${criticas.length}`);

  if (validas.length > 0) {
    const diag = validas[0].json;
    console.log(`\n--- ANÁLISIS DE TENDENCIA FINANCIERA (RETO 4) ---`);
    console.log(`  • Estado de Tendencia:     ${diag.diagnosticoTendencia}`);
    console.log(`  • Morosidad Actual:        ${diag.morosidadActualPorcentaje}%`);
    console.log(`  • Alerta Crítica Activa:   ${diag.alertaCriticaTendencia ? 'SÍ' : 'NO'}`);
    console.log(`  • Diagnóstico de Negocio:  ${diag.resumenDiagnostico}`);
    console.log(`  • Registro POST preparado: ${JSON.stringify(diag.nuevoRegistroHistorico)}`);
  }

  console.log('\n--- MUESTRA DE FACTURAS PROCESADAS CON POLIMORFISMO ---');
  validas.forEach(v => {
    const f = v.json;
    console.log(`  • [${f.id}] ${f.cliente.padEnd(35)} | ${f.tipoFactura.padEnd(20)} | Vence: ${f.fechaVencimiento} | Estado: ${f.estado.padEnd(8)} | Total CRC: ₡${Number(f.montoTotalConMoraCRC || f.montoTotalConMora).toLocaleString('es-CR')} | ${f.alertaPrioridad}`);
  });

  console.log('\n======================================================================');
  console.log(' SIMULACIÓN DEL WORKFLOW EXTENDIDO COMPLETADA EXITOSAMENTE');
  console.log('======================================================================\n');
}

main().catch(console.error);
