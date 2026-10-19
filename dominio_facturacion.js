/**
 * dominio_facturacion.js
 * Módulo consolidado de Dominio: CalendarioLaboral, Jerarquía Factura,
 * HistorialTendencia y ServicioFacturacion.
 * Arquitectura POO pura en JavaScript ES6+ sin dependencias externas.
 */

const { CalendarioLaboral } = require('./calendario_laboral');
const { Factura, FacturaNacional, FacturaInternacional, FacturaFactory } = require('./factura');
const { HistorialTendencia } = require('./historial_tendencia');

/**
 * Servicio de Aplicación para orquestar el procesamiento integral de facturas,
 * conversión multimoneda y análisis de tendencia de cobranza.
 */
class ServicioFacturacion {
  /**
   * Procesa un lote de facturas, aplica feriados, tipo de cambio y analiza la tendencia histórica.
   * @param {Object} params
   * @param {Array<Object>} params.facturasRaw - Lista de facturas en formato plano
   * @param {Array<Object|string>} [params.feriadosRaw=[]] - Lista de feriados desde la API o vacía
   * @param {Date|string} [params.fechaReferencia=new Date()] - Fecha del sistema
   * @param {number} [params.tipoCambioUSD=500] - Tipo de cambio USD a CRC
   * @param {Array<Object>} [params.historialPrevio=[]] - Registros históricos previos de JSON Server
   * @returns {Object}
   */
  static procesarLote({
    facturasRaw = [],
    feriadosRaw = [],
    fechaReferencia = new Date(),
    tipoCambioUSD = 500,
    historialPrevio = []
  } = {}) {
    // 1. Instanciar calendario laboral (activa contingencia si feriadosRaw está vacío o corrupto)
    const calendario = new CalendarioLaboral({
      anio: 2026,
      pais: 'CR',
      feriadosRaw
    });

    const facturasProcesadas = [];
    const facturasValidas = [];
    const facturasRechazadas = [];
    let cantidadVencidas = 0;
    let cantidadProximasVencer = 0;
    let montoTotalVencidoCRC = 0;

    for (const datos of facturasRaw) {
      try {
        // Uso de Factory Pattern para instanciar la subclase concreta
        const factura = FacturaFactory.crear(datos);

        if (factura.errorValidacion) {
          facturasRechazadas.push(factura);
          facturasProcesadas.push(factura);
          continue;
        }

        // Llamada al método polimórfico evaluarEstado con tipo de cambio
        factura.evaluarEstado(calendario, fechaReferencia, { tipoCambio: tipoCambioUSD });

        if (factura.estado === 'vencida') {
          cantidadVencidas++;
          montoTotalVencidoCRC += (factura.montoTotalConMoraCRC || factura.montoTotalConMora || 0);
        }
        if (factura.alertaPrioridad && factura.alertaPrioridad.includes('Próxima a vencer')) {
          cantidadProximasVencer++;
        }

        facturasValidas.push(factura);
        facturasProcesadas.push(factura);
      } catch (error) {
        // Captura defensiva si el constructor o la fábrica lanzan error inesperado
        const facturaConError = new FacturaNacional({
          id: datos?.id ?? 'DESCONOCIDO',
          cliente: datos?.cliente ?? 'DESCONOCIDO',
          monto: 0,
          fechaEmision: ''
        });
        facturaConError.errorValidacion = true;
        facturaConError.motivoError = `Excepción inesperada: ${error.message}`;
        facturasRechazadas.push(facturaConError);
        facturasProcesadas.push(facturaConError);
      }
    }

    // 2. Análisis de Historial y Tendencia (Reto 4)
    const analizadorTendencia = new HistorialTendencia(historialPrevio);
    const ejecucionActual = {
      totalFacturasEvaluadas: facturasValidas.length,
      cantidadFacturasVencidas: cantidadVencidas,
      montoTotalVencido: Math.round(montoTotalVencidoCRC * 100) / 100,
      porcentajeMorosidad: facturasValidas.length > 0
        ? Math.round((cantidadVencidas / facturasValidas.length) * 10000) / 100
        : 0
    };

    const diagnosticoTendencia = analizadorTendencia.analizarTendencia(ejecucionActual);
    const nuevoRegistroHistorico = analizadorTendencia.generarRegistroHistorico(ejecucionActual, diagnosticoTendencia);

    const resumen = {
      totalRecibidas: facturasRaw.length,
      totalValidas: facturasValidas.length,
      totalRechazadas: facturasRechazadas.length,
      totalVencidas: cantidadVencidas,
      totalProximasVencer: cantidadProximasVencer,
      montoTotalVencidoCRC: Math.round(montoTotalVencidoCRC * 100) / 100,
      tipoCambioAplicado: tipoCambioUSD,
      modoContingenciaSinAPI: calendario.modoContingenciaSinAPI,
      fechaEvaluacion: calendario.formatearFechaISO(fechaReferencia),
      feriadosAplicados: calendario.obtenerListaFeriados().length,
      tendencia: diagnosticoTendencia
    };

    return {
      calendario,
      facturas: facturasProcesadas,
      validas: facturasValidas,
      rechazadas: facturasRechazadas,
      resumen,
      nuevoRegistroHistorico
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CalendarioLaboral,
    Factura,
    FacturaNacional,
    FacturaInternacional,
    FacturaFactory,
    HistorialTendencia,
    ServicioFacturacion
  };
}
