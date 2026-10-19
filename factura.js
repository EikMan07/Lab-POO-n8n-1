/**
 * factura.js
 * Módulo de Dominio: Entidad Factura y Reglas de Negocio Financieras.
 * Implementación en JavaScript ES6+ puro (POO sin librerías externas).
 */

class Factura {
  /**
   * @param {Object} datos
   * @param {string|number} datos.id - Identificador único de la factura
   * @param {string} datos.cliente - Nombre o razón social del cliente
   * @param {number} datos.monto - Monto original de la factura (debe ser > 0)
   * @param {string} datos.fechaEmision - Fecha de emisión en formato YYYY-MM-DD
   * @param {number} [datos.plazoDiasHabiles] - Plazo en días hábiles (RN2: si no se especifica, 20 para VIP, 15 para regular)
   * @param {string} [datos.tipoCliente='regular'] - Tipo de cliente ('regular' o 'vip')
   * @param {string} [datos.estado='pendiente'] - Estado actual ('pendiente', 'vigente', 'vencida', 'pagada')
   */
  constructor(datos = {}) {
    this.id = datos.id ?? null;
    this.cliente = datos.cliente ? String(datos.cliente).trim() : '';
    this.monto = typeof datos.monto === 'number' ? datos.monto : (datos.monto ? Number(datos.monto) : 0);
    this.fechaEmision = datos.fechaEmision ? String(datos.fechaEmision).trim() : '';
    this.tipoCliente = datos.tipoCliente ? String(datos.tipoCliente).trim().toLowerCase() : 'regular';
    this.estado = datos.estado ? String(datos.estado).trim().toLowerCase() : 'pendiente';

    // RN2: Plazo según tipo de cliente. Si no se especificó un plazo válido, VIP recibe 20 y regular 15.
    const plazoEspecificado = datos.plazoDiasHabiles;
    if (plazoEspecificado === undefined || plazoEspecificado === null || plazoEspecificado === '') {
      this.plazoDiasHabiles = this.tipoCliente === 'vip' ? 20 : 15;
    } else {
      this.plazoDiasHabiles = Number(plazoEspecificado);
    }

    // Propiedades calculadas
    this.fechaVencimiento = null;
    this.diasHabilesRestantes = null;
    this.recargoMora = 0;
    this.montoTotalConMora = this.monto;
    this.alertaPrioridad = 'NORMAL';

    // Control de Errores e Integridad (Error 1)
    this.errorValidacion = false;
    this.motivoError = null;

    // Validación automática inicial
    this.validarDatos();
  }

  /**
   * Valida la integridad de datos de la factura (Manejo de Caso de Error 1).
   * Captura campos obligatorios faltantes, montos no positivos o fechas inválidas.
   * @returns {boolean} true si es válida, false si contiene errores
   */
  validarDatos() {
    const errores = [];

    if (!this.id) {
      errores.push('El campo "id" es obligatorio');
    }

    if (!this.cliente) {
      errores.push('El campo "cliente" es obligatorio');
    }

    if (typeof this.monto !== 'number' || isNaN(this.monto) || this.monto <= 0) {
      errores.push(`Monto inválido (${this.monto}): debe ser un número positivo mayor a 0`);
    }

    if (!this.fechaEmision || !/^\d{4}-\d{2}-\d{2}$/.test(this.fechaEmision)) {
      errores.push(`Fecha de emisión inválida o faltante: "${this.fechaEmision}" (formato requerido: YYYY-MM-DD)`);
    } else {
      // Validar si la fecha representa un día de calendario real
      const [y, m, d] = this.fechaEmision.split('-').map(Number);
      const testDate = new Date(y, m - 1, d);
      if (
        testDate.getFullYear() !== y ||
        testDate.getMonth() !== m - 1 ||
        testDate.getDate() !== d
      ) {
        errores.push(`Fecha de emisión no existe en el calendario: "${this.fechaEmision}"`);
      }
    }

    if (typeof this.plazoDiasHabiles !== 'number' || isNaN(this.plazoDiasHabiles) || this.plazoDiasHabiles <= 0) {
      errores.push(`Plazo de días hábiles inválido (${this.plazoDiasHabiles}): debe ser mayor a 0`);
    }

    if (errores.length > 0) {
      this.errorValidacion = true;
      this.motivoError = errores.join('; ');
      return false;
    }

    this.errorValidacion = false;
    this.motivoError = null;
    return true;
  }

  /**
   * Calcula y asigna la fecha real de vencimiento utilizando la instancia de CalendarioLaboral (RN1).
   * @param {CalendarioLaboral} calendario
   * @returns {string|null}
   */
  calcularFechaVencimiento(calendario) {
    if (this.errorValidacion) {
      return null;
    }

    if (!calendario || typeof calendario.sumarDiasHabiles !== 'function') {
      throw new Error('Se requiere una instancia válida de CalendarioLaboral');
    }

    this.fechaVencimiento = calendario.sumarDiasHabiles(this.fechaEmision, this.plazoDiasHabiles);
    return this.fechaVencimiento;
  }

  /**
   * Calcula los días hábiles restantes o días de mora respecto a una fecha de referencia.
   * @param {CalendarioLaboral} calendario
   * @param {Date|string} [fechaActual=new Date()]
   * @returns {number|null}
   */
  calcularDiasRestantes(calendario, fechaActual = new Date()) {
    if (this.errorValidacion) {
      return null;
    }

    if (!this.fechaVencimiento) {
      this.calcularFechaVencimiento(calendario);
    }

    const fechaRef = calendario.formatearFechaISO(fechaActual);
    this.diasHabilesRestantes = calendario.contarDiasHabilesEntre(fechaRef, this.fechaVencimiento);
    return this.diasHabilesRestantes;
  }

  /**
   * Evalúa y aplica todas las Reglas de Negocio (RN1, RN2, RN3, RN4, RN5):
   * - RN1: Exclusión de inhábiles en fechaVencimiento.
   * - RN2: Plazo según cliente (ya inicializado en constructor).
   * - RN3: Si fechaActual > fechaVencimiento y estado === "pendiente", pasa a "vencida".
   * - RN4: Si estado === "vencida", recargo de mora (5% regular, 2% VIP).
   * - RN5: Si pendiente y 0 <= diasHabilesRestantes <= 3, alertaPrioridad = "ALTA - Próxima a vencer".
   *
   * @param {CalendarioLaboral} calendario
   * @param {Date|string} [fechaActual=new Date()]
   * @returns {Factura}
   */
  evaluarEstado(calendario, fechaActual = new Date()) {
    if (!this.validarDatos()) {
      return this;
    }

    // 1. Obtener fecha de vencimiento real y días restantes
    this.calcularFechaVencimiento(calendario);
    const diasRestantes = this.calcularDiasRestantes(calendario, fechaActual);
    const fechaRefISO = calendario.formatearFechaISO(fechaActual);

    // 2. RN3: Cambio automático a estado "vencida" si fechaActual > fechaVencimiento
    const estaVencidaPorFecha = fechaRefISO > this.fechaVencimiento;

    if (estaVencidaPorFecha && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    // 3. RN4: Cálculo de recargo por mora si la factura está vencida
    if (this.estado === 'vencida') {
      const porcentajeMora = this.tipoCliente === 'vip' ? 0.02 : 0.05;
      this.recargoMora = Math.round(this.monto * porcentajeMora * 100) / 100;
      this.montoTotalConMora = Math.round((this.monto + this.recargoMora) * 100) / 100;
      this.alertaPrioridad = 'VENCIDA - Cobro inmediato';
    } else {
      this.recargoMora = 0;
      this.montoTotalConMora = this.monto;

      // 4. RN5: Alerta de vencimiento próximo (si faltan 3 días hábiles o menos y no está vencida)
      if (diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3) {
        this.alertaPrioridad = 'ALTA - Próxima a vencer';
      } else {
        this.alertaPrioridad = 'NORMAL';
      }
    }

    return this;
  }

  /**
   * Genera el payload limpio listo para persistir en JSON Server o n8n.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      cliente: this.cliente,
      tipoCliente: this.tipoCliente,
      monto: this.monto,
      fechaEmision: this.fechaEmision,
      plazoDiasHabiles: this.plazoDiasHabiles,
      fechaVencimiento: this.fechaVencimiento,
      diasHabilesRestantes: this.diasHabilesRestantes,
      estado: this.estado,
      recargoMora: this.recargoMora,
      montoTotalConMora: this.montoTotalConMora,
      alertaPrioridad: this.alertaPrioridad,
      errorValidacion: this.errorValidacion,
      motivoError: this.motivoError
    };
  }
}

// Exportación compatible con Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Factura };
}
