/**
 * dominio_facturacion.js
 * Módulo consolidado de Dominio: CalendarioLaboral, Factura y ServicioFacturacion.
 * Arquitectura POO pura en JavaScript ES6+ sin dependencias externas.
 */

const { CalendarioLaboral } = require('./calendario_laboral');
const { Factura } = require('./factura');

/**
 * Servicio de Aplicación para orquestar el procesamiento en lote de facturas
 * tanto en scripts de pruebas independientes como en el nodo Code de n8n.
 */
class ServicioFacturacion {
  /**
   * Procesa un lote de facturas y feriados.
   * @param {Object} params
   * @param {Array<Object>} params.facturasRaw - Lista de facturas en formato plano
   * @param {Array<Object|string>} [params.feriadosRaw=[]] - Lista de feriados desde la API o vacía
   * @param {Date|string} [params.fechaReferencia=new Date()] - Fecha actual del sistema para evaluar vencimiento
   * @returns {Object} { facturas: Factura[], resumen: Object }
   */
  static procesarLote({ facturasRaw = [], feriadosRaw = [], fechaReferencia = new Date() } = {}) {
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

    for (const datos of facturasRaw) {
      try {
        const factura = new Factura(datos);

        if (factura.errorValidacion) {
          facturasRechazadas.push(factura);
          facturasProcesadas.push(factura);
          continue;
        }

        // Evaluar reglas de negocio RN1-RN5
        factura.evaluarEstado(calendario, fechaReferencia);

        if (factura.estado === 'vencida') {
          cantidadVencidas++;
        }
        if (factura.alertaPrioridad === 'ALTA - Próxima a vencer') {
          cantidadProximasVencer++;
        }

        facturasValidas.push(factura);
        facturasProcesadas.push(factura);
      } catch (error) {
        // Captura defensiva si el constructor u objeto lanza excepción no controlada
        const facturaConError = new Factura({
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

    const resumen = {
      totalRecibidas: facturasRaw.length,
      totalValidas: facturasValidas.length,
      totalRechazadas: facturasRechazadas.length,
      totalVencidas: cantidadVencidas,
      totalProximasVencer: cantidadProximasVencer,
      modoContingenciaSinAPI: calendario.modoContingenciaSinAPI,
      fechaEvaluacion: calendario.formatearFechaISO(fechaReferencia),
      feriadosAplicados: calendario.obtenerListaFeriados().length
    };

    return {
      calendario,
      facturas: facturasProcesadas,
      validas: facturasValidas,
      rechazadas: facturasRechazadas,
      resumen
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CalendarioLaboral,
    Factura,
    ServicioFacturacion
  };
}
