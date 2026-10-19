# Laboratorio #1: Soluciones de Negocio (POO + n8n)
## Escenario 1: Central de Facturación con Días Hábiles (Costa Rica 2026)

Este repositorio contiene la solución completa de grado empresarial para el **Escenario 1: Central de Facturación con Días Hábiles**. La solución implementa un modelo de dominio puro en **JavaScript ES6+ Orientado a Objetos (sin frameworks ni dependencias externas)** integrado en un workflow de **n8n** conectado a **JSON Server** y a la API pública de feriados de Costa Rica (`date.nager.at`).

---

## 📋 Tabla de Contenidos

1. [Estructura del Proyecto](#-estructura-del-proyecto)
2. [Requisitos Previos](#-requisitos-previos)
3. [Las 5 Reglas de Negocio (RN)](#-las-5-reglas-de-negocio-rn)
4. [Manejo de Situaciones de Error](#-manejo-de-situaciones-de-error)
5. [Guía de Ejecución Paso a Paso](#-guía-de-ejecución-paso-a-paso)
   - [Paso 1: Levantar JSON Server](#paso-1-levantar-json-server)
   - [Paso 2: Ejecutar la Suite de Pruebas Independientes](#paso-2-ejecutar-la-suite-de-pruebas-independientes)
   - [Paso 3: Ejecutar la Simulación en Vivo](#paso-3-ejecutar-la-simulación-en-vivo)
   - [Paso 4: Importar y Ejecutar el Workflow en n8n](#paso-4-importar-y-ejecutar-el-workflow-en-n8n)
   - [Paso 5: Demostración de Modo de Contingencia (Error 2)](#paso-5-demostración-de-modo-de-contingencia-error-2)
6. [Matriz de Trazabilidad](#-matriz-de-trazabilidad)
7. [Documentación Adicional](#-documentación-adicional)

---

## 📂 Estructura del Proyecto

```text
Laboratorio-1/
├── calendario_laboral.js   # Clase CalendarioLaboral (POO pura, cálculo de días hábiles y contingencia)
├── factura.js              # Clase Factura (POO pura, validaciones, reglas RN1-RN5, mora y alertas)
├── dominio_facturacion.js  # Módulo consolidado de dominio y ServicioFacturacion
├── codigo_nodo_n8n.js      # Código JavaScript puro empaquetado para el nodo Code de n8n
├── db.json                 # Base de datos inicial para JSON Server con casos de prueba
├── test_runner.js          # Suite de 38 pruebas automatizadas independientes en Node.js puro
├── simulacion_workflow.js  # Simulación interactiva en vivo del workflow de n8n contra JSON Server
├── build_workflow.js       # Script que genera el archivo JSON de n8n sincronizado con el código POO
├── workflow-n8n.json       # Workflow exportado listo para importar en n8n (2.43.7+)
├── LOGICA_NEGOCIO.md       # Documento exhaustivo de arquitectura, reglas, diagramas UML y de flujo
└── README.md               # Este archivo de documentación
```

---

## ⚙ Requisitos Previos

- **Node.js**: v18.0.0 o superior (`node -v`)
- **JSON Server**: v1.0.0-beta o superior (`npx json-server --version`)
- **n8n**: Instalación local o en la nube (`n8n --version` o acceso a interfaz web en `http://localhost:5678`)
- Conexión a Internet para consultar la API pública `https://date.nager.at/api/v3/PublicHolidays/2026/CR` (si se pierde la conexión, el sistema activa automáticamente su modo de contingencia).

---

## 💼 Las 5 Reglas de Negocio (RN)

1. **RN1 (Exclusión de inhábiles):** El conteo del plazo de vencimiento inicia el día siguiente a la `fechaEmision` y salta estrictamente sábados, domingos y los 11 feriados oficiales de Costa Rica devueltos por `date.nager.at`.
2. **RN2 (Plazo según tipo de cliente):** Las facturas estándar otorgan **15 días hábiles**. Si `tipoCliente === "vip"` y no se especificó un plazo explícito, se otorgan **20 días hábiles**. Si se indica un plazo personalizado válido, se respeta.
3. **RN3 (Cambio automático a "vencida"):** Si la fecha actual del sistema es estrictamente mayor a la `fechaVencimiento` calculada y la factura está `"pendiente"`, su estado cambia automáticamente a `"vencida"`.
4. **RN4 (Cálculo de recargo por mora):** Toda factura en estado `"vencida"` recibe un recargo administrativo:
   - **Cliente Regular:** 5% sobre el monto original.
   - **Cliente VIP:** 2% preferencial sobre el monto original.
   - Se calcula y persiste el `recargoMora` y el `montoTotalConMora`.
5. **RN5 (Alerta de vencimiento próximo):** Si una factura sigue `"pendiente"` pero le quedan 3 días hábiles o menos (`0 <= diasHabilesRestantes <= 3`), se le asigna `alertaPrioridad: "ALTA - Próxima a vencer"`. En caso contrario, mantiene `"NORMAL"`.

---

## 🛡 Manejo de Situaciones de Error

### Error 1: Datos Incompletos o Corruptos en Facturas
- **Caso:** Facturas con montos no positivos (`monto <= 0`), fechas corruptas o no existentes (ej. `2026-02-31`) o campos obligatorios vacíos.
- **Solución:** La clase `Factura` captura los errores mediante `validarDatos()`, marca `errorValidacion: true` y registra la causa en `motivoError`. En n8n, el nodo `IF` desvía estas facturas a la rama de **Auditoría de Rechazos** sin detener la ejecución de las demás facturas ni corromper JSON Server.

### Error 2: Fallo o Caída de la API Externa de Feriados
- **Caso:** Caída de red, error HTTP 500 o respuesta vacía en `date.nager.at`.
- **Solución:** El nodo HTTP Request de n8n tiene `continueOnFail: true` / `onError: "continueRegularOutput"`. La clase `CalendarioLaboral` detecta la ausencia de datos y activa automáticamente su **Modo de Contingencia** (`modoContingenciaSinAPI: true`), cargando el catálogo oficial base `FERIADOS_BASE_CR_2026` para calcular con total precisión.

---

## 🚀 Guía de Ejecución Paso a Paso

### Paso 1: Levantar JSON Server

Abre una terminal en la carpeta `Laboratorio-1` y ejecuta:

```bash
npx json-server db.json --port 3000
```

Verifica la base de datos en tu navegador o terminal:
- `http://localhost:3000/facturas` (ver todas)
- `http://localhost:3000/facturas?estado=pendiente` (solo pendientes)

---

### Paso 2: Ejecutar la Suite de Pruebas Independientes

En otra terminal, ejecuta el runner de pruebas automatizadas:

```bash
node test_runner.js
```

**Resultado esperado:**
```text
======================================================================
 LABORATORIO #1: SOLUCIONES DE NEGOCIO (POO + n8n) - SUITE DE PRUEBAS
 Escenario 1: Central de Facturación con Días Hábiles (Costa Rica 2026)
======================================================================

1. Pruebas Unitarias: CalendarioLaboral (POO pura)
  ✔ [PASS] Sábado 2026-09-12 es fin de semana
  ✔ [PASS] Domingo 2026-09-13 es fin de semana
  ✔ [PASS] Lunes 2026-09-14 NO es fin de semana
  ✔ [PASS] 2026-09-15 (Independencia) es feriado oficial
  ...
2. Pruebas de Reglas de Negocio (RN1 - RN5)
  ✔ [PASS] RN1: sumarDiasHabiles("2026-09-10", 15) calcula exactamente "2026-10-02"
  ✔ [PASS] RN2: Factura regular sin plazo asigna 15 días hábiles
  ✔ [PASS] RN2: Factura VIP sin plazo asigna 20 días hábiles
  ✔ [PASS] RN3: Factura regular cambia a estado "vencida"
  ✔ [PASS] RN4: Recargo de mora regular es 5% de 250,000 = 12,500
  ✔ [PASS] RN4: Recargo de mora VIP es 2% de 800,000 = 16,000
  ✔ [PASS] RN5: Se asigna alertaPrioridad "ALTA - Próxima a vencer"
3. Pruebas de Situaciones de Error Obligatorias
  ✔ [PASS] Error 1A: Captura factura con monto <= 0 marcando errorValidacion = true
  ✔ [PASS] Error 1B: Captura factura con fecha de emisión inexistente o corrupta
  ✔ [PASS] Error 2: Si la API de feriados falla, activa modoContingenciaSinAPI = true
4. Prueba de Integración: Procesamiento de Lote db.json
  ✔ [PASS] Recibe 7 facturas pendientes
  ✔ [PASS] 5 facturas superan la validación de integridad
  ✔ [PASS] 2 facturas son rechazadas por datos corruptos

----------------------------------------------------------------------
RESUMEN DE PRUEBAS: Total: 38 | Exitosas: 38 | Fallidas: 0
✔ TODAS LAS PRUEBAS PASARON EXITOSAMENTE.
```

---

### Paso 3: Ejecutar la Simulación en Vivo

Para validar la comunicación HTTP en vivo con JSON Server y la API de feriados antes de ir a n8n:

```bash
node simulacion_workflow.js
```

Este script ejecuta en vivo exactamente el mismo código que corre dentro de n8n, mostrando las facturas válidas que se actualizarán y las rechazadas que irán a auditoría.

---

### Paso 4: Importar y Ejecutar el Workflow en n8n

1. Abre tu instancia local de **n8n** en `http://localhost:5678`.
2. En el menú superior derecho, haz clic en **Workflows** ➔ **Import from File...** (o presiona `Ctrl + O`).
3. Selecciona el archivo `workflow-n8n.json` ubicado en `Laboratorio-1/workflow-n8n.json`.
4. Observarás la arquitectura de nodos completamente configurada:
   - **Manual Trigger** y **Schedule Trigger** (08:00 AM diarios).
   - **Consultar Feriados CR API** (`GET https://date.nager.at/api/v3/PublicHolidays/2026/CR` con `Continue on Fail`).
   - **Obtener Facturas Pendientes** (`GET http://localhost:3000/facturas?estado=pendiente`).
   - **Sincronizar Entradas** (Merge: Append).
   - **Procesar Facturas y Calendario (POO)** (Nodo Code con la lógica completa).
   - **Factura Válida?** (Nodo IF evaluando `errorValidacion === false`).
   - **Actualizar Factura JSON Server** (Rama Válida: `PATCH http://localhost:3000/facturas/{{ $json.id }}`).
   - **Registro Auditoría Errores** (Rama Rechazada: Log estructurado de facturas corruptas).
5. Haz clic en **Test workflow** (o **Execute workflow**).
6. Verifica en `db.json` o en `http://localhost:3000/facturas`: las facturas válidas habrán sido actualizadas con su nuevo estado, fecha de vencimiento, recargo de mora y alerta, mientras que las facturas inválidas permanecen aisladas en el informe de auditoría.

---

### Paso 5: Demostración de Modo de Contingencia (Error 2)

Para demostrar en vivo la resiliencia del sistema ante una caída de la API de feriados:

1. En n8n, edita el nodo **Consultar Feriados CR API** y cambia la URL a una inexistente: `https://date.nager.at/api/v3/PublicHolidays/2026/FALLO_SIMULADO`.
2. Ejecuta el workflow.
3. Observarás que:
   - El nodo no detiene el workflow gracias a `Continue On Fail`.
   - La clase `CalendarioLaboral` detecta la respuesta de error y activa `modoContingenciaSinAPI = true`.
   - Las fechas de vencimiento se calculan de manera idéntica utilizando el catálogo de contingencia de 11 feriados oficiales de Costa Rica 2026.

---

## 📊 Matriz de Trazabilidad

| Requerimiento | Archivo de Implementación | Clase / Método Clave | Prueba Unitaria en `test_runner.js` |
| :--- | :--- | :--- | :--- |
| **Clase CalendarioLaboral** | [calendario_laboral.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/calendario_laboral.js) | `class CalendarioLaboral` | Bloque 1 (12 assertions) |
| **Días Hábiles y Fines de Semana** | [calendario_laboral.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/calendario_laboral.js) | `esFinDeSemana()`, `esDiaHabil()` | `esFinDeSemana`, `esDiaHabil` |
| **Consulta de Feriados API** | [calendario_laboral.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/calendario_laboral.js) | `#normalizarFeriados()` | `esFeriado('2026-09-15') === true` |
| **RN1: Conteo de Plazo Hábil** | [calendario_laboral.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/calendario_laboral.js) | `sumarDiasHabiles()` | `sumarDiasHabiles('2026-09-10', 15) === '2026-10-02'` |
| **Clase Factura** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `class Factura` | Bloque 2 (14 assertions) |
| **RN2: Plazo según Cliente (VIP/Reg)** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `constructor()` | `facVIP.plazoDiasHabiles === 20` |
| **RN3: Cambio automático a vencida** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `evaluarEstado()` | `facVencidaRegular.estado === 'vencida'` |
| **RN4: Recargo de mora (5% / 2%)** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `evaluarEstado()` | Mora Regular: ₡12,500; Mora VIP: ₡16,000 |
| **RN5: Alerta de vencimiento <= 3 días**| [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `evaluarEstado()` | `alertaPrioridad: 'ALTA - Próxima a vencer'` |
| **Error 1: Factura Corrupta / Inválida**| [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/factura.js) | `validarDatos()` | Bloque 3 (`FAC-005`, `FAC-006`) |
| **Error 2: Fallo API / Contingencia** | [calendario_laboral.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/calendario_laboral.js) | `#normalizarFeriados()` | Bloque 3 (`modoContingenciaSinAPI === true`) |
| **Workflow n8n Completo** | [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/workflow-n8n.json) | 9 Nodos interconectados | `simulacion_workflow.js` |

---

## 📖 Documentación Adicional

Para un análisis detallado de la arquitectura de software, diagramas de clases en Mermaid, máquina de estados y justificaciones técnicas, consulta el documento [LOGICA_NEGOCIO.md](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Laboratorio-1/LOGICA_NEGOCIO.md).
