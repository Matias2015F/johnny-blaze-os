import { abrirEnlaceExterno } from "./whatsappService.js";

export function mensajePresupuesto({ bike, client, tareas = [], min, max, nivel = "medio" }) {
  const listaTareas = tareas.length > 0
    ? tareas.map((t) => `• ${t.nombre}`).join("\n")
    : "• Diagnóstico y revisión general";
  const nombreCliente = client.nombre || "cliente";
  const motoLabel = `${bike.marca || "moto"} ${bike.modelo || ""}`.trim();
  const patente = bike.patente || "---";
  const diagnostico = "Si no aprobás la reparación, se cobra el diagnóstico.";

  if (nivel === "bajo") {
    return `Hola ${nombreCliente}. Te compartimos el presupuesto de tu ${motoLabel} (${patente}).\n\nPresupuesto fijo: $${Math.round(min).toLocaleString("es-AR")}\n\nIncluye:\n${listaTareas}\n\n${diagnostico}\n\nSi querés avanzar, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
  }

  const advertencia = nivel === "alto"
    ? "Es un trabajo variable. Si aparece algo extra antes de superar el máximo, te avisamos."
    : "Si durante el trabajo aparece algo adicional, te avisamos antes de continuar.";

  return `Hola ${nombreCliente}. Te compartimos el presupuesto estimado de tu ${motoLabel} (${patente}).\n\nRango estimado: entre $${Math.round(min).toLocaleString("es-AR")} y $${Math.round(max).toLocaleString("es-AR")}\n\nIncluye:\n${listaTareas}\n\n${advertencia}\n${diagnostico}\n\nSi querés avanzar dentro de ese rango, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
}

export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `• ${t.nombre}`).join("\n") || "—";
  const listaRepuestos = repuestos.map(r => `• ${r.nombre}`).join("\n") || "—";

  return `Hola ${client.nombre || "cliente"},\n\nTe actualizamos sobre tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}):\n\n?? Trabajos realizados:\n${listaTareas}\n\n?? Repuestos utilizados:\n${listaRepuestos}\n\n?? Se superó el presupuesto estimado.\n\nMotivo: ${motivo || "Se detectaron condiciones adicionales durante la reparación."}\n\n?? Mano de obra acumulada: $${Math.round(costoActual).toLocaleString("es-AR")}\n\n?? Nuevo rango para finalizar:\nEntre $${Math.round(nuevoMin).toLocaleString("es-AR")} y $${Math.round(nuevoMax).toLocaleString("es-AR")}\n\n¿Continuamos o nos detenemos acá?`;
}

export function mensajeFinalizado({ bike, client, total }) {
  return `Hola ${client.nombre || "cliente"},\n\nTu moto ${bike.patente || "---"} está lista para retirar.\n\nTotal: $${Math.round(total).toLocaleString("es-AR")}\n\nPodés pasar cuando quieras. ¡Gracias!`;
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
