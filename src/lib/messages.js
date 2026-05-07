import { abrirEnlaceExterno } from "./whatsappService.js";

export function mensajePresupuesto({ bike, client, tareas = [], min, max, nivel = "medio" }) {
  const listaTareas = tareas.length > 0
    ? tareas.map((t) => `� ${t.nombre}`).join("\n")
    : "� Diagn�stico y revisi�n general";
  const nombreCliente = client.nombre || "cliente";
  const motoLabel = `${bike.marca || "moto"} ${bike.modelo || ""}`.trim();
  const patente = bike.patente || "---";
  const diagnostico = "Si no aprob�s la reparaci�n, se cobra el diagn�stico.";

  if (nivel === "bajo") {
    return `Hola ${nombreCliente}. Te compartimos el presupuesto de tu ${motoLabel} (${patente}).\n\nPresupuesto fijo: $${Math.round(min).toLocaleString("es-AR")}\n\nIncluye:\n${listaTareas}\n\n${diagnostico}\n\nSi quer�s avanzar, respond�: SI, OK o APROBADO.\nSi no quer�s avanzar, respond�: SUSPENDER.`;
  }

  const advertencia = nivel === "alto"
    ? "Es un trabajo variable. Si aparece algo extra antes de superar el m�ximo, te avisamos."
    : "Si durante el trabajo aparece algo adicional, te avisamos antes de continuar.";

  return `Hola ${nombreCliente}. Te compartimos el presupuesto estimado de tu ${motoLabel} (${patente}).\n\nRango estimado: entre $${Math.round(min).toLocaleString("es-AR")} y $${Math.round(max).toLocaleString("es-AR")}\n\nIncluye:\n${listaTareas}\n\n${advertencia}\n${diagnostico}\n\nSi quer�s avanzar dentro de ese rango, respond�: SI, OK o APROBADO.\nSi no quer�s avanzar, respond�: SUSPENDER.`;
}

export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `� ${t.nombre}`).join("\n") || "�";
  const listaRepuestos = repuestos.map(r => `� ${r.nombre}`).join("\n") || "�";

  return `Hola ${client.nombre || "cliente"},\n\nTe actualizamos sobre tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}):\n\n?? Trabajos realizados:\n${listaTareas}\n\n?? Repuestos utilizados:\n${listaRepuestos}\n\n?? Se super� el presupuesto estimado.\n\nMotivo: ${motivo || "Se detectaron condiciones adicionales durante la reparaci�n."}\n\n?? Mano de obra acumulada: $${Math.round(costoActual).toLocaleString("es-AR")}\n\n?? Nuevo rango para finalizar:\nEntre $${Math.round(nuevoMin).toLocaleString("es-AR")} y $${Math.round(nuevoMax).toLocaleString("es-AR")}\n\n�Continuamos o nos detenemos ac�?`;
}

export function mensajeFinalizado({ bike, client, total }) {
  return `Hola ${client.nombre || "cliente"},\n\nTu moto ${bike.patente || "---"} est� lista para retirar.\n\nTotal: $${Math.round(total).toLocaleString("es-AR")}\n\nPod�s pasar cuando quieras. �Gracias!`;
}

export function generarMensajePresupuestoConDatos({ client, bike, total, min, max, nivel, adelantoPct, incluirDatos, datosCobro, nombreTaller }) {
  const nombre = client?.nombre || "cliente";
  const moto = `${bike?.marca || ""} ${bike?.modelo || ""}`.trim() || "tu moto";
  const esAbierto = nivel !== "bajo";
  const montoAdelanto = Math.round((total || 0) * ((adelantoPct || 0) / 100));

  let msg = `Hola ${nombre}, ya tenemos el presupuesto de tu ${moto}.`;

  if (esAbierto && min && max) {
    msg += `\n\nPresupuesto estimado: entre $${Math.round(min).toLocaleString("es-AR")} y $${Math.round(max).toLocaleString("es-AR")}`;
    msg += `\n\nImportante: El presupuesto puede modificarse si durante la reparacion surgen fallas adicionales o inconvenientes no visibles. En ese caso se informara antes de continuar.`;
  } else {
    msg += `\n\nTotal: $${Math.round(total || 0).toLocaleString("es-AR")}`;
  }

  if (adelantoPct > 0 && montoAdelanto > 0) {
    msg += `\n\nPara comenzar el trabajo se solicita un adelanto del ${adelantoPct}%:\nMonto adelanto: $${montoAdelanto.toLocaleString("es-AR")}`;
  }

  if (incluirDatos && datosCobro) {
    const lineas = [];
    if (datosCobro.titular) lineas.push(`Titular: ${datosCobro.titular}`);
    if (datosCobro.alias)   lineas.push(`Alias: ${datosCobro.alias}`);
    if (datosCobro.cbu)     lineas.push(`CBU: ${datosCobro.cbu}`);
    if (lineas.length) {
      msg += `\n\nDatos para transferencia:\n${lineas.join("\n")}`;
      msg += `\n\nUna vez realizada la transferencia enviar comprobante por este medio.`;
    }
  }

  msg += `\n\n${nombreTaller || "Johnny Blaze - Servicio Tecnico de Motocicletas"}`;
  return msg;
}

export function normalizarTelWA(tel) {
  const solo = String(tel || "").replace(/\D/g, "");
  if (!solo) return "";
  if (solo.startsWith("549")) return solo;
  if (solo.startsWith("54")) return "549" + solo.slice(2);
  return "549" + solo;
}

export function abrirWhatsApp(tel, mensaje) {
  const numero = normalizarTelWA(tel);
  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
  abrirEnlaceExterno(url);
}
