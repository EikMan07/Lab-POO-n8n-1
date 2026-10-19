/**
 * build_workflow.js
 * Generador automático del archivo workflow-n8n.json para el Laboratorio #1 + Extensión.
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
  name: "Laboratorio 1 Extendido - Facturación Días Hábiles, Multimoneda y Tendencias (POO)",
  nodes: [
    {
      parameters: {},
      id: "node-manual-trigger",
      name: "Manual Trigger",
      type: "n8n-nodes-base.manualTrigger",
      typeVersion: 1,
      position: [100, 240]
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
      position: [100, 460]
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
      position: [380, 160],
      onError: "continueRegularOutput",
      continueOnFail: true
    },
    {
      parameters: {
        method: "GET",
        url: "https://open.er-api.com/v6/latest/USD",
        options: {}
      },
      id: "node-http-tipo-cambio",
      name: "Consultar Tipo de Cambio USD API",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [380, 320],
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
      position: [380, 480]
    },
    {
      parameters: {
        method: "GET",
        url: "http://localhost:3000/historial_ejecuciones",
        options: {}
      },
      id: "node-http-historial",
      name: "Obtener Historial Ejecuciones",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [380, 640],
      onError: "continueRegularOutput",
      continueOnFail: true
    },
    {
      parameters: {
        mode: "append",
        numberInputs: 4
      },
      id: "node-merge-fuentes",
      name: "Sincronizar Fuentes (Merge)",
      type: "n8n-nodes-base.merge",
      typeVersion: 3,
      position: [680, 400]
    },
    {
      parameters: {
        mode: "runOnceForAllItems",
        language: "javaScript",
        jsCode: codigoNodoProcesar
      },
      id: "node-code-procesar",
      name: "Procesar Facturas y Tendencia (POO)",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [940, 400]
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
      position: [1200, 400]
    },
    {
      parameters: {
        method: "PATCH",
        url: "=http://localhost:3000/facturas/{{ $json.id }}",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"estado\": \"{{ $json.estado }}\",\n  \"fechaVencimiento\": \"{{ $json.fechaVencimiento }}\",\n  \"diasHabilesRestantes\": {{ $json.diasHabilesRestantes }},\n  \"recargoMora\": {{ $json.recargoMora }},\n  \"montoTotalConMora\": {{ $json.montoTotalConMora }},\n  \"tipoCambioAplicado\": {{ $json.tipoCambioAplicado }},\n  \"montoCRC\": {{ $json.montoCRC }},\n  \"montoTotalConMoraCRC\": {{ $json.montoTotalConMoraCRC }},\n  \"alertaPrioridad\": \"{{ $json.alertaPrioridad }}\"\n}",
        options: {}
      },
      id: "node-http-actualizar",
      name: "Actualizar Factura JSON Server",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1460, 240]
    },
    {
      parameters: {
        maxItems: 1
      },
      id: "node-limit-historial",
      name: "Filtrar Unico Resumen Historial",
      type: "n8n-nodes-base.limit",
      typeVersion: 1,
      position: [1460, 400]
    },
    {
      parameters: {
        method: "POST",
        url: "http://localhost:3000/historial_ejecuciones",
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.nuevoRegistroHistorico) }}",
        options: {}
      },
      id: "node-http-guardar-historial",
      name: "Guardar Histórico JSON Server",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.2,
      position: [1720, 400],
      onError: "continueRegularOutput",
      continueOnFail: true
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
              id: "cond-vencida",
              leftValue: "={{ $json.estado }}",
              rightValue: "vencida",
              operator: {
                type: "string",
                operation: "equals"
              }
            },
            {
              id: "cond-empeorando",
              leftValue: "={{ $json.alertaCriticaTendencia }}",
              rightValue: true,
              operator: {
                type: "boolean",
                operation: "equals"
              }
            }
          ],
          combinator: "or"
        }
      },
      id: "node-if-critica",
      name: "Situación Crítica / Vencida?",
      type: "n8n-nodes-base.if",
      typeVersion: 2.2,
      position: [1720, 240]
    },
    {
      parameters: {
        fromEmail: "alertas-cobranza@facturacion-ticosoft.cr",
        toEmail: "gerencia-financiera@facturacion-ticosoft.cr",
        subject: "=🚨 ALERTA FINANCIERA: Factura {{ $json.id }} ({{ $json.cliente }}) | Tendencia {{ $json.diagnosticoTendencia }}",
        emailFormat: "html",
        html: "=<div style=\"font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;\">\n  <h2 style=\"color: #c62828; margin-top: 0;\">🚨 Alerta Crítica de Cobranza</h2>\n  <p style=\"font-size: 14px; color: #333;\">El sistema automatizado ha detectado morosidad o deterioro en la cartera:</p>\n  <table style=\"width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px;\">\n    <tr style=\"background-color: #fff;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Factura ID:</strong></td><td style=\"padding: 8px; border: 1px solid #ddd;\">{{ $json.id }} ({{ $json.tipoFactura }})</td></tr>\n    <tr style=\"background-color: #f9f9f9;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Cliente:</strong></td><td style=\"padding: 8px; border: 1px solid #ddd;\">{{ $json.cliente }} ({{ $json.tipoCliente }})</td></tr>\n    <tr style=\"background-color: #fff;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Monto Original:</strong></td><td style=\"padding: 8px; border: 1px solid #ddd;\">{{ $json.moneda === 'USD' ? '$' : '₡' }}{{ $json.monto }} {{ $json.moneda }}</td></tr>\n    <tr style=\"background-color: #f9f9f9;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Total con Mora (CRC):</strong></td><td style=\"padding: 8px; border: 1px solid #ddd; color: #c62828; font-weight: bold;\">₡{{ $json.montoTotalConMoraCRC || $json.montoTotalConMora }}</td></tr>\n    <tr style=\"background-color: #fff;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Días de Atraso:</strong></td><td style=\"padding: 8px; border: 1px solid #ddd;\">{{ $json.diasHabilesRestantes }} días hábiles</td></tr>\n    <tr style=\"background-color: #f9f9f9;\"><td style=\"padding: 8px; border: 1px solid #ddd;\"><strong>Tendencia Global:</strong></td><td style=\"padding: 8px; border: 1px solid #ddd; font-weight: bold;\">{{ $json.diagnosticoTendencia }} (Morosidad: {{ $json.morosidadActualPorcentaje }}%)</td></tr>\n  </table>\n  <p style=\"margin-top: 15px; font-size: 12px; color: #555;\"><strong>Diagnóstico:</strong> {{ $json.resumenDiagnostico }}</p>\n</div>",
        options: {}
      },
      id: "node-email-alerta",
      name: "Notificar Correo Situación Crítica",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2.1,
      position: [1980, 240],
      onError: "continueRegularOutput",
      continueOnFail: true
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
      position: [1460, 560]
    }
  ],
  connections: {
    "Manual Trigger": {
      main: [
        [
          { node: "Consultar Feriados CR API", type: "main", index: 0 },
          { node: "Consultar Tipo de Cambio USD API", type: "main", index: 0 },
          { node: "Obtener Facturas Pendientes", type: "main", index: 0 },
          { node: "Obtener Historial Ejecuciones", type: "main", index: 0 }
        ]
      ]
    },
    "Schedule Trigger (08:00 AM)": {
      main: [
        [
          { node: "Consultar Feriados CR API", type: "main", index: 0 },
          { node: "Consultar Tipo de Cambio USD API", type: "main", index: 0 },
          { node: "Obtener Facturas Pendientes", type: "main", index: 0 },
          { node: "Obtener Historial Ejecuciones", type: "main", index: 0 }
        ]
      ]
    },
    "Consultar Feriados CR API": {
      main: [
        [
          { node: "Sincronizar Fuentes (Merge)", type: "main", index: 0 }
        ]
      ]
    },
    "Consultar Tipo de Cambio USD API": {
      main: [
        [
          { node: "Sincronizar Fuentes (Merge)", type: "main", index: 1 }
        ]
      ]
    },
    "Obtener Facturas Pendientes": {
      main: [
        [
          { node: "Sincronizar Fuentes (Merge)", type: "main", index: 2 }
        ]
      ]
    },
    "Obtener Historial Ejecuciones": {
      main: [
        [
          { node: "Sincronizar Fuentes (Merge)", type: "main", index: 3 }
        ]
      ]
    },
    "Sincronizar Fuentes (Merge)": {
      main: [
        [
          { node: "Procesar Facturas y Tendencia (POO)", type: "main", index: 0 }
        ]
      ]
    },
    "Procesar Facturas y Tendencia (POO)": {
      main: [
        [
          { node: "Factura Válida?", type: "main", index: 0 }
        ]
      ]
    },
    "Factura Válida?": {
      main: [
        [
          { node: "Actualizar Factura JSON Server", type: "main", index: 0 },
          { node: "Filtrar Unico Resumen Historial", type: "main", index: 0 }
        ],
        [
          { node: "Registro Auditoría Errores", type: "main", index: 0 }
        ]
      ]
    },
    "Filtrar Unico Resumen Historial": {
      main: [
        [
          { node: "Guardar Histórico JSON Server", type: "main", index: 0 }
        ]
      ]
    },
    "Actualizar Factura JSON Server": {
      main: [
        [
          { node: "Situación Crítica / Vencida?", type: "main", index: 0 }
        ]
      ]
    },
    "Situación Crítica / Vencida?": {
      main: [
        [
          { node: "Notificar Correo Situación Crítica", type: "main", index: 0 }
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
