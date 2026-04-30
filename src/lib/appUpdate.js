export async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error("No se pudo consultar la versión");
  return res.json();
}

export function isNewerBuild(localBuild, remoteBuild) {
  if (!localBuild?.version || !remoteBuild?.version) return false;
  return localBuild.version !== remoteBuild.version;
}

export function getDisplayModeInfo() {
  if (typeof window === "undefined") {
    return { installed: false, mode: "desconocido", label: "No disponible" };
  }

  const standaloneIOS = window.navigator?.standalone === true;
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const minimalUi = window.matchMedia?.("(display-mode: minimal-ui)")?.matches;
  const fullscreen = window.matchMedia?.("(display-mode: fullscreen)")?.matches;

  if (standaloneIOS) return { installed: true, mode: "ios-standalone", label: "Instalada en iPhone" };
  if (standaloneMedia) return { installed: true, mode: "standalone", label: "Instalada como app" };
  if (minimalUi) return { installed: true, mode: "minimal-ui", label: "Instalada en modo minimal" };
  if (fullscreen) return { installed: true, mode: "fullscreen", label: "Pantalla completa" };

  return { installed: false, mode: "browser", label: "Abierta en navegador" };
}

export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    return await Notification.requestPermission();
  } catch {
    return "error";
  }
}

export async function sendTestNotification() {
  const permiso = await ensureNotificationPermission();
  if (permiso !== "granted") {
    return { ok: false, permission: permiso };
  }

  const notification = new Notification("Johnny Blaze OS", {
    body: "Notificación de prueba. Si ves esto, las alertas del taller están funcionando.",
    silent: false,
    tag: "jbos-test-notification",
  });

  notification.onclick = () => {
    if (typeof window !== "undefined") window.focus();
  };

  return { ok: true, permission: permiso };
}
