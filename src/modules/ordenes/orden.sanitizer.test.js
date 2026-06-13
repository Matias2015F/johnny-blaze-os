import { describe, expect, it } from "vitest";
import { crearSnapshotDiagnosticoOrden, eliminarDatosSensiblesOrden, sanitizarOrdenParaDiagnostico } from "./orden.sanitizer.js";

describe("orden.sanitizer", () => {
  it("elimina datos sensibles sin mutar la orden original", () => {
    const legacyOrden = {
      id: "orden_123",
      estado: "ENTREGADO",
      clientId: "cliente_123",
      bikeId: "moto_123",
      tallerId: "taller_123",
      cliente: {
        nombre: "Matias Gomez",
        apellido: "Lopez",
        email: "matias@example.com",
        telefono: "+54 11 5555-0000",
        documento: "30111222",
        direccion: "Av. Siempre Viva 123",
      },
      moto: {
        patente: "AB123CD",
        dominio: "motogestion.ar",
        motor: "MTR-88991",
        chasis: "CHS-55661",
        urlPublica: "https://private.example.com/orden/123",
      },
      linkPrivado: "https://drive.example.com/file/abc",
      tokenAcceso: "secret-token-123",
      datos: [{ email: "otra@demo.com", url: "https://example.com" }],
    };
    const copy = JSON.parse(JSON.stringify(legacyOrden));

    const sanitized = sanitizarOrdenParaDiagnostico(legacyOrden);
    const sensitiveMask = JSON.stringify(sanitized);

    expect(legacyOrden).toEqual(copy);
    expect(sanitized).toMatchObject({
      id: "orden_123",
      estado: "ENTREGADO",
      clientId: "cliente_123",
      bikeId: "moto_123",
      tallerId: "taller_123",
    });
    expect(sensitiveMask).not.toContain("Matias Gomez");
    expect(sensitiveMask).not.toContain("matias@example.com");
    expect(sensitiveMask).not.toContain("+54 11 5555-0000");
    expect(sensitiveMask).not.toContain("AB123CD");
    expect(sensitiveMask).not.toContain("motogestion.ar");
    expect(sensitiveMask).not.toContain("secret-token-123");
    expect(sensitiveMask).not.toContain("private.example.com");
    expect(sanitized.cliente.nombre).toBe("[dato oculto]");
    expect(sanitized.cliente.email).toBe("[email oculto]");
    expect(sanitized.cliente.telefono).toBe("[telefono oculto]");
    expect(sanitized.moto.patente).toBe("AA000AA");
    expect(sanitized.moto.dominio).toBe("[link oculto]");
    expect(sanitized.moto.motor).toBe("[identificador oculto]");
    expect(sanitized.moto.chasis).toBe("[identificador oculto]");
    expect(sanitized.linkPrivado).toBe("[link oculto]");
    expect(sanitized.tokenAcceso).toBe("[dato oculto]");
    expect(sanitized.datos[0].email).toBe("[email oculto]");
    expect(sanitized.datos[0].url).toBe("[link oculto]");
  });

  it("crea snapshot diagnostico con metadatos estables", () => {
    const snapshot = crearSnapshotDiagnosticoOrden({
      estado: "ENTREGADO",
      clientId: "cliente_1",
      bikeId: "moto_1",
      tallerId: "taller_1",
      trabajosRealizados: [{ nombre: "Cambio de aceite" }],
      repuestos: [{ nombre: "Filtro" }],
      pagos: [{ monto: 1000 }],
      garantiaFinal: "Garantia de ejemplo",
      cierreRechazo: { excepciones: "Ninguna", observaciones: "Listo" },
    });

    expect(snapshot.snapshot).toMatchObject({
      estado: "ENTREGADO",
      clientId: "cliente_1",
      bikeId: "moto_1",
      tallerId: "taller_1",
    });
    expect(snapshot.metadata).toMatchObject({
      hasState: true,
      flags: {
        pagado: false,
        retirado: false,
      },
      counts: {
        tareas: 1,
        repuestos: 1,
        pagos: 1,
      },
    });
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("puede limpiar datos sensibles por valor directo", () => {
    const sanitized = eliminarDatosSensiblesOrden({
      nombreContacto: "Juan Perez",
      emailCobro: "juan@example.com",
      telefonoCobro: "+54 11 1234-5678",
      domicilioEntrega: "Mitre 123",
    });

    expect(sanitized.nombreContacto).toBe("[dato oculto]");
    expect(sanitized.emailCobro).toBe("[email oculto]");
    expect(sanitized.telefonoCobro).toBe("[telefono oculto]");
    expect(sanitized.domicilioEntrega).toBe("[dato oculto]");
  });
});
