import { describe, expect, it } from "vitest";
import { evaluarServicioBeneficio, evaluarServicioCalificacion } from "./reputacion.domainService.js";

describe("reputacion.domainService", () => {
  const beneficio = {
    beneficioId: "b1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenOrigenId: "o1",
    porcentaje: 15,
    estado: "DISPONIBLE",
    fechaVencimiento: "2099-01-01T00:00:00.000Z",
  };

  const contexto = {
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    provieneDeOrdenRealCerradaCalificada: true,
    esProximaAtencionDeLaMismaMoto: true,
  };

  it("devuelve decision aplicable para beneficio valido", () => {
    const resultado = evaluarServicioBeneficio(beneficio, contexto);
    expect(resultado).toMatchObject({
      permitido: true,
      codigo: "BENEFICIO_APLICABLE",
      accionSugerida: "Aplicar descuento",
    });
  });

  it("bloquea calificacion sin token valido", () => {
    const resultado = evaluarServicioCalificacion({
      tallerId: "t1",
      clienteId: "c1",
      motoId: "m1",
      ordenId: "o1",
      rating: 5,
      estadoPublicacion: "PENDIENTE",
    });
    expect(resultado).toMatchObject({
      permitido: false,
      codigo: "CALIFICACION_BLOQUEADA_TOKEN_INVALIDO",
      accionSugerida: "Validar token de reseña",
    });
  });
});

