/**
 * simulacion_workflow.js
 * Script de simulación del entorno de ejecución de n8n en vivo.
 * Consume JSON Server en http://localhost:3000 y date.nager.at,
 * ejecuta el código exacto del nodo Code y valida las respuestas.
 *
 * Ejecución: node simulacion_workflow.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

async function main() {
  console.log('\n======================================================================');
  console.log(' SIMULACIÓN EN VIVO DEL WORKFLOW DE n8n (ENTORNO REAL)');
  console.log('======================================================================\n');

  // 1. Obtener facturas desde JSON Server (Nodo 2)
  console.log('[1/4] Consultando facturas pendientes en JSON Server (http://localhost:3000)...');
  let facturasItems = [];
  try {
    const resFacturas = await fetch('http://localhost:3000/facturas?estado=pendiente');
    const facturas = await resFacturas.json();
    facturasItems = facturas.map(f => ({ json: f }));
    console.log(`  ✔ Se obtuvieron ${facturasItems.length} facturas pendientes.`);
  } catch (err) {
    console.error(`  ✖ Error conectando con JSON Server: ${err.message}`);
    console.log('    Asegúrate de que json-server esté corriendo: npx json-server db.json --port 3000');
    return;
  }

  // 2. Obtener feriados desde API Pública (Nodo 3)
  console.log('[2/4] Consultando feriados de Costa Rica en date.nager.at...');
  let feriadosItems = [];
  try {
    const resFeriados = await fetch('https://date.nager.at/api/v3/PublicHolidays/2026/CR');
    if (resFeriados.ok) {
      const feriados = await resFeriados.json();
      feriadosItems = feriados.map(h => ({ json: h }));
      console.log(`  ✔ Se obtuvieron ${feriadosItems.length} feriados oficiales desde la API.`);
    } else {
      console.warn(`  ⚠ API retornó status ${resFeriados.status}. Se enviará objeto de error (Error 2).`);
      feriadosItems = [{ json: { error: 'API_ERROR_500' } }];
    }
  } catch (err) {
    console.warn(`  ⚠ Red inaccesible: ${err.message}. ContinueOnFail activado.`);
    feriadosItems = [{ json: { error: err.message } }];
  }

  // 3. Ejecutar el código exacto del nodo Code en un contexto aislado que emula n8n
  console.log('[3/4] Ejecutando Nodo Code "Procesar Facturas y Calendario (POO)"...');
  const combinedItems = [...feriadosItems, ...facturasItems];

  const codeString = fs.readFileSync(path.join(__dirname, 'codigo_nodo_n8n.js'), 'utf8');

  // Contexto que imita las variables globales de n8n
  const sandbox = {
    $input: {
      all: () => combinedItems
    },
    $: (nodeName) => {
      if (nodeName.includes('Feriados')) return { all: () => feriadosItems };
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
    Boolean: Boolean
  };

  const script = new vm.Script(`(() => {\n${codeString}\n})()`);
  const context = vm.createContext(sandbox);
  const resultadoCode = script.runInContext(context);

  console.log(`  ✔ Nodo Code procesó ${resultadoCode.length} registros exitosamente.`);

  // 4. Evaluar bifurcación (Nodo 5: IF)
  const validas = resultadoCode.filter(item => item.json.errorValidacion === false);
  const rechazadas = resultadoCode.filter(item => item.json.errorValidacion === true);

  console.log(`\n[4/4] Resultados de la Bifurcación (Nodo IF):`);
  console.log(`  ➡ Facturas Válidas a actualizar por PATCH en JSON Server: ${validas.length}`);
  console.log(`  ➡ Facturas Rechazadas enviadas a Auditoría:               ${rechazadas.length}`);

  console.log('\n--- DETALLE DE FACTURAS VÁLIDAS A ACTUALIZAR ---');
  validas.forEach(v => {
    const f = v.json;
    console.log(`  • ID: ${f.id} | Cliente: ${f.cliente.padEnd(35)} | Tipo: ${f.tipoCliente.padEnd(7)} | Vence: ${f.fechaVencimiento} | Días: ${String(f.diasHabilesRestantes).padStart(3)} | Estado: ${f.estado.padEnd(8)} | Mora: ₡${String(f.recargoMora).padStart(6)} | Alerta: ${f.alertaPrioridad}`);
  });

  console.log('\n--- DETALLE DE FACTURAS RECHAZADAS (AUDITORÍA DE ERRORES) ---');
  rechazadas.forEach(r => {
    const f = r.json;
    console.log(`  ✖ ID: ${f.id} | Cliente: ${f.cliente} | Motivo: ${f.motivoError}`);
  });

  console.log('\n======================================================================');
  console.log(' SIMULACIÓN FINALIZADA CON ÉXITO');
  console.log('======================================================================\n');
}

main().catch(console.error);
