/**
 * calendario_laboral.js
 * Módulo de Dominio: Calendario Laboral para Costa Rica y cálculo de días hábiles.
 * Implementación en JavaScript ES6+ puro (POO sin librerías externas).
 */

class CalendarioLaboral {
  /**
   * Lista oficial de contingencia para Costa Rica (CR) en el año 2026.
   * Se utiliza automáticamente si la API externa no está disponible o falla.
   */
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

  /**
   * @param {Object} opciones
   * @param {number} [opciones.anio=2026] - Año del calendario
   * @param {string} [opciones.pais='CR'] - Código ISO del país
   * @param {Array<string|Object>} [opciones.feriadosRaw=[]] - Array de feriados (strings 'YYYY-MM-DD' u objetos de API)
   */
  constructor({ anio = 2026, pais = 'CR', feriadosRaw = [] } = {}) {
    this.anio = Number(anio) || 2026;
    this.pais = String(pais || 'CR').toUpperCase();
    this.modoContingenciaSinAPI = false;

    // Inicializar y normalizar el conjunto de feriados
    this.feriados = this.#normalizarFeriados(feriadosRaw);
  }

  /**
   * Normaliza los feriados a un conjunto de cadenas 'YYYY-MM-DD'.
   * Si la lista de la API está vacía o es inválida, activa el modo de contingencia (RN Error 2).
   * @private
   */
  #normalizarFeriados(raw) {
    const listaNormalizada = [];

    if (Array.isArray(raw) && raw.length > 0) {
      for (const item of raw) {
        if (typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item)) {
          listaNormalizada.push(item);
        } else if (item && typeof item === 'object' && item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
          listaNormalizada.push(item.date);
        }
      }
    }

    // Si no se obtuvieron feriados válidos desde la API, activar contingencia
    if (listaNormalizada.length === 0) {
      this.modoContingenciaSinAPI = true;
      return new Set(CalendarioLaboral.FERIADOS_BASE_CR_2026);
    }

    this.modoContingenciaSinAPI = false;
    return new Set(listaNormalizada);
  }

  /**
   * Convierte una fecha (Date o string) a un objeto Date a medio día local (12:00:00)
   * para evitar anomalías por zona horaria o cambio de horario.
   * @param {Date|string} fecha
   * @returns {Date}
   */
  parsearFechaSegura(fecha) {
    if (fecha instanceof Date && !isNaN(fecha.getTime())) {
      return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 12, 0, 0);
    }
    if (typeof fecha === 'string') {
      const match = fecha.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, anio, mes, dia] = match.map(Number);
        return new Date(anio, mes - 1, dia, 12, 0, 0);
      }
    }
    throw new Error(`Formato de fecha inválido: "${fecha}" (se esperaba YYYY-MM-DD o Date)`);
  }

  /**
   * Formatea un objeto Date al estándar 'YYYY-MM-DD'.
   * @param {Date} fecha
   * @returns {string}
   */
  formatearFechaISO(fecha) {
    const d = this.parsearFechaSegura(fecha);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dia}`;
  }

  /**
   * Valida si una fecha corresponde a sábado (6) o domingo (0).
   * @param {Date|string} fecha
   * @returns {boolean}
   */
  esFinDeSemana(fecha) {
    const d = this.parsearFechaSegura(fecha);
    const diaSemana = d.getDay();
    return diaSemana === 0 || diaSemana === 6; // 0 = Domingo, 6 = Sábado
  }

  /**
   * Valida si una fecha coincide con algún feriado oficial registrado.
   * @param {Date|string} fecha
   * @returns {boolean}
   */
  esFeriado(fecha) {
    const fechaISO = this.formatearFechaISO(fecha);
    return this.feriados.has(fechaISO);
  }

  /**
   * Determina si un día es hábil (no es fin de semana ni feriado oficial).
   * @param {Date|string} fecha
   * @returns {boolean}
   */
  esDiaHabil(fecha) {
    return !this.esFinDeSemana(fecha) && !this.esFeriado(fecha);
  }

  /**
   * Calcula la fecha de vencimiento sumando días hábiles a partir del día siguiente a fechaInicio (RN1).
   * Avanza día por día en el calendario saltando estrictamente sábados, domingos y feriados.
   * @param {Date|string} fechaInicio - Fecha de emisión
   * @param {number} diasHabiles - Cantidad de días hábiles a otorgar (plazo)
   * @returns {string} Fecha de vencimiento en formato 'YYYY-MM-DD'
   */
  sumarDiasHabiles(fechaInicio, diasHabiles) {
    const plazo = Number(diasHabiles);
    if (isNaN(plazo) || plazo <= 0) {
      throw new Error(`El plazo de días hábiles debe ser un número entero mayor a 0 (recibido: ${diasHabiles})`);
    }

    const cursor = this.parsearFechaSegura(fechaInicio);
    let habilesContados = 0;

    // RN1: El conteo empieza el día siguiente a la fecha de emisión
    while (habilesContados < plazo) {
      cursor.setDate(cursor.getDate() + 1);
      if (this.esDiaHabil(cursor)) {
        habilesContados++;
      }
    }

    return this.formatearFechaISO(cursor);
  }

  /**
   * Cuenta los días hábiles entre dos fechas.
   * - Si fechaInicio < fechaFin: devuelve valor positivo (días hábiles restantes hasta el vencimiento).
   * - Si fechaInicio === fechaFin: devuelve 0.
   * - Si fechaInicio > fechaFin: devuelve valor negativo (días hábiles de mora transcurridos).
   * @param {Date|string} fechaInicio - Usualmente la fecha actual del sistema
   * @param {Date|string} fechaFin - Usualmente la fecha de vencimiento
   * @returns {number}
   */
  contarDiasHabilesEntre(fechaInicio, fechaFin) {
    const fInicio = this.parsearFechaSegura(fechaInicio);
    const fFin = this.parsearFechaSegura(fechaFin);

    const timeInicio = fInicio.getTime();
    const timeFin = fFin.getTime();

    if (timeInicio === timeFin) {
      return 0;
    }

    // Caso 1: fechaInicio < fechaFin (cuenta hacia adelante, días hábiles restantes)
    if (timeInicio < timeFin) {
      let dias = 0;
      const cursor = new Date(timeInicio);
      while (cursor.getTime() < timeFin) {
        cursor.setDate(cursor.getDate() + 1);
        if (this.esDiaHabil(cursor)) {
          dias++;
        }
      }
      return dias;
    }

    // Caso 2: fechaInicio > fechaFin (cuenta hacia atrás, días hábiles de mora transcurridos)
    let diasAtraso = 0;
    const cursor = new Date(timeFin);
    while (cursor.getTime() < timeInicio) {
      cursor.setDate(cursor.getDate() + 1);
      if (this.esDiaHabil(cursor)) {
        diasAtraso++;
      }
    }
    return -diasAtraso;
  }

  /**
   * Retorna la lista de feriados en formato Array para auditoría / inspección.
   * @returns {string[]}
   */
  obtenerListaFeriados() {
    return Array.from(this.feriados).sort();
  }
}

// Exportación compatible con Node.js / CommonJS y exportación limpia para n8n
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CalendarioLaboral };
}
