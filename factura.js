/**
 * factura.js
 * Módulo de Dominio: Jerarquía de Clases con Herencia y Polimorfismo.
 * Implementación en JavaScript ES6+ puro (POO sin librerías externas).
 */

/**
 * CLASE BASE: Factura
 * Define la estructura fundamental, validaciones de integridad y reglas generales.
 */
class Factura {
  /**
   * @param {Object} datos
   * @param {string|number} datos.id - Identificador único de la factura
   * @param {string} datos.cliente - Nombre o razón social del cliente
   * @param {number} datos.monto - Monto de la factura (debe ser > 0)
   * @param {string} datos.fechaEmision - Fecha de emisión en formato YYYY-MM-DD
   * @param {number} [datos.plazoDiasHabiles] - Plazo en días hábiles (RN2: si no se especifica, 20 para VIP, 15 para regular)
   * @param {string} [datos.tipoCliente='regular'] - Tipo de cliente ('regular' o 'vip')
   * @param {string} [datos.estado='pendiente'] - Estado actual ('pendiente', 'vigente', 'vencida', 'pagada')
   * @param {string} [datos.categoria='nacional'] - Categoría ('nacional' o 'internacional')
   * @param {string} [datos.moneda='CRC'] - Moneda ('CRC' o 'USD')
   */
  constructor(datos = {}) {
    this.id = datos.id ?? null;
    this.cliente = datos.cliente ? String(datos.cliente).trim() : '';
    this.monto = typeof datos.monto === 'number' ? datos.monto : (datos.monto ? Number(datos.monto) : 0);
    this.fechaEmision = datos.fechaEmision ? String(datos.fechaEmision).trim() : '';
    this.tipoCliente = datos.tipoCliente ? String(datos.tipoCliente).trim().toLowerCase() : 'regular';
    this.estado = datos.estado ? String(datos.estado).trim().toLowerCase() : 'pendiente';
    this.categoria = datos.categoria ? String(datos.categoria).trim().toLowerCase() : 'nacional';
    this.moneda = datos.moneda ? String(datos.moneda).trim().toUpperCase() : 'CRC';
    this.tipoFactura = 'General';

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
    if (this.errorValidacion) return null;
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
    if (this.errorValidacion) return null;
    if (!this.fechaVencimiento) this.calcularFechaVencimiento(calendario);
    const fechaRef = calendario.formatearFechaISO(fechaActual);
    this.diasHabilesRestantes = calendario.contarDiasHabilesEntre(fechaRef, this.fechaVencimiento);
    return this.diasHabilesRestantes;
  }

  /**
   * Método polimórfico base: evalúa estado, morosidad y alertas.
   * Las subclases sobreescriben este método para personalizar reglas específicas.
   * @param {CalendarioLaboral} calendario
   * @param {Date|string} [fechaActual=new Date()]
   * @param {Object} [opciones={}]
   * @returns {Factura}
   */
  evaluarEstado(calendario, fechaActual = new Date(), opciones = {}) {
    if (!this.validarDatos()) return this;

    this.calcularFechaVencimiento(calendario);
    const diasRestantes = this.calcularDiasRestantes(calendario, fechaActual);
    const fechaRefISO = calendario.formatearFechaISO(fechaActual);

    // RN3: Si fechaActual > fechaVencimiento y estado === "pendiente" -> "vencida"
    const estaVencidaPorFecha = fechaRefISO > this.fechaVencimiento;
    if (estaVencidaPorFecha && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    // RN4: Recargo de mora estándar
    if (this.estado === 'vencida') {
      const porcentajeMora = this.tipoCliente === 'vip' ? 0.02 : 0.05;
      this.recargoMora = Math.round(this.monto * porcentajeMora * 100) / 100;
      this.montoTotalConMora = Math.round((this.monto + this.recargoMora) * 100) / 100;
      this.alertaPrioridad = 'VENCIDA - Cobro inmediato';
    } else {
      this.recargoMora = 0;
      this.montoTotalConMora = this.monto;

      // RN5: Alerta si restan 3 días hábiles o menos
      if (diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3) {
        this.alertaPrioridad = 'ALTA - Próxima a vencer';
      } else {
        this.alertaPrioridad = 'NORMAL';
      }
    }

    return this;
  }

  /**
   * Serialización estándar a JSON.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      cliente: this.cliente,
      categoria: this.categoria,
      moneda: this.moneda,
      tipoFactura: this.tipoFactura,
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

/**
 * SUBCLASE 1: FacturaNacional (Hereda de Factura)
 * Moneda oficial CRC, plazos estándar, IVA del 13% y recargos según ley local.
 */
class FacturaNacional extends Factura {
  constructor(datos = {}) {
    super({
      ...datos,
      categoria: 'nacional',
      moneda: datos.moneda || 'CRC'
    });

    this.tipoFactura = 'Nacional (CRC)';
    this.impuestoLocalPorcentaje = 0.13; // IVA Costa Rica 13%
    this.tipoCambioAplicado = 1;
    this.montoCRC = this.monto;
    this.recargoMoraCRC = 0;
    this.montoTotalConMoraCRC = this.monto;
  }

  /**
   * Sobreescritura polimórfica de evaluarEstado() para facturación nacional:
   * Aplica reglas tributarias y financieras en Colones costarricenses (CRC).
   */
  evaluarEstado(calendario, fechaActual = new Date(), opciones = {}) {
    super.evaluarEstado(calendario, fechaActual, opciones);

    this.tipoCambioAplicado = 1;
    this.montoCRC = this.monto;
    this.recargoMoraCRC = this.recargoMora;
    this.montoTotalConMoraCRC = this.montoTotalConMora;

    return this;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      impuestoLocalPorcentaje: this.impuestoLocalPorcentaje,
      tipoCambioAplicado: this.tipoCambioAplicado,
      montoCRC: this.montoCRC,
      recargoMoraCRC: this.recargoMoraCRC,
      montoTotalConMoraCRC: this.montoTotalConMoraCRC
    };
  }
}

/**
 * SUBCLASE 2: FacturaInternacional (Hereda de Factura)
 * Moneda USD, contempla 3 días hábiles adicionales por trámite bancario internacional (SWIFT),
 * aplica recargo de mora diferenciado con comisión fija bancaria y conversión cambiaria a CRC.
 */
class FacturaInternacional extends Factura {
  constructor(datos = {}) {
    super({
      ...datos,
      categoria: 'internacional',
      moneda: datos.moneda || 'USD'
    });

    this.tipoFactura = 'Internacional (USD)';
    this.diasTramiteBancario = 3; // Días hábiles adicionales por compensación bancaria SWIFT
    this.comisionTransferenciaUSD = 25; // Tarifa bancaria administrativa internacional ($25 USD)
    this.tipoCambioAplicado = null;
    this.montoCRC = null;
    this.recargoMoraCRC = null;
    this.montoTotalConMoraCRC = null;
  }

  /**
   * Sobreescritura polimórfica de evaluarEstado() para facturación internacional:
   * 1. Extiende el plazo efectivo sumando los días de trámite bancario internacional.
   * 2. Aplica regla propia de mora: porcentaje (5% o 2%) + comisión fija bancaria ($25 USD).
   * 3. Ejecuta conversión cambiaria a colones (CRC) utilizando la tasa de cambio en vivo o fallback.
   */
  evaluarEstado(calendario, fechaActual = new Date(), { tipoCambio = 500 } = {}) {
    if (!this.validarDatos()) return this;

    // 1. Polimorfismo en plazo: plazo contractual + días de trámite bancario
    const plazoEfectivo = this.plazoDiasHabiles + this.diasTramiteBancario;
    this.fechaVencimiento = calendario.sumarDiasHabiles(this.fechaEmision, plazoEfectivo);

    // 2. Conteo de días hábiles restantes con la nueva fecha de vencimiento internacional
    const ref = calendario.formatearFechaISO(fechaActual);
    this.diasHabilesRestantes = calendario.contarDiasHabilesEntre(ref, this.fechaVencimiento);

    const estaVencida = ref > this.fechaVencimiento;
    if (estaVencida && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    // 3. Polimorfismo en mora internacional: recargo porcentual + tarifa administrativa SWIFT
    if (this.estado === 'vencida') {
      const porcentajeMora = this.tipoCliente === 'vip' ? 0.02 : 0.05;
      const moraPorcentual = this.monto * porcentajeMora;
      this.recargoMora = Math.round((moraPorcentual + this.comisionTransferenciaUSD) * 100) / 100;
      this.montoTotalConMora = Math.round((this.monto + this.recargoMora) * 100) / 100;
      this.alertaPrioridad = 'VENCIDA - Cobro internacional prioritario';
    } else {
      this.recargoMora = 0;
      this.montoTotalConMora = this.monto;

      if (this.diasHabilesRestantes !== null && this.diasHabilesRestantes >= 0 && this.diasHabilesRestantes <= 3) {
        this.alertaPrioridad = 'ALTA - Próxima a vencer (Internacional)';
      } else {
        this.alertaPrioridad = 'NORMAL';
      }
    }

    // 4. Conversión cambiaria polimórfica a Colones (CRC)
    this.tipoCambioAplicado = Number(tipoCambio) || 500;
    this.montoCRC = Math.round(this.monto * this.tipoCambioAplicado * 100) / 100;
    this.recargoMoraCRC = Math.round(this.recargoMora * this.tipoCambioAplicado * 100) / 100;
    this.montoTotalConMoraCRC = Math.round(this.montoTotalConMora * this.tipoCambioAplicado * 100) / 100;

    return this;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      diasTramiteBancario: this.diasTramiteBancario,
      comisionTransferenciaUSD: this.comisionTransferenciaUSD,
      tipoCambioAplicado: this.tipoCambioAplicado,
      montoCRC: this.montoCRC,
      recargoMoraCRC: this.recargoMoraCRC,
      montoTotalConMoraCRC: this.montoTotalConMoraCRC
    };
  }
}

/**
 * PATRÓN FACTORY: FacturaFactory
 * Permite instanciar la subclase adecuada en tiempo de ejecución
 * desacoplando la creación de objetos del cliente que los consume.
 */
class FacturaFactory {
  /**
   * Crea una instancia concreta de Factura (Nacional o Internacional) según los datos.
   * @param {Object} datos
   * @returns {FacturaNacional|FacturaInternacional}
   */
  static crear(datos = {}) {
    const categoria = String(datos.categoria || '').trim().toLowerCase();
    const moneda = String(datos.moneda || '').trim().toUpperCase();

    if (categoria === 'internacional' || moneda === 'USD') {
      return new FacturaInternacional(datos);
    }

    return new FacturaNacional(datos);
  }

  /**
   * Alias explícito requerido por especificación de extensión
   */
  static crearDesdeJSON(datos) {
    return FacturaFactory.crear(datos);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    Factura,
    FacturaNacional,
    FacturaInternacional,
    FacturaFactory
  };
}
