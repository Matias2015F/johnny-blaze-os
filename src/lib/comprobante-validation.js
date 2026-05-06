/**
 * VALIDACIÓN DE COMPROBANTES
 * Sistema de verificación anti-falsificación para PDFs
 */

/**
 * Valida un comprobante verificando su autenticidad
 * @param {string} numeroComprobante - Número a validar: JBO-20260505-123456-7
 * @param {object} snapshot - Datos capturados al generar comprobante
 * @param {object} ordenOriginal - Orden original desde BD
 * @returns {object} Resultado de validación
 */
export const validarComprobante = (numeroComprobante, snapshot, ordenOriginal) => {
  try {
    if (!numeroComprobante || !snapshot || !ordenOriginal) {
      return {
        valido: false,
        razon: 'Datos incompletos para validación',
        detalles: null
      };
    }

    // 1. VALIDAR FORMATO: JBO-YYYYMMDD-HHMMSS-CHECKSUM
    const regex = /^JBO-\d{8}-\d{6}-\d{1}$/;
    if (!regex.test(numeroComprobante)) {
      return {
        valido: false,
        razon: 'Formato de comprobante inválido - Posible falsificación',
        detalles: null
      };
    }

    // 2. VALIDAR CHECKSUM
    const partes = numeroComprobante.split('-');
    const checksumIngresado = parseInt(partes[3]);
    const parte1 = partes[1] + partes[2]; // YYYYMMDDHHMMSS

    const checksumCalculado = parseInt(
      String(parte1.split('').reduce((a, b) => parseInt(a) + parseInt(b), 0) % 10)
    );

    if (checksumIngresado !== checksumCalculado) {
      return {
        valido: false,
        razon: 'Checksum inválido - Documento falsificado o alterado',
        detalles: null
      };
    }

    // 3. VALIDAR HASH DE INTEGRIDAD
    if (snapshot.hash && ordenOriginal.snapshotFinal?.hash) {
      if (snapshot.hash !== ordenOriginal.snapshotFinal.hash) {
        return {
          valido: false,
          razon: 'Hash no coincide - Documento ha sido modificado',
          detalles: null
        };
      }
    }

    // 4. VALIDAR QUE NO SEA FUTURO
    const fechaComprobante = new Date(partes[1].slice(0, 4) + '-' + partes[1].slice(4, 6) + '-' + partes[1].slice(6, 8));
    const ahora = new Date();
    if (fechaComprobante > ahora) {
      return {
        valido: false,
        razon: 'Fecha de comprobante es futura - Inválido',
        detalles: null
      };
    }

    // 5. SI PASÓ TODO, RETORNAR VÁLIDO
    return {
      valido: true,
      razon: 'Comprobante válido y auténtico',
      detalles: {
        numeroComprobante: snapshot.numeroComprobante,
        fecha: snapshot.fechaComprobante,
        cliente: {
          id: snapshot.clienteId,
          nombre: snapshot.clienteNombre || ordenOriginal.snapshotFinal?.clienteNombre
        },
        moto: {
          id: snapshot.bikeId,
          patente: snapshot.bikePatente || ordenOriginal.snapshotFinal?.bikePatente
        },
        monto: snapshot.total,
        garantia: snapshot.garantia,
        orderId: snapshot.orderId,
        timestampValidacion: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      valido: false,
      razon: 'Error en validación: ' + error.message,
      detalles: null
    };
  }
};

/**
 * Genera hash simple para verificación de integridad
 * @param {string} str - String a hashear
 * @returns {string} Hash hexadecimal
 */
export const generarHashSimple = (str) => {
  let hash = 0;
  if (str.length === 0) return '0';

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
};

/**
 * Valida el checksum de un número comprobante
 * @param {string} numeroComprobante - Número a validar
 * @returns {boolean} true si checksum es válido
 */
export const validarChecksum = (numeroComprobante) => {
  const partes = numeroComprobante.split('-');
  if (partes.length !== 4) return false;

  const checkIngresado = parseInt(partes[3]);
  const parte1 = partes[1] + partes[2];
  const checkCalculado = parseInt(
    String(parte1.split('').reduce((a, b) => parseInt(a) + parseInt(b), 0) % 10)
  );

  return checkIngresado === checkCalculado;
};

/**
 * Extrae información del número comprobante
 * @param {string} numeroComprobante - Número: JBO-20260505-123456-7
 * @returns {object} Información extraída
 */
export const extraerInfoComprobante = (numeroComprobante) => {
  const partes = numeroComprobante.split('-');
  if (partes.length !== 4) return null;

  const fechaStr = partes[1]; // YYYYMMDD
  const horaStr = partes[2];  // HHMMSS
  const checksum = partes[3];

  return {
    fecha: `${fechaStr.slice(0, 4)}-${fechaStr.slice(4, 6)}-${fechaStr.slice(6, 8)}`,
    hora: `${horaStr.slice(0, 2)}:${horaStr.slice(2, 4)}:${horaStr.slice(4, 6)}`,
    checksum,
    valido: validarChecksum(numeroComprobante)
  };
};
