export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `• ${t.nombre}`).join("\n") || "—";
  const listaRepuestos = repuestos.map(r => `• ${r.nombre}`).join("\n") || "—";

  return `Hola ${client.nombre || "cliente"},

Te actualizamos sobre tu moto ${bike.marca || ""} ${bike.modelo || ""} (${bike.patente || "---"}):

🔧 Trabajos realizados:
${listaTareas}

🧩 Repuestos utilizados:
${listaRepuestos}

⚠️ Se superó el presupuesto estimado inicial.

Motivo:
${motivo || "Se detectaron condiciones adicionales durante la reparación."}

💰 Mano de obra acumulada hasta ahora: $${Math.round(costoActual).toLocaleString()}

📊 Nuevo rango estimado para finalizar:
Entre $${Math.round(nuevoMin).toLocaleString()} y $${Math.round(nuevoMax).toLocaleString()}

¿Querés que continuemos o preferís que nos detengamos acá?`;
}

export function mensajePresupuesto({ bike, client, min, max }) {
  return `Hola ${client.nombre || "cliente"},

Revisamos tu moto ${bike.marca || ""} ${bike.modelo || ""} (${bike.patente || "---"}).

💰 Presupuesto estimado de mano de obra:
Entre $${Math.round(min).toLocaleString()} y $${Math.round(max).toLocaleString()}

Este valor es estimado en base a trabajos similares.

⚠️ Puede variar en caso de que surjan inconvenientes adicionales durante la reparación. En ese caso te vamos a avisar antes de continuar.

Quedamos atentos a tu confirmación para avanzar.`;
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
