# Laboratorio #1 + Extensión: Soluciones de Negocio (POO + n8n)
## Escenario 1: Central de Facturación con Días Hábiles, Multimoneda y Tendencias (Costa Rica 2026)

Este repositorio contiene la solución completa de grado empresarial para el **Laboratorio #1 y su Extensión**. La solución implementa un modelo de dominio puro en **JavaScript ES6+ Orientado a Objetos (Herencia, Polimorfismo y Patrón Factory)** integrado en un workflow de **n8n** conectado a **JSON Server**, dos APIs públicas en vivo (`date.nager.at` y `open.er-api.com`), persistencia de histórico y alertas automáticas por correo electrónico.

---

## 📋 Tabla de Contenidos

1. [Estructura del Proyecto](#-estructura-del-proyecto)
2. [Los 4 Retos de la Extensión Implementados](#-los-4-retos-de-la-extensión-implementados)
3. [Las 5 Reglas de Negocio Base (RN1 a RN5)](#-las-5-reglas-de-negocio-base-rn1-a-rn5)
4. [Manejo de Situaciones de Error (Error 1 y Error 2)](#-manejo-de-situaciones-de-error)
5. [Guía de Ejecución y Demostración Paso a Paso](#-guía-de-ejecución-y-demostración-paso-a-paso)
   - [Paso 1: Demostración POO Independiente (`main.js`)](#paso-1-demostración-poo-independiente-mainjs)
   - [Paso 2: Suite de Pruebas Automatizadas (`test_runner.js`)](#paso-2-suite-de-pruebas-automatizadas-test_runnerjs)
   - [Paso 3: Simulación en Vivo Multifuente (`simulacion_workflow.js`)](#paso-3-simulación-en-vivo-multifuente-simulacion_workflowjs)
   - [Paso 4: Levantar JSON Server](#paso-4-levantar-json-server)
   - [Paso 5: Importar y Ejecutar el Workflow en n8n (`workflow-n8n.json`)](#paso-5-importar-y-ejecutar-el-workflow-en-n8n-workflow-n8njson)
6. [Matriz de Trazabilidad de la Extensión](#-matriz-de-trazabilidad-de-la-extensión)
7. [Documentación de Arquitectura](#-documentación-de-arquitectura)

---

## 📂 Estructura del Proyecto

```text
Lab-POO-n8n-1/
├── main.js                 # PUNTO DE ENTRADA: Demostración POO en 5 secciones por consola (independiente de n8n)
├── calendario_laboral.js   # Clase CalendarioLaboral (POO pura, cálculo de días hábiles y contingencia CR 2026)
├── factura.js              # Jerarquía POO: Factura (base), FacturaNacional, FacturaInternacional y FacturaFactory
├── historial_tendencia.js  # Clase HistorialTendencia: Análisis comparativo de morosidad y diagnóstico (Reto 4)
├── dominio_facturacion.js  # Módulo consolidado de dominio y ServicioFacturacion
├── codigo_nodo_n8n.js      # Código JavaScript puro empaquetado para el nodo Code de n8n (sincronizado 100%)
├── db.json                 # Base de datos JSON Server con facturas multimoneda e historial_ejecuciones
├── test_runner.js          # Suite de 52 pruebas automatizadas independientes en Node.js puro
├── simulacion_workflow.js  # Simulación interactiva de las 4 fuentes en vivo y disparo de alertas
├── build_workflow.js       # Script que compila workflow-n8n.json a partir del código JS real
├── workflow-n8n.json       # Workflow exportado listo para importar en n8n (v2.43.7+)
├── LOGICA_NEGOCIO.md       # Documento exhaustivo de arquitectura, diagramas UML Mermaid y métricas
└── README.md               # Este archivo de documentación
```

---

## 🌟 Los 4 Retos de la Extensión Implementados

### 1. Reto 1: Jerarquía de Clases con Herencia y Polimorfismo
- **Clase Base:** `Factura` encapsula validaciones (`validarDatos`), propiedades base y serialización (`toJSON`).
- **Subclase `FacturaNacional` (`extends Factura`):**
  - Moneda: `CRC`.
  - Plazos crediticios estándar (15 días Regular / 20 días VIP).
  - Reglas tributarias locales (IVA 13%) y recargo de mora en colones.
- **Subclase `FacturaInternacional` (`extends Factura`):**
  - Moneda: `USD`.
  - **Polimorfismo en plazo:** Suma **3 días hábiles adicionales** por trámites bancarios internacionales SWIFT (`plazoEfectivo = plazoBase + 3`).
  - **Polimorfismo en mora:** Aplica tasa de mora (5% o 2%) + **$25 USD de comisión bancaria fija de transferencia**.
  - **Conversión cambiaria:** Convierte automáticamente los montos a colones (`montoCRC`, `montoTotalConMoraCRC`) según la tasa oficial de la API de tipo de cambio.
- **Patrón Factory:** `FacturaFactory.crearDesdeJSON(datos)` determina en tiempo de ejecución la subclase a instanciar según la categoría (`nacional` o `internacional`) o moneda (`CRC` o `USD`).

### 2. Reto 2: Segunda Fuente Externa + Nodo Merge Cuádruple
- Se conecta la API pública en tiempo real `https://open.er-api.com/v6/latest/USD` (sin API key) mediante un nuevo nodo HTTP Request con `Continue On Fail`.
- Un nodo **Merge** (`n8n-nodes-base.merge` con `numberInputs: 4`) unifica de forma síncrona:
  1. Feriados oficiales (`date.nager.at`).
  2. Tipo de cambio USD/CRC (`open.er-api.com`).
  3. Facturas pendientes (`JSON Server /facturas?estado=pendiente`).
  4. Historial previo (`JSON Server /historial_ejecuciones`).

### 3. Reto 3: Notificación Automática por Correo en Situación Crítica
- En la bifurcación final del workflow, un nodo condicional evalúa si la factura está en estado `"vencida"` o si la tendencia global es `"EMPEORANDO"`.
- Ante una situación crítica, un nodo `emailSend` envía automáticamente un reporte detallado con formato HTML a la gerencia de cobranzas (con `Continue On Fail` activado para no detener la ejecución si no hay servidor SMTP local).

### 4. Reto 4: Historial y Análisis de Tendencia Financiera
- Colección `"historial_ejecuciones"` en `db.json` con cortes históricos de ejecuciones previas.
- Clase `HistorialTendencia`: analiza la variación de morosidad ($\Delta$):
  - **`"EMPEORANDO"`:** Si la morosidad aumenta $> +2.0\%$ o el monto vencido sube $> 15\%$. Activa alerta crítica.
  - **`"MEJORANDO"`:** Si la morosidad disminuye $> -2.0\%$.
  - **`"ESTABLE"`:** Variaciones dentro del rango $\pm 2.0\%$.
- El workflow persiste el corte actual mediante `POST http://localhost:3000/historial_ejecuciones` limitando a un único registro consolidado.

---

## 💼 Las 5 Reglas de Negocio Base (RN1 a RN5)

1. **RN1 (Exclusión de inhábiles):** El conteo del plazo inicia el día hábil siguiente a la emisión y salta sábados, domingos y los 11 feriados oficiales de Costa Rica.
2. **RN2 (Plazo según tipo de cliente):** Clientes estándar reciben 15 días hábiles; clientes VIP reciben 20 días hábiles (a los que se suman 3 días si es internacional).
3. **RN3 (Cambio automático a "vencida"):** Si la fecha del sistema es estrictamente mayor al vencimiento y sigue pendiente, muta a `"vencida"`.
4. **RN4 (Recargo por mora polimórfico):** 5% para clientes regulares y 2% para VIP (más comisión SWIFT en facturación internacional).
5. **RN5 (Alerta de vencimiento próximo):** Si restan entre 0 y 3 días hábiles, se asigna prioridad `"ALTA - Próxima a vencer"`.

---

## 🛡 Manejo de Situaciones de Error

- **Error 1 (Facturas corruptas):** Captura montos `<= 0` o fechas inexistentes marcando `errorValidacion: true` y desviándolas a auditoría sin detener el flujo.
- **Error 2 (Caída de APIs externas):** Ambos nodos HTTP de las APIs externas tienen `Continue On Fail`. Si `date.nager.at` o `open.er-api.com` fallan, se activan los modos de contingencia con catálogos estáticos oficiales.

---

## 🚀 Guía de Ejecución y Demostración Paso a Paso

### Paso 1: Demostración POO Independiente (`main.js`)

Para comprobar las clases, herencia, polimorfismo y análisis de tendencia **sin requerir n8n ni JSON Server encendidos**:

```bash
node main.js
```

**Salida en consola:**
- **Sección 1:** Pruebas unitarias de `CalendarioLaboral`.
- **Sección 2:** Demostración polimórfica: `FacturaNacional` vs `FacturaInternacional` (plazos extendidos, conversión USD/CRC, comisiones SWIFT).
- **Sección 3:** Demostración de los 2 casos de error (captura de datos corruptos y contingencia de API).
- **Sección 4:** Análisis de tendencia histórica con diagnóstico de cobranza.
- **Sección 5:** Tablas comparativas limpias generadas con `console.table`.

---

### Paso 2: Suite de Pruebas Automatizadas (`test_runner.js`)

Para ejecutar la suite completa de 52 aserciones automatizadas:

```bash
node test_runner.js
```

---

### Paso 3: Simulación en Vivo Multifuente (`simulacion_workflow.js`)

Para probar la integración de red en vivo consumiendo las dos APIs externas (`date.nager.at` y `open.er-api.com`) y JSON Server:

```bash
node simulacion_workflow.js
```

---

### Paso 4: Levantar JSON Server

En una terminal dedicada dentro de `Lab-POO-n8n-1`:

```bash
npx json-server db.json --port 3000
```

Verifica los endpoints:
- `http://localhost:3000/facturas` (todas las facturas)
- `http://localhost:3000/facturas?estado=pendiente` (pendientes)
- `http://localhost:3000/historial_ejecuciones` (historial de tendencias)

---

### Paso 5: Importar y Ejecutar el Workflow en n8n (`workflow-n8n.json`)

1. Ingresa a tu panel de n8n en `http://localhost:5678`.
2. En el menú superior, selecciona **Workflows** ➔ **Import from File...** y elige [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/workflow-n8n.json).
3. Verás la arquitectura completa:
   - 2 Triggers (Manual + Schedule 08:00 AM).
   - 4 Nodos de Fuente (Feriados API + Tipo Cambio API + Facturas Pendientes + Historial Ejecuciones).
   - 1 Nodo Merge cuádruple (`Sincronizar Fuentes`).
   - 1 Nodo Code POO (`Procesar Facturas y Tendencia POO`).
   - 2 Nodos IF de bifurcación (`Factura Válida?` y `Situación Crítica / Vencida?`).
   - 2 Nodos de Actualización JSON Server (PATCH facturas y POST historial).
   - 1 Nodo Email de alerta (`Notificar Correo Situación Crítica`).
   - 1 Nodo de Auditoría de Rechazos (Log estructurado).
4. Haz clic en **Test workflow**. Observarás cómo se sincronizan las 4 fuentes, se actualizan las facturas y se dispara la alerta de correo.

---

## 📊 Matriz de Trazabilidad de la Extensión

| Componente del Reto | Archivo Principal | Clase / Método Clave | Verificación |
| :--- | :--- | :--- | :--- |
| **Reto 1: Herencia** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/factura.js) | `FacturaNacional extends Factura`, `FacturaInternacional extends Factura` | `test_runner.js` (Bloque 3) |
| **Reto 1: Polimorfismo** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/factura.js) | `evaluarEstado(calendario, fechaActual, { tipoCambio })` | `main.js` (Sección 2) |
| **Reto 1: Factory Pattern** | [factura.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/factura.js) | `FacturaFactory.crearDesdeJSON(datos)` | `main.js` (Sección 2) |
| **Reto 2: Segunda API Externa** | [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/workflow-n8n.json) | `Consultar Tipo de Cambio USD API` (`open.er-api.com`) | `simulacion_workflow.js` |
| **Reto 2: Nodo Merge Cuádruple** | [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/workflow-n8n.json) | `Sincronizar Fuentes (Merge)` (`numberInputs: 4`) | `workflow-n8n.json` |
| **Reto 3: Alerta por Correo** | [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/workflow-n8n.json) | `Notificar Correo Situación Crítica` (`emailSend`) | `workflow-n8n.json` |
| **Reto 4: HistorialTendencia** | [historial_tendencia.js](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/historial_tendencia.js) | `analizarTendencia()`, `generarRegistroHistorico()` | `test_runner.js` (Bloque 4) |
| **Reto 4: Persistencia Histórica** | [workflow-n8n.json](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/workflow-n8n.json) | `POST /historial_ejecuciones` | `main.js` (Sección 4) |

---

## 📖 Documentación de Arquitectura

Para detalles de modelado UML, especificaciones matemáticas de variación de morosidad y diagramas de flujo completos, consulta el archivo [LOGICA_NEGOCIO.md](file:///c:/Users/abark/OneDrive/Documentos/OneDrive/Escritorio/n8n/Lab-POO-n8n-1/LOGICA_NEGOCIO.md).
