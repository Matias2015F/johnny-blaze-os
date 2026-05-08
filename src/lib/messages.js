import { abrirEnlaceExterno } from "./whatsappService.js";

const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtARS = (n) => "ARS " + fmt.format(Math.round(n || 0));

export function mensajePresupuesto({ bike, client, tareas = [], min, max, nivel = "medio" }) {
  const listaTareas = tareas.length > 0
    ? tareas.map((t) => `• ${t.nombre}`).join("\n")
    : "• Diagnóstico y revisión general";
  const nombreCliente = client.nombre || "cliente";
  const motoLabel = `${bike.marca || "moto"} ${bike.modelo || ""}`.trim();
  const patente = bike.patente || "---";
  const diagnostico = "Si no aprobás la reparación, se cobra el diagnóstico.";

  if (nivel === "bajo") {
    return `Hola ${nombreCliente}. Te compartimos el presupuesto de tu ${motoLabel} (${patente}).\n\nPresupuesto fijo: ${fmtARS(min)}\n\nIncluye:\n${listaTareas}\n\n${diagnostico}\n\nSi querés avanzar, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
  }

  const advertencia = nivel === "alto"
    ? "Es un trabajo variable. Si aparece algo extra antes de superar el máximo, te avisamos."
    : "Si durante el trabajo aparece algo adicional, te avisamos antes de continuar.";

  return `Hola ${nombreCliente}. Te compartimos el presupuesto estimado de tu ${motoLabel} (${patente}).\n\nRango estimado: entre ${fmtARS(min)} y ${fmtARS(max)}\n\nIncluye:\n${listaTareas}\n\n${advertencia}\n${diagnostico}\n\nSi querés avanzar dentro de ese rango, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
}

export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `• ${t.nombre}`).join("\n") || "•";
  const listaRepuestos = repuestos.map(r => `• ${r.nombre}`).join("\n") || "•";

  return `Hola ${client.nombre || "cliente"},\n\nTe actualizamos sobre tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}):\n\n🔧 Trabajos realizados:\n${listaTareas}\n\n🔩 Repuestos utilizados:\n${listaRepuestos}\n\n⚠️ Se superó el presupuesto estimado.\n\nMotivo: ${motivo || "Se detectaron condiciones adicionales durante la reparación."}\n\n💰 Mano de obra acumulada: ${fmtARS(costoActual)}\n\n📋 Nuevo rango para finalizar:\nEntre ${fmtARS(nuevoMin)} y ${fmtARS(nuevoMax)}\n\n¿Continuamos o nos detenemos acá?`;
}

export function mensajeFinalizado({ bike, client, total }) {
  return `Hola ${client.nombre || "cliente"},\n\nTu moto ${bike.patente || "---"} está lista para retirar.\n\nTotal: ${fmtARS(total)}\n\nPodés pasar cuando quieras. ¡Gracias!`;
}

export function generarMensajePresupuestoConDatos({ client, bike, total, min, max, nivel, adelantoPct, incluirDatos, datosCobro, nombreTaller }) {
  const nombre = client?.nombre || "cliente";
  const moto = `${bike?.marca || ""} ${bike?.modelo || ""}`.trim() || "tu moto";
  const esAbierto = nivel !== "bajo";
  const montoAdelanto = Math.round((total || 0) * ((adelantoPct || 0) / 100));

  let msg = `Hola ${nombre}, ya tenemos el presupuesto de tu ${moto}.`;

  if (esAbierto && min && max) {
    msg += `\n\nPresupuesto estimado: entre ${fmtARS(min)} y ${fmtARS(max)}`;
    msg += `\n\nImportante: El presupuesto puede modificarse si durante la reparacion surgen fallas adicionales o inconvenientes no visibles. En ese caso se informara antes de continuar.`;
  } else {
    msg += `\n\nTotal: ${fmtARS(total)}`;
  }

  if (adelantoPct > 0 && montoAdelanto > 0) {
    msg += `\n\nPara comenzar el trabajo se solicita un adelanto del ${adelantoPct}%:\nMonto adelanto: ${fmtARS(montoAdelanto)}`;
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
