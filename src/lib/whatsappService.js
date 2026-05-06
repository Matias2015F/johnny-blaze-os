export function generarEnlacePresupuesto(orden, monto, cliente, moto) {
  const nombreCliente = cliente?.nombre || orden?.clienteNombre || "Cliente";
  const marcaMoto = moto?.marca || orden?.moto?.marca || "";
  const modeloMoto = moto?.modelo || orden?.moto?.modelo || "";
  const patente = moto?.patente || orden?.moto?.patente || "";
  const tel = cliente?.tel || cliente?.telefono || orden?.clienteTel || "";

  const mensaje =
    `*Presupuesto - ${patente}*\n\n` +
    `Hola ${nombreCliente},\n\n` +
    `Tu ${marcaMoto} ${modeloMoto} está lista para revisión.\n\n` +
    `*Total: $${Number(monto).toLocaleString("es-AR")}*\n\n` +
    `Por favor confirmá para que podamos continuar.\n\n` +
    `${new Date().toLocaleString("es-AR")}`;

  const numero = tel.replace(/[^0-9]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function generarEnlaceMontoFinal(orden, monto, cliente, moto) {
  const nombreCliente = cliente?.nombre || "Cliente";
  const patente = moto?.patente || "";
  const tel = cliente?.tel || cliente?.telefono || "";

  const mensaje =
    `Hola ${nombreCliente}, ¡tu moto está lista!\n\n` +
    `*Costo final: $${Number(monto).toLocaleString("es-AR")}*\n` +
    `Patente: ${patente}\n\n` +
    `¿Cuándo pasás a retirar? Avisame.`;

  const numero = tel.replace(/[^0-9]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

export function generarEnlaceConfirmacion(orden, cliente) {
  const patente = orden?.moto?.patente || "";
  const tel = cliente?.tel || cliente?.telefono || "";
  const mensaje = `Confirmo la ejecución del trabajo en ${patente}.`;
  const numero = tel.replace(/[^0-9]/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
