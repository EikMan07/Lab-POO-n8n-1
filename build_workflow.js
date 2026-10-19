/**
 * build_workflow.js
 * Generador automático del archivo workflow-n8n.json.
 * Lee el código fuente real de codigo_nodo_n8n.js para garantizar que la
 * lógica del workflow permanezca 100% sincronizada con el modelo POO.
 */

const fs = require('fs');
const path = require('path');

const codigoNodoProcesar = fs.readFileSync(path.join(__dirname, 'codigo_nodo_n8n.js'), 'utf8');

const codigoAuditoriaRechazadas = `// ============================================================================
// NODO n8n: Code - Registro y Auditoría de Facturas Rechazadas (Error 1)
// MODO: Run Once for All Items
// DESCRIPCIÓN: Consolida y formatea las facturas que no superaron la validación
// de integridad (Error 1: montos <= 0, fechas corruptas, etc.) sin detener el flujo.
// ============================================================================

const facturasRechazadas = $input.all().map(i => i.json);

const informeAuditoria = facturasRechazadas.map(fac => ({
  id: fac.id || 'DESCONOCIDO',
  cliente: fac.cliente || '(Sin cliente)',
  monto: fac.monto,
  fechaEmision: fac.fechaEmision,
  estadoRegistro: 'RECHAZADA_POR_INTEGRIDAD',
  accionTomada: 'No se actualizó en JSON Server para proteger la base de datos',
  errorValidacion: true,
  motivoError: fac.motivoError || 'Fallo de validación de integridad de datos',
  timestampAuditoria: new Date().toISOString()
}));

return informeAuditoria.map(item => ({ json: item }));
`;

const workflow = {
  name: "Laboratorio 1 - Central de Facturación con Días Hábiles (POO)",
  nodes: [
    {
      parameters: {},
      id: "node-manual-trigger",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [180, 220]
    },
    {
      parameters: {
        rule: {
          interval: [
            {
              field: "cronExpression",
              expression: "0 8 * * *"
            }
          ]
        }
      },
      id: "node-schedule-trigger",
      name: "Schedule Trigger (08:00 AM)",
      type: "n8n-nodes-base.scheduleTrigger",
      typeVersion: 1.2,
      position: [180, 420]
    },
    {
      parameters: {
        method: "GET",
        url: "https://date.nager.at/api/v3/PublicHolidays/2026/CR",
        options: {}
      },
      id: "node-http-feriados",
      name: "Consultar Feriados CR API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [460, 220],
      onError: "continueRegularOutput",
      continueOnFail: true
    },
    {
      parameters: {
        method: "GET",
        url: "http://localhost:3000/facturas?estado=pendiente",
        options: {}
      },
      id: "node-http-facturas",
      name: "Obtener Facturas Pendientes",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [460, 420]
    },
    {
      parameters: {
        mode: "append"
      },
      id: "node-merge-inputs",
      name: "Sincronizar Entradas",
      type: "n8n-nodes-base.merge",
      typeVersion: 3,
      position: [720, 320]
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: codigoNodoProcesar
      },
      id: "node-code-procesar",
      name: "Procesar Facturas y Calendario (POO)",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [980, 320]
    },
    {
      parameters: {
        conditions: {
          options: {
            caseSensitive: true,
            leftValue: "",
            typeValidation: "strict"
          },
          conditions: [
            {
              id: "cond-valida",
              leftValue: "={{ $json.errorValidacion }}",
              rightValue: false,
              operator: {
                type: "boolean",
                operation: "equals"
              }
            }
          ],
          combinator: "and"
        }
      },
      id: "node-if-valida",
      name: "Factura Válida?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1240, 320]
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/facturas/{{ $json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estado\": \"{{ $json.estado }}\",\n  \"fechaVencimiento\": \"{{ $json.fechaVencimiento }}\",\n  \"diasHabilesRestantes\": {{ $json.diasHabilesRestantes }},\n  \"recargoMora\": {{ $json.recargoMora }},\n  \"montoTotalConMora\": {{ $json.montoTotalConMora }},\n  \"alertaPrioridad\": \"{{ $json.alertaPrioridad }}\"\n}",
        options: {}
      },
      id: "node-http-actualizar",
      name: "Actualizar Factura JSON Server",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1500, 220]
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: codigoAuditoriaRechazadas
      },
      id: "node-code-rechazadas",
      name: "Registro Auditoría Errores",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1500, 440]
    }
  ],
  connections: {
    "Manual Trigger": {
      main: [
        [
          {
            node: "Consultar Feriados CR API",
            type: "main",
            index: 0
          },
          {
            node: "Obtener Facturas Pendientes",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Schedule Trigger (08:00 AM)": {
      main: [
        [
          {
            node: "Consultar Feriados CR API",
            type: "main",
            index: 0
          },
          {
            node: "Obtener Facturas Pendientes",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Consultar Feriados CR API": {
      main: [
        [
          {
            node: "Sincronizar Entradas",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Obtener Facturas Pendientes": {
      main: [
        [
          {
            node: "Sincronizar Entradas",
            type: "main",
            index: 1
          }
        ]
      ]
    },
    "Sincronizar Entradas": {
      main: [
        [
          {
            node: "Procesar Facturas y Calendario (POO)",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Procesar Facturas y Calendario (POO)": {
      main: [
        [
          {
            node: "Factura Válida?",
            type: "main",
            index: 0
          }
        ]
      ]
    },
    "Factura Válida?": {
      main: [
        [
          {
            node: "Actualizar Factura JSON Server",
            type: "main",
            index: 0
          }
        ],
        [
          {
            node: "Registro Auditoría Errores",
            type: "main",
            index: 0
          }
        ]
      ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

const outputPath = path.join(__dirname, 'workflow-n8n.json');
fs.writeFileSync(outputPath, JSON.stringify(workflow, null, 2), 'utf8');
console.log(`✔ Archivo ${outputPath} generado exitosamente (${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB)`);
