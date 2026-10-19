// ============================================================================
// NODO n8n: Code - Procesar Facturas, Multimoneda y Tendencia (POO Extendido)
// MODO: Run Once for All Items
// DESCRIPCIÓN: Implementación en JavaScript ES6+ puro (POO) con:
// - CalendarioLaboral (Costa Rica 2026 + Contingencia)
// - Jerarquía con Herencia y Polimorfismo (FacturaNacional y FacturaInternacional)
// - Patrón Factory (FacturaFactory)
// - Conversión cambiaria dinámica (USD -> CRC vía API externa)
// - Análisis de Historial y Tendencia Financiera (HistorialTendencia)
// ============================================================================

// ----------------------------------------------------------------------------
// CLASE 1: CalendarioLaboral (POO pura)
// ----------------------------------------------------------------------------
class CalendarioLaboral {
  static FERIADOS_BASE_CR_2026 = [
    '2026-01-01', // Año Nuevo
    '2026-04-02', // Jueves Santo
    '2026-04-03', // Viernes Santo
    '2026-04-11', // Día de Juan Santamaría
    '2026-05-01', // Día Internacional del Trabajo
    '2026-07-25', // Anexión del Partido de Nicoya
    '2026-08-02', // Fiesta de Nuestra Señora de los Ángeles
    '2026-08-15', // Día de la Madre
    '2026-09-15', // Día de la Independencia
    '2026-12-01', // Día de la Abolición del Ejército
    '2026-12-25'  // Navidad
  ];

  constructor({ anio = 2026, pais = 'CR', feriadosRaw = [] } = {}) {
    this.anio = Number(anio) || 2026;
    this.pais = String(pais || 'CR').toUpperCase();
    this.modoContingenciaSinAPI = false;
    this.feriados = this.#normalizarFeriados(feriadosRaw);
  }

  #normalizarFeriados(raw) {
    const lista = [];
    if (Array.isArray(raw) && raw.length > 0) {
      for (const item of raw) {
        if (typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item)) {
          lista.push(item);
        } else if (item && typeof item === 'object' && item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
          lista.push(item.date);
        }
      }
    }

    if (lista.length === 0) {
      this.modoContingenciaSinAPI = true;
      return new Set(CalendarioLaboral.FERIADOS_BASE_CR_2026);
    }

    this.modoContingenciaSinAPI = false;
    return new Set(lista);
  }

  parsearFechaSegura(fecha) {
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
      return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
    }
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, a, m, d] = match.map(Number);
        return new Date(a, m - 1, d, 12, 0, 0);
      }
    }
    throw new Error(`Formato de fecha inválido: "${fecha}"`);
  }

  formatearFechaISO(fecha) {
    const d = this.parsearFechaSegura(fecha);
    const a = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${a}-${m}-${dia}`;
  }

  esFinDeSemana(fecha) {
    const dia = this.parsearFechaSegura(fecha).getDay();
    return dia === 0 || dia === 6;
  }

  esFeriado(fecha) {
    return this.feriados.has(this.formatearFechaISO(fecha));
  }

  esDiaHabil(fecha) {
    return !this.esFinDeSemana(fecha) && !this.esFeriado(fecha);
  }

  sumarDiasHabiles(fechaInicio, diasHabiles) {
    const plazo = Number(diasHabiles);
    if (isNaN(plazo) || plazo <= 0) {
      throw new Error(`Plazo de días hábiles inválido: ${diasHabiles}`);
    }

    const cursor = this.parsearFechaSegura(fechaInicio);
    let contados = 0;

    while (contados < plazo) {
      cursor.setDate(cursor.getDate() + 1);
      if (this.esDiaHabil(cursor)) {
        contados++;
      }
    }

    return this.formatearFechaISO(cursor);
  }

  contarDiasHabilesEntre(fechaInicio, fechaFin) {
    const f1 = this.parsearFechaSegura(fechaInicio).getTime();
    const f2 = this.parsearFechaSegura(fechaFin).getTime();

    if (f1 === f2) return 0;

    if (f1 < f2) {
      let dias = 0;
      const cur = new Date(f1);
      while (cur.getTime() < f2) {
        cur.setDate(cur.getDate() + 1);
        if (this.esDiaHabil(cur)) dias++;
      }
      return dias;
    }

    let atraso = 0;
    const cur = new Date(f2);
    while (cur.getTime() < f1) {
      cur.setDate(cur.getDate() + 1);
      if (this.esDiaHabil(cur)) atraso++;
    }
    return -atraso;
  }
}

// ----------------------------------------------------------------------------
// CLASE 2: Factura (Clase Base)
// ----------------------------------------------------------------------------
class Factura {
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

    const plazo = datos.plazoDiasHabiles;
    if (plazo === undefined || plazo === null || plazo === '') {
      this.plazoDiasHabiles = this.tipoCliente === 'vip' ? 20 : 15;
    } else {
      this.plazoDiasHabiles = Number(plazo);
    }

    this.fechaVencimiento = null;
    this.diasHabilesRestantes = null;
    this.recargoMora = 0;
    this.montoTotalConMora = this.monto;
    this.alertaPrioridad = 'NORMAL';

    this.errorValidacion = false;
    this.motivoError = null;

    this.validarDatos();
  }

  validarDatos() {
    const errores = [];
    if (!this.id) errores.push('El campo "id" es obligatorio');
    if (!this.cliente) errores.push('El campo "cliente" es obligatorio');
    if (typeof this.monto !== 'number' || isNaN(this.monto) || this.monto <= 0) {
      errores.push(`Monto inválido (${this.monto}): debe ser un número positivo mayor a 0`);
    }

    if (!this.fechaEmision || !/^\d{4}-\d{2}-\d{2}$/.test(this.fechaEmision)) {
      errores.push(`Fecha de emisión inválida: "${this.fechaEmision}" (formato requerido: YYYY-MM-DD)`);
    } else {
      const [y, m, d] = this.fechaEmision.split('-').map(Number);
      const testDate = new Date(y, m - 1, d);
      if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
        errores.push(`Fecha de emisión no existe en el calendario: "${this.fechaEmision}"`);
      }
    }

    if (typeof this.plazoDiasHabiles !== 'number' || isNaN(this.plazoDiasHabiles) || this.plazoDiasHabiles <= 0) {
      errores.push(`Plazo de días hábiles inválido: debe ser mayor a 0`);
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

  calcularFechaVencimiento(calendario) {
    if (this.errorValidacion) return null;
    this.fechaVencimiento = calendario.sumarDiasHabiles(this.fechaEmision, this.plazoDiasHabiles);
    return this.fechaVencimiento;
  }

  calcularDiasRestantes(calendario, fechaActual = new Date()) {
    if (this.errorValidacion) return null;
    if (!this.fechaVencimiento) this.calcularFechaVencimiento(calendario);
    const ref = calendario.formatearFechaISO(fechaActual);
    this.diasHabilesRestantes = calendario.contarDiasHabilesEntre(ref, this.fechaVencimiento);
    return this.diasHabilesRestantes;
  }

  evaluarEstado(calendario, fechaActual = new Date(), opciones = {}) {
    if (!this.validarDatos()) return this;

    this.calcularFechaVencimiento(calendario);
    const diasRestantes = this.calcularDiasRestantes(calendario, fechaActual);
    const fechaRefISO = calendario.formatearFechaISO(fechaActual);

    const estaVencida = fechaRefISO > this.fechaVencimiento;
    if (estaVencida && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    if (this.estado === 'vencida') {
      const porcentajeMora = this.tipoCliente === 'vip' ? 0.02 : 0.05;
      this.recargoMora = Math.round(this.monto * porcentajeMora * 100) / 100;
      this.montoTotalConMora = Math.round((this.monto + this.recargoMora) * 100) / 100;
      this.alertaPrioridad = 'VENCIDA - Cobro inmediato';
    } else {
      this.recargoMora = 0;
      this.montoTotalConMora = this.monto;
      if (diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3) {
        this.alertaPrioridad = 'ALTA - Próxima a vencer';
      } else {
        this.alertaPrioridad = 'NORMAL';
      }
    }

    return this;
  }

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

// ----------------------------------------------------------------------------
// CLASE 3: FacturaNacional (Subclase con Herencia)
// ----------------------------------------------------------------------------
class FacturaNacional extends Factura {
  constructor(datos = {}) {
    super({
      ...datos,
      categoria: 'nacional',
      moneda: datos.moneda || 'CRC'
    });
    this.tipoFactura = 'Nacional (CRC)';
    this.impuestoLocalPorcentaje = 0.13;
    this.tipoCambioAplicado = 1;
    this.montoCRC = this.monto;
    this.recargoMoraCRC = 0;
    this.montoTotalConMoraCRC = this.monto;
  }

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

// ----------------------------------------------------------------------------
// CLASE 4: FacturaInternacional (Subclase con Polimorfismo y Multimoneda)
// ----------------------------------------------------------------------------
class FacturaInternacional extends Factura {
  constructor(datos = {}) {
    super({
      ...datos,
      categoria: 'internacional',
      moneda: datos.moneda || 'USD'
    });
    this.tipoFactura = 'Internacional (USD)';
    this.diasTramiteBancario = 3; // Días adicionales trámite SWIFT
    this.comisionTransferenciaUSD = 25; // Comisión fija bancaria
    this.tipoCambioAplicado = null;
    this.montoCRC = null;
    this.recargoMoraCRC = null;
    this.montoTotalConMoraCRC = null;
  }

  evaluarEstado(calendario, fechaActual = new Date(), { tipoCambio = 500 } = {}) {
    if (!this.validarDatos()) return this;

    // Polimorfismo en plazo: suma días hábiles de trámite bancario
    const plazoEfectivo = this.plazoDiasHabiles + this.diasTramiteBancario;
    this.fechaVencimiento = calendario.sumarDiasHabiles(this.fechaEmision, plazoEfectivo);

    const ref = calendario.formatearFechaISO(fechaActual);
    this.diasHabilesRestantes = calendario.contarDiasHabilesEntre(ref, this.fechaVencimiento);

    const estaVencida = ref > this.fechaVencimiento;
    if (estaVencida && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    // Polimorfismo en mora internacional: mora porcentual + comisión fija SWIFT
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

    // Conversión cambiaria polimórfica a Colones (CRC)
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

// ----------------------------------------------------------------------------
// CLASE 5: FacturaFactory (Patrón Factory)
// ----------------------------------------------------------------------------
class FacturaFactory {
  static crear(datos = {}) {
    const categoria = String(datos.categoria || '').trim().toLowerCase();
    const moneda = String(datos.moneda || '').trim().toUpperCase();

    if (categoria === 'internacional' || moneda === 'USD') {
      return new FacturaInternacional(datos);
    }
    return new FacturaNacional(datos);
  }

  static crearDesdeJSON(datos) {
    return FacturaFactory.crear(datos);
  }
}

// ----------------------------------------------------------------------------
// CLASE 6: HistorialTendencia (Reto 4: Análisis de Tendencia Financiera)
// ----------------------------------------------------------------------------
class HistorialTendencia {
  constructor(historialPrevio = []) {
    this.historial = Array.isArray(historialPrevio) ? [...historialPrevio] : [];
  }

  analizarTendencia(ejecucionActual = {}) {
    const total = Number(ejecucionActual.totalFacturasEvaluadas) || 0;
    const vencidas = Number(ejecucionActual.cantidadFacturasVencidas) || 0;
    const montoVencido = Number(ejecucionActual.montoTotalVencido) || 0;

    const porcentajeActual = total > 0
      ? Math.round((vencidas / total) * 10000) / 100
      : 0;

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
        mensajeDiagnostico: 'Primer registro de ejecución. Sin historial previo.',
        timestampAnalisis: new Date().toISOString()
      };
    }

    const ultimoRegistro = this.historial[this.historial.length - 1];
    const porcentajePrevio = Number(ultimoRegistro.porcentajeMorosidad) || 0;
    const montoVencidoPrevio = Number(ultimoRegistro.montoTotalVencido) || 0;

    const sumaPorcentajes = this.historial.reduce((acc, r) => acc + (Number(r.porcentajeMorosidad) || 0), 0);
    const promedioHistorico = Math.round((sumaPorcentajes / this.historial.length) * 100) / 100;
    const variacionPorcentual = Math.round((porcentajeActual - porcentajePrevio) * 100) / 100;

    let estadoTendencia = 'ESTABLE';
    let alertaCritica = false;
    let mensajeDiagnostico = '';

    if (variacionPorcentual > 2.0 || montoVencido > montoVencidoPrevio * 1.15) {
      estadoTendencia = 'EMPEORANDO';
      alertaCritica = true;
      mensajeDiagnostico = `ALERTA CRÍTICA: Morosidad aumentó del ${porcentajePrevio}% al ${porcentajeActual}% (+${variacionPorcentual}%). Monto en mora subió a ₡${montoVencido.toLocaleString('es-CR')}.`;
    } else if (variacionPorcentual < -2.0) {
      estadoTendencia = 'MEJORANDO';
      alertaCritica = false;
      mensajeDiagnostico = `TENDENCIA POSITIVA: Morosidad disminuyó del ${porcentajePrevio}% al ${porcentajeActual}% (${variacionPorcentual}%).`;
    } else {
      estadoTendencia = 'ESTABLE';
      alertaCritica = false;
      mensajeDiagnostico = `TENDENCIA ESTABLE: Morosidad en ${porcentajeActual}% (variación ${variacionPorcentual}%).`;
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

  generarRegistroHistorico(ejecucionActual = {}, tendencia = {}) {
    return {
      id: `EJEC-${Date.now().toString().slice(-6)}`,
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

// ============================================================================
// ORQUESTACIÓN EN n8n CON FUSIÓN DE 4 FUENTES (Reto 2, 3 y 4)
// ============================================================================

const todosLosItems = $input.all().map(item => item.json);

// 1. Extracción de Feriados (Fuente 1: date.nager.at)
let feriadosRaw = [];
try {
  if (typeof $ !== 'undefined') {
    const nodoFeriados = $('Consultar Feriados CR API');
    if (nodoFeriados && typeof nodoFeriados.all === 'function') {
      feriadosRaw = nodoFeriados.all().map(i => i.json);
    }
  }
} catch (e) {}
if (feriadosRaw.length === 0) {
  feriadosRaw = todosLosItems.filter(i => i && i.date && (i.localName !== undefined || i.name !== undefined));
}

// 2. Extracción de Tipo de Cambio USD/CRC (Fuente 2: open.er-api.com)
let tipoCambioUSD = 518.50; // Fallback razonable
try {
  if (typeof $ !== 'undefined') {
    const nodoTC = $('Consultar Tipo de Cambio USD API');
    if (nodoTC && typeof nodoTC.all === 'function') {
      const tcItems = nodoTC.all().map(i => i.json);
      if (tcItems.length > 0 && tcItems[0].rates && tcItems[0].rates.CRC) {
        tipoCambioUSD = Number(tcItems[0].rates.CRC);
      }
    }
  }
} catch (e) {}
if (tipoCambioUSD === 518.50) {
  const itemTC = todosLosItems.find(i => i && i.rates && i.rates.CRC);
  if (itemTC) tipoCambioUSD = Number(itemTC.rates.CRC);
}

// 3. Extracción de Historial de Ejecuciones (Fuente 3: JSON Server /historial_ejecuciones)
let historialPrevio = [];
try {
  if (typeof $ !== 'undefined') {
    const nodoHistorial = $('Obtener Historial Ejecuciones');
    if (nodoHistorial && typeof nodoHistorial.all === 'function') {
      historialPrevio = nodoHistorial.all().map(i => i.json);
    }
  }
} catch (e) {}
if (historialPrevio.length === 0) {
  historialPrevio = todosLosItems.filter(i => i && i.porcentajeMorosidad !== undefined && i.id && i.id.startsWith('EJEC'));
}

// 4. Extracción de Facturas Pendientes (Fuente 4: JSON Server /facturas?estado=pendiente)
let facturasRaw = [];
try {
  if (typeof $ !== 'undefined') {
    const nodoFacturas = $('Obtener Facturas Pendientes');
    if (nodoFacturas && typeof nodoFacturas.all === 'function') {
      facturasRaw = nodoFacturas.all().map(i => i.json);
    }
  }
} catch (e) {}
if (facturasRaw.length === 0) {
  facturasRaw = todosLosItems.filter(i => i && i.id && i.id.startsWith('FAC-'));
}

// 5. Inicializar Calendario e Instanciar Facturas
const calendario = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw
});

const fechaActual = new Date();
const facturasValidas = [];
const facturasFinales = [];
let cantidadVencidas = 0;
let montoTotalVencidoCRC = 0;

for (const datos of facturasRaw) {
  try {
    const factura = FacturaFactory.crear(datos);

    if (factura.validarDatos()) {
      factura.evaluarEstado(calendario, fechaActual, { tipoCambio: tipoCambioUSD });
      if (factura.estado === 'vencida') {
        cantidadVencidas++;
        montoTotalVencidoCRC += (factura.montoTotalConMoraCRC || factura.montoTotalConMora || 0);
      }
      facturasValidas.push(factura);
    }

    const payload = factura.toJSON();
    payload.modoContingenciaSinAPI = calendario.modoContingenciaSinAPI;
    facturasFinales.push(payload);
  } catch (err) {
    facturasFinales.push({
      id: datos?.id ?? 'DESCONOCIDO',
      cliente: datos?.cliente ?? 'DESCONOCIDO',
      monto: datos?.monto ?? 0,
      fechaEmision: datos?.fechaEmision ?? '',
      estado: datos?.estado ?? 'rechazada',
      errorValidacion: true,
      motivoError: `Excepción no controlada: ${err.message}`,
      modoContingenciaSinAPI: calendario.modoContingenciaSinAPI
    });
  }
}

// 6. Análisis de Historial y Tendencia (Reto 4)
const analizador = new HistorialTendencia(historialPrevio);
const ejecucionActualMetricas = {
  totalFacturasEvaluadas: facturasValidas.length,
  cantidadFacturasVencidas: cantidadVencidas,
  montoTotalVencido: Math.round(montoTotalVencidoCRC * 100) / 100,
  porcentajeMorosidad: facturasValidas.length > 0
    ? Math.round((cantidadVencidas / facturasValidas.length) * 10000) / 100
    : 0
};

const diagnosticoTendencia = analizador.analizarTendencia(ejecucionActualMetricas);
const nuevoRegistroHistorico = analizador.generarRegistroHistorico(ejecucionActualMetricas, diagnosticoTendencia);

// 7. Enriquecer cada item con el diagnóstico de tendencia y datos para persistencia/notificación
const itemsSalida = facturasFinales.map(fac => ({
  ...fac,
  tipoCambioUSD,
  diagnosticoTendencia: diagnosticoTendencia.estadoTendencia,
  alertaCriticaTendencia: diagnosticoTendencia.alertaCritica,
  resumenDiagnostico: diagnosticoTendencia.mensajeDiagnostico,
  morosidadActualPorcentaje: diagnosticoTendencia.porcentajeActual,
  nuevoRegistroHistorico
}));

// Retorno bajo el contrato de n8n
return itemsSalida.map(item => ({ json: item }));
