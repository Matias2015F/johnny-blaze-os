import { LS } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";

/**
 * Busca o crea cliente + moto, actualiza titularidad si corresponde.
 *
 * opts.soloSiKm       — solo actualiza km en moto existente cuando kmActual > 0 (presupuesto)
 * opts.actualizarService — escribe ultimaVisita + proximoService (solo al crear OT)
 * opts.crearTitularidad  — registra historial de titular (solo al crear OT)
 */
export function upsertClienteYMoto(
  payload,
  { clients, bikes, titularidades = [], config = {} },
  { soloSiKm = false, actualizarService = false, crearTitularidad = true } = {}
) {
  const kmActual = Number(payload.km) || 0;

  // Buscar cliente por nombre + telefono o crear uno nuevo
  const clienteExistente = clients.find(
    (c) =>
      c.nombre?.trim().toLowerCase() === payload.nombre?.trim().toLowerCase() &&
      c.tel === payload.tel
  );
  const clientId = clienteExistente
    ? clienteExistente.id
    : LS.addDoc("clientes", {
        nombre: payload.nombre,
        tel: payload.tel,
        telefono: payload.tel,
        whatsapp: payload.tel,
        etiquetas: [],
        activo: true,
        createdAt: Date.now(),
      }).id;

  // Buscar moto por patente o crear una nueva
  const motoExistente = bikes.find((b) => b.patente === payload.patente.toUpperCase());
  let bikeId;
  if (motoExistente) {
    bikeId = motoExistente.id;
    const debeActualizar = !soloSiKm || kmActual > 0;
    if (debeActualizar) {
      const upd = { clienteId: clientId, km: kmActual, kilometrajeActual: kmActual };
      if (actualizarService) {
        upd.ultimaVisita = hoyEstable();
        upd.proximoService = kmActual + (config.offsetServiceKm || 2500);
      }
      LS.updateDoc("motos", bikeId, upd);
    }
  } else {
    bikeId = LS.addDoc("motos", {
      patente: payload.patente.toUpperCase(),
      patenteNormalizada: payload.patente.toUpperCase(),
      marca: payload.marca,
      modelo: payload.modelo,
      cilindrada: Number(payload.cilindrada) || 0,
      anio: null,
      color: null,
      estado: "activa",
      km: kmActual,
      kilometrajeActual: kmActual,
      clienteId: clientId,
      ...(actualizarService
        ? { ultimaVisita: hoyEstable(), proximoService: kmActual + (config.offsetServiceKm || 2500) }
        : {}),
      createdAt: Date.now(),
    }).id;
  }

  // Registrar titularidad historica (propietario actual de la moto)
  if (crearTitularidad) {
    const titActual = titularidades.find((t) => t.motoId === bikeId && t.titularActual === true);
    if (!titActual || titActual.clienteId !== clientId) {
      if (titActual) {
        LS.updateDoc("titularidades", titActual.id, { titularActual: false, fechaHasta: hoyEstable() });
      }
      LS.addDoc("titularidades", {
        clienteId: clientId,
        motoId: bikeId,
        fechaDesde: hoyEstable(),
        fechaHasta: null,
        titularActual: true,
        createdAt: Date.now(),
      });
    }
  }

  return { clientId, bikeId, kmActual };
}
