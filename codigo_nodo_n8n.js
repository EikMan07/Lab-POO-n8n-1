// ============================================================================
// NODO n8n: Code - Procesar Facturas y Calendario Laboral (POO)
// MODO: Run Once for All Items
// DESCRIPCIÓN: Implementación en JavaScript ES6+ puro (POO) del Calendario
// Laboral para Costa Rica y la entidad Factura con las 5 Reglas de Negocio
// y manejo defensivo de fallos de red / datos corruptos.
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

    // Error 2: Si la API de feriados cayó o vino vacía, activar contingencia
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
    return dia === 0 || dia === 6; // 0=Domingo, 6=Sábado
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

    // RN1: El conteo empieza el día siguiente y salta fines de semana y feriados
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
// CLASE 2: Factura (POO pura)
// ----------------------------------------------------------------------------
class Factura {
  constructor(datos = {}) {
    this.id = datos.id ?? null;
    this.cliente = datos.cliente ? String(datos.cliente).trim() : '';
    this.monto = typeof datos.monto === 'number' ? datos.monto : (datos.monto ? Number(datos.monto) : 0);
    this.fechaEmision = datos.fechaEmision ? String(datos.fechaEmision).trim() : '';
    this.tipoCliente = datos.tipoCliente ? String(datos.tipoCliente).trim().toLowerCase() : 'regular';
    this.estado = datos.estado ? String(datos.estado).trim().toLowerCase() : 'pendiente';

    // RN2: Plazo según tipo de cliente (VIP recibe 20 días si no se especificó; regular 15)
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
      errores.push(`Fecha de emisión inválida: "${this.fechaEmision}" (requerido YYYY-MM-DD)`);
    } else {
      const [y, m, d] = this.fechaEmision.split('-').map(Number);
      const testDate = new Date(y, m - 1, d);
      if (testDate.getFullYear() !== y || testDate.getMonth() !== m - 1 || testDate.getDate() !== d) {
        errores.push(`Fecha de emisión no existe en el calendario: "${this.fechaEmision}"`);
      }
    }

    if (typeof this.plazoDiasHabiles !== 'number' || isNaN(this.plazoDiasHabiles) || this.plazoDiasHabiles <= 0) {
      errores.push(`Plazo inválido: debe ser mayor a 0`);
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

  evaluarEstado(calendario, fechaActual = new Date()) {
    if (!this.validarDatos()) return this;

    this.calcularFechaVencimiento(calendario);
    const diasRestantes = this.calcularDiasRestantes(calendario, fechaActual);
    const fechaRefISO = calendario.formatearFechaISO(fechaActual);

    // RN3: Si fechaActual > fechaVencimiento y sigue pendiente -> "vencida"
    const estaVencida = fechaRefISO > this.fechaVencimiento;
    if (estaVencida && this.estado === 'pendiente') {
      this.estado = 'vencida';
    }

    // RN4: Cálculo de recargo por mora
    if (this.estado === 'vencida') {
      const tasa = this.tipoCliente === 'vip' ? 0.02 : 0.05;
      this.recargoMora = Math.round(this.monto * tasa * 100) / 100;
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

// ============================================================================
// ORQUESTACIÓN EN n8n
// ============================================================================

const todosLosItems = $input.all().map(item => item.json);

// 1. Separar facturas de feriados recibidos por el Merge o llamadas previas
let feriadosRaw = [];
let facturasRaw = [];

// Intento por nodo origen si n8n tiene acceso a los nodos nombrados
try {
  if (typeof $ !== 'undefined') {
    const nodoFeriados = $('Consultar Feriados CR API');
    if (nodoFeriados && typeof nodoFeriados.all === 'function') {
      feriadosRaw = nodoFeriados.all().map(i => i.json);
    }
  }
} catch (e) {}

try {
  if (typeof $ !== 'undefined') {
    const nodoFacturas = $('Obtener Facturas Pendientes');
    if (nodoFacturas && typeof nodoFacturas.all === 'function') {
      facturasRaw = nodoFacturas.all().map(i => i.json);
    }
  }
} catch (e) {}

// Fallback robusto: clasificar desde $input.all() si vinieron unificados
if (facturasRaw.length === 0) {
  facturasRaw = todosLosItems.filter(item => item && item.id && (item.monto !== undefined || item.cliente !== undefined));
}
if (feriadosRaw.length === 0) {
  feriadosRaw = todosLosItems.filter(item => item && item.date && (item.localName !== undefined || item.name !== undefined));
}

// 2. Instanciar CalendarioLaboral (activa contingencia automáticamente si la API falló)
const calendario = new CalendarioLaboral({
  anio: 2026,
  pais: 'CR',
  feriadosRaw
});

// 3. Fecha del sistema para evaluación
const fechaActual = new Date();

// 4. Procesar cada factura con POO y capturar errores individuales sin romper el lote
const facturasFinales = [];

for (const datos of facturasRaw) {
  try {
    const factura = new Factura(datos);

    if (!factura.errorValidacion) {
      factura.evaluarEstado(calendario, fechaActual);
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

// Contrato de salida n8n: Arreglo de objetos { json: {...} }
return facturasFinales.map(f => ({ json: f }));
