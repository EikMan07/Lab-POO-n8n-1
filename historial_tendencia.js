/**
 * historial_tendencia.js
 * Módulo de Dominio: Análisis de Historial y Tendencia Financiera (Reto 4).
 * Implementación en JavaScript ES6+ puro (POO sin librerías externas).
 */

class HistorialTendencia {
  /**
   * @param {Array<Object>} [historialPrevio=[]] - Registros históricos obtenidos desde JSON Server
   */
  constructor(historialPrevio = []) {
    this.historial = Array.isArray(historialPrevio) ? [...historialPrevio] : [];
  }

  /**
   * Analiza las métricas de la ejecución actual contrastándolas con el historial.
   * Determina si la situación financiera de cobranza está "MEJORANDO", "EMPEORANDO" o "ESTABLE".
   *
   * @param {Object} ejecucionActual
   * @param {number} ejecucionActual.totalFacturasEvaluadas
   * @param {number} ejecucionActual.cantidadFacturasVencidas
   * @param {number} ejecucionActual.montoTotalVencido - Monto total vencido expresado en CRC
   * @param {number} [ejecucionActual.porcentajeMorosidad]
   * @returns {Object} Diagnóstico detallado con estado de tendencia y banderas de criticidad
   */
  analizarTendencia(ejecucionActual = {}) {
    const total = Number(ejecucionActual.totalFacturasEvaluadas) || 0;
    const vencidas = Number(ejecucionActual.cantidadFacturasVencidas) || 0;
    const montoVencido = Number(ejecucionActual.montoTotalVencido) || 0;

    const porcentajeActual = total > 0
      ? Math.round((vencidas / total) * 10000) / 100
      : 0;

    // Caso 1: Sin historial previo registrado
    if (this.historial.length === 0) {
      return {
        estadoTendencia: 'ESTABLE',
        alertaCritica: false,
        porcentajeActual,
        porcentajePrevio: null,
        promedioHistorico: porcentajeActual,
        variacionPorcentual: 0,
        montoVencidoActual: montoVencido,
        montoVencidoPrevio: null,
        mensajeDiagnostico: 'Primer registro de ejecución. Sin historial comparativo previo en la base de datos.',
        timestampAnalisis: new Date().toISOString()
      };
    }

    // Caso 2: Con historial previo disponible
    const ultimoRegistro = this.historial[this.historial.length - 1];
    const porcentajePrevio = Number(ultimoRegistro.porcentajeMorosidad) || 0;
    const montoVencidoPrevio = Number(ultimoRegistro.montoTotalVencido) || 0;

    // Cálculo del promedio histórico de morosidad
    const sumaPorcentajes = this.historial.reduce((acc, reg) => acc + (Number(reg.porcentajeMorosidad) || 0), 0);
    const promedioHistorico = Math.round((sumaPorcentajes / this.historial.length) * 100) / 100;

    // Variación absoluta contra el último corte registrado
    const variacionPorcentual = Math.round((porcentajeActual - porcentajePrevio) * 100) / 100;

    let estadoTendencia = 'ESTABLE';
    let alertaCritica = false;
    let mensajeDiagnostico = '';

    // Criterio de clasificación de tendencia
    if (variacionPorcentual > 2.0 || montoVencido > montoVencidoPrevio * 1.15) {
      estadoTendencia = 'EMPEORANDO';
      alertaCritica = true;
      mensajeDiagnostico = `ALERTA CRÍTICA: La morosidad se incrementó del ${porcentajePrevio}% al ${porcentajeActual}% (+${variacionPorcentual}%). El monto vencido subió a ₡${montoVencido.toLocaleString('es-CR')}. Se requiere intervención urgente de cobranza.`;
    } else if (variacionPorcentual < -2.0) {
      estadoTendencia = 'MEJORANDO';
      alertaCritica = false;
      mensajeDiagnostico = `TENDENCIA POSITIVA: La morosidad disminuyó del ${porcentajePrevio}% al ${porcentajeActual}% (${variacionPorcentual}%). La cartera de clientes presenta una gestión de cobro efectiva.`;
    } else {
      estadoTendencia = 'ESTABLE';
      alertaCritica = false;
      mensajeDiagnostico = `TENDENCIA ESTABLE: La morosidad se mantiene en ${porcentajeActual}% (variación de ${variacionPorcentual}% respecto al corte previo del ${porcentajePrevio}%).`;
    }

    return {
      estadoTendencia,
      alertaCritica,
      porcentajeActual,
      porcentajePrevio,
      promedioHistorico,
      variacionPorcentual,
      montoVencidoActual: montoVencido,
      montoVencidoPrevio,
      mensajeDiagnostico,
      timestampAnalisis: new Date().toISOString()
    };
  }

  /**
   * Genera el payload de registro histórico listo para ser persistido en JSON Server (POST /historial_ejecuciones).
   * @param {Object} ejecucionActual
   * @param {Object} tendencia
   * @returns {Object}
   */
  generarRegistroHistorico(ejecucionActual = {}, tendencia = {}) {
    const idGenerado = `EJEC-${Date.now().toString().slice(-6)}`;
    return {
      id: idGenerado,
      fechaEjecucion: new Date().toISOString(),
      totalFacturasEvaluadas: Number(ejecucionActual.totalFacturasEvaluadas) || 0,
      cantidadFacturasVencidas: Number(ejecucionActual.cantidadFacturasVencidas) || 0,
      porcentajeMorosidad: tendencia.porcentajeActual ?? 0,
      montoTotalVencido: Number(ejecucionActual.montoTotalVencido) || 0,
      estadoTendencia: tendencia.estadoTendencia || 'ESTABLE',
      alertaCritica: Boolean(tendencia.alertaCritica)
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HistorialTendencia };
}
