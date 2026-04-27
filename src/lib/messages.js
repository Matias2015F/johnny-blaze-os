export function mensajePresupuesto({ bike, client, tareas = [], min, max, nivel = "medio" }) {
  const listaTareas = tareas.length > 0
    ? tareas.map(t => `• ${t.nombre}`).join("\n")
    : "—";

  if (nivel === "bajo") {
    return `Hola ${client.nombre || "cliente"},

Revisamos tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}).

✅ Precio fijo: $${Math.round(min).toLocaleString()}

Trabajos a realizar:
${listaTareas}

¿Confirmás que avancemos?`;
  }

  const advertencia = nivel === "alto"
    ? `⚠️ Es un trabajo complejo. El precio puede variar dentro del rango. Te consultamos antes de superar el máximo.`
    : `⚠️ El valor puede variar si surgen inconvenientes. Te avisamos antes de continuar.`;

  return `Hola ${client.nombre || "cliente"},

Revisamos tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}).

💰 Presupuesto estimado:
Entre $${Math.round(min).toLocaleString()} y $${Math.round(max).toLocaleString()}

Trabajos:
${listaTareas}

${advertencia}

¿Confirmás que avancemos?`;
}

export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `• ${t.nombre}`).join("\n") || "—";
  const listaRepuestos = repuestos.map(r => `• ${r.nombre}`).join("\n") || "—";

  return `Hola ${client.nombre || "cliente"},

Te actualizamos sobre tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}):

🔧 Trabajos realizados:
${listaTareas}

🧩 Repuestos utilizados:
${listaRepuestos}

⚠️ Se superó el presupuesto estimado.

Motivo: ${motivo || "Se detectaron condiciones adicionales durante la reparación."}

💰 Mano de obra acumulada: $${Math.round(costoActual).toLocaleString()}

📊 Nuevo rango para finalizar:
Entre $${Math.round(nuevoMin).toLocaleString()} y $${Math.round(nuevoMax).toLocaleString()}

¿Continuamos o nos detenemos acá?`;
}

export function mensajeFinalizado({ bike, client, total }) {
  return `Hola ${client.nombre || "cliente"},

Tu moto ${bike.patente || "---"} está lista para retirar.

Total: $${Math.round(total).toLocaleString()}

Podés pasar cuando quieras. ¡Gracias!`;
}

export function abrirWhatsApp(tel, mensaje) {
  const url = `https://wa.me/549${tel}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}
