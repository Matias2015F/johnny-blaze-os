import { abrirEnlaceExterno } from "./whatsappService.js";

const fmt = new Intl.NumberFormat("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtARS = (n) => "ARS " + fmt.format(Math.round(n || 0));

function listaNombres(items = [], fallback = "") {
  const lineas = items
    .map((item) => (item?.nombre || item?.descripcion || "").trim())
    .filter(Boolean)
    .map((nombre) => `- ${nombre}`);
  return lineas.length ? lineas.join("\n") : fallback;
}

export function mensajePresupuesto({ bike, client, tareas = [], repuestos = [], min, max, nivel = "medio" }) {
  const listaTareas = tareas.length > 0
    ? tareas.map((t) => `- ${t.nombre}`).join("\n")
    : "- Diagnóstico y revisión general";
  const listaRepuestos = listaNombres(repuestos);
  const bloqueRepuestos = listaRepuestos ? `\n\nRepuestos a cambiar:\n${listaRepuestos}` : "";
  const nombreCliente = client.nombre || "cliente";
  const motoLabel = `${bike.marca || "moto"} ${bike.modelo || ""}`.trim();
  const patente = bike.patente || "---";
  const diagnostico = "Si no aprobás la reparación, se cobra el diagnóstico.";

  if (nivel === "bajo") {
    return `Hola ${nombreCliente}. Te compartimos el presupuesto de tu ${motoLabel} (${patente}).\n\nPresupuesto fijo: ${fmtARS(min)}\n\nTrabajos incluidos:\n${listaTareas}${bloqueRepuestos}\n\nImportante: si durante la reparación surge algún inconveniente o hace falta una reparación extra, te vamos a avisar con tiempo suficiente para que decidas si querés continuar.\n\n${diagnostico}\n\nSi querés avanzar, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
  }

  const advertencia = nivel === "alto"
    ? "Es un trabajo variable. Si aparece algo extra antes de superar el máximo, te avisamos."
    : "Si durante el trabajo aparece algo adicional, te avisamos antes de continuar.";

  return `Hola ${nombreCliente}. Te compartimos el presupuesto estimado de tu ${motoLabel} (${patente}).\n\nRango estimado: entre ${fmtARS(min)} y ${fmtARS(max)}\n\nTrabajos incluidos:\n${listaTareas}${bloqueRepuestos}\n\nImportante: si durante la reparación surge algún inconveniente o hace falta una reparación extra, te vamos a avisar con tiempo suficiente para que decidas si querés continuar.\n${advertencia}\n${diagnostico}\n\nSi querés avanzar dentro de ese rango, respondé: SI, OK o APROBADO.\nSi no querés avanzar, respondé: SUSPENDER.`;
}

export function mensajeBloqueo({ bike, client, tareas = [], repuestos = [], motivo, costoActual, nuevoMin, nuevoMax }) {
  const listaTareas = tareas.map(t => `- ${t.nombre}`).join("\n") || "- Trabajo en curso";
  const listaRepuestos = repuestos.map(r => `- ${r.nombre}`).join("\n") || "- Sin repuestos cargados";

  return `Hola ${client.nombre || "cliente"},\n\nTe actualizamos sobre tu ${bike.marca || "moto"} ${bike.modelo || ""} (${bike.patente || "---"}):\n\nTrabajos realizados:\n${listaTareas}\n\nRepuestos utilizados:\n${listaRepuestos}\n\nSe superó el presupuesto estimado.\n\nMotivo: ${motivo || "Se detectaron condiciones adicionales durante la reparación."}\n\nMano de obra acumulada: ${fmtARS(costoActual)}\n\nNuevo rango para finalizar:\nEntre ${fmtARS(nuevoMin)} y ${fmtARS(nuevoMax)}\n\n¿Continuamos o nos detenemos acá?`;
}

export function mensajeFinalizado({ bike, client, total }) {
  return `Hola ${client.nombre || "cliente"},\n\nTu moto ${bike.patente || "---"} está lista para retirar.\n\nTotal: ${fmtARS(total)}\n\nPodés pasar cuando quieras. ¡Gracias!`;
}

export function generarMensajePresupuestoConDatos({ client, bike, tareas = [], repuestos = [], total, min, max, nivel, adelantoPct, incluirDatos, datosCobro, nombreTaller }) {
  const nombre = client?.nombre || "cliente";
  const moto = `${bike?.marca || ""} ${bike?.modelo || ""}`.trim() || "tu moto";
  const esAbierto = nivel !== "bajo";
  const montoAdelanto = Math.round((total || 0) * ((adelantoPct || 0) / 100));
  const trabajos = tareas.length
    ? tareas.map((t) => `- ${t.nombre}`).join("\n")
    : "- Revisión y diagnóstico general";
  const repuestosIncluidos = listaNombres(repuestos);

  let msg = `Hola ${nombre}, ya tenemos el presupuesto de tu ${moto}.`;
  msg += `\n\nTrabajos incluidos:\n${trabajos}`;
  if (repuestosIncluidos) {
    msg += `\n\nRepuestos a cambiar:\n${repuestosIncluidos}`;
  }

  if (esAbierto && min && max) {
    msg += `\n\nPresupuesto estimado: entre ${fmtARS(min)} y ${fmtARS(max)}`;
  } else {
    msg += `\n\nTotal: ${fmtARS(total)}`;
  }

  msg += "\n\nImportante: si durante la reparación surge algún inconveniente o hace falta una reparación extra, te vamos a avisar con tiempo suficiente para que decidas si querés continuar.";

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
      msg += "\n\nUna vez realizada la transferencia enviar comprobante por este medio.";
    }
  }

  msg += `\n\n${nombreTaller || "Moto Gestión - Servicio Técnico de Motocicletas"}`;
  return msg;
}

export function mensajesImprevisto({ bike, client, totalOriginal, totalNuevo }) {
  const nombre = client?.nombre || "cliente";
  const moto = `${bike?.marca || ""} ${bike?.modelo || ""}`.trim() || "tu moto";
  const patente = bike?.patente || "---";
  const haySobrepaso = totalNuevo > 0 && totalOriginal > 0 && totalNuevo > totalOriginal;

  const t1 = `Hola ${nombre}, te avisamos sobre tu ${moto} (${patente}).\n\nAl avanzar con la reparación encontramos que hace falta un trabajo adicional que no estaba en el presupuesto original.\n${haySobrepaso ? `\nPresupuesto original: ${fmtARS(totalOriginal)}\nNuevo total estimado: ${fmtARS(totalNuevo)}` : ""}\n\n¿Seguimos? Respondé SI para continuar o SUSPENDER si querés que paremos acá. Cualquier duda llamanos.`;

  const t2 = `Hola ${nombre}, surgió un imprevisto con tu ${moto} (${patente}).\n\nEncontramos una condición adicional durante la reparación. Antes de seguir necesitamos tu ok.\n${haySobrepaso ? `\nEl presupuesto pasa de ${fmtARS(totalOriginal)} a ${fmtARS(totalNuevo)} aprox.` : ""}\n\n¿Autorizás que continuemos? Respondé SI o llamanos.`;

  const t3 = `Hola ${nombre}, ¿podés llamar? Surgió algo con tu ${moto} (${patente}) que necesitamos consultarte antes de seguir con la reparación.`;

  return [
    { label: "Aviso de ampliación", texto: t1 },
    { label: "Imprevisto formal", texto: t2 },
    { label: "Consulta rápida", texto: t3 },
  ];
}

export function normalizarTelWA(tel) {
  let solo = String(tel || "").replace(/\D/g, "");
  if (!solo) return "";
  if (solo.startsWith("00")) solo = solo.slice(2);

  let nacional = solo;
  if (nacional.startsWith("549")) nacional = nacional.slice(3);
  else if (nacional.startsWith("54")) nacional = nacional.slice(2);

  nacional = nacional.replace(/^0+/, "");
  if (nacional.startsWith("15")) {
    nacional = nacional.slice(2);
  } else {
    for (const areaLen of [2, 3, 4]) {
      if (nacional.slice(areaLen, areaLen + 2) === "15") {
        nacional = nacional.slice(0, areaLen) + nacional.slice(areaLen + 2);
        break;
      }
    }
  }

  // WhatsApp Argentina usa 54 + 9 + característica + número, sin 0 ni 15.
  return `549${nacional}`;
}

export function abrirWhatsApp(tel, mensaje) {
  const numero = normalizarTelWA(tel);
  const phone = numero ? `phone=${numero}&` : "";
  const url = `https://api.whatsapp.com/send?${phone}text=${encodeURIComponent(mensaje)}`;
  abrirEnlaceExterno(url);
}
