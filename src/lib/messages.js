export function mensajeBloqueo(bike, client, costo) {
  return `Hola ${client.nombre || "cliente"}, la reparación de tu ${bike.marca || ""} ${bike.modelo || ""} (${bike.patente || "---"}) superó el rango estimado.\n\nNuevo estimado: $${Math.round(costo).toLocaleString()}.\n\n¿Autorizás continuar?`;
}

export function mensajeAlerta(bike, client, max) {
  return `Hola ${client.nombre || "cliente"}, estamos cerca del límite autorizado para la reparación de tu ${bike.marca || ""} ${bike.modelo || ""}.\n\nLímite: $${Math.round(max).toLocaleString()}. ¿Continuamos?`;
}

export function mensajeFinalizado(bike, client, total) {
  return `Hola ${client.nombre || "cliente"}, tu moto ${bike.patente || "---"} está lista para retirar.\n\nTotal: $${Math.round(total).toLocaleString()}`;
}

export function abrirWhatsApp(tel, mensaje) {
  const url = `https://wa.me/549${tel}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}
