import { evaluarServicioBeneficio, evaluarServicioCalificacion } from "./reputacion.domainService.js";
import { mapLegacyOrdenToDomainOrden } from "../ordenes/orden.adapter.js";

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function obtenerCalificacion(legacyRating = {}) {
  const rating = legacyRating.rating ?? legacyRating.puntaje ?? legacyRating.score ?? null;
  return {
    ...clonar(legacyRating),
    rating,
    comentario: legacyRating.comentario || legacyRating.message || "",
    token: legacyRating.token || legacyRating.reviewToken || null,
    estado: String(legacyRating.estado || "ACTIVA").toUpperCase(),
    estadoPublicacion: String(legacyRating.estadoPublicacion || (legacyRating.publicado ? "PUBLICADO" : "PENDIENTE")).toUpperCase(),
  };
}

function obtenerBeneficio(legacyBenefit = {}) {
  const porcentaje = legacyBenefit.porcentaje ?? legacyBenefit.descuento ?? legacyBenefit.beneficio ?? null;
  return {
    ...clonar(legacyBenefit),
    beneficioId: legacyBenefit.beneficioId || legacyBenefit.id || legacyBenefit.uid || "",
    tallerId: legacyBenefit.tallerId || legacyBenefit.taller?.id || legacyBenefit.workshopUid || "",
    clienteId: legacyBenefit.clienteId || legacyBenefit.cliente?.id || legacyBenefit.customerId || "",
    motoId: legacyBenefit.motoId || legacyBenefit.moto?.id || legacyBenefit.bikeId || "",
    ordenOrigenId: legacyBenefit.ordenOrigenId || legacyBenefit.ordenId || legacyBenefit.originOrderId || "",
    porcentaje,
    estado: String(legacyBenefit.estado || "DISPONIBLE").toUpperCase(),
    usado: Boolean(legacyBenefit.usado || legacyBenefit.used),
    vencido: Boolean(
      legacyBenefit.vencido ||
      legacyBenefit.expired ||
      (legacyBenefit.venceAt && new Date(legacyBenefit.venceAt).getTime() < Date.now()) ||
      (legacyBenefit.fechaVencimiento && new Date(legacyBenefit.fechaVencimiento).getTime() < Date.now()),
    ),
    fechaVencimiento: legacyBenefit.fechaVencimiento || legacyBenefit.venceAt || "",
  };
}

export function mapLegacyRatingToDomainCalificacion(legacyRating = {}) {
  return obtenerCalificacion(legacyRating);
}

export function mapLegacyBenefitToDomainBeneficio(legacyBenefit = {}) {
  return obtenerBeneficio(legacyBenefit);
}

export function evaluarLegacyBeneficioParaOrden(legacyBenefit = {}, legacyOrden = {}) {
  const beneficio = mapLegacyBenefitToDomainBeneficio(legacyBenefit);
  const orden = mapLegacyOrdenToDomainOrden(legacyOrden);
  return evaluarServicioBeneficio(beneficio, {
    tallerId: orden.tallerId,
    clienteId: orden.clientId,
    motoId: orden.bikeId,
    provieneDeOrdenRealCerradaCalificada: true,
    esProximaAtencionDeLaMismaMoto: true,
  });
}

export function evaluarLegacyRatingParaPublicacion(legacyRating = {}) {
  return evaluarServicioCalificacion(mapLegacyRatingToDomainCalificacion(legacyRating));
}

