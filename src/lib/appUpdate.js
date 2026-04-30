export async function fetchRemoteVersion() {
  const res = await fetch(`/version.json?ts=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error("No se pudo consultar la version");
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

export async function clearAppRuntimeCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.error(error);
  }

  try {
    if ("caches" in window) {
      const cacheStore = window.caches;
      const keys = await cacheStore.keys();
      await Promise.all(keys.map((key) => cacheStore.delete(key)));
    }
  } catch (error) {
    console.error(error);
  }
}

export async function applyRemoteUpdate(remoteBuild = null) {
  const targetBuild = remoteBuild || (await fetchRemoteVersion());
  await clearAppRuntimeCaches();

  const stamp = Date.now();
  const targetUrl = new URL(window.location.origin + "/");
  targetUrl.searchParams.set("update", String(stamp));
  if (targetBuild?.sha) targetUrl.searchParams.set("build", targetBuild.sha);

  try {
    await Promise.allSettled([
      fetch(`/version.json?ts=${stamp}`, { cache: "reload", headers: { "Cache-Control": "no-cache" } }),
      fetch(`/index.html?ts=${stamp}`, { cache: "reload", headers: { "Cache-Control": "no-cache" } }),
      fetch(`${targetUrl.pathname}?ts=${stamp}`, { cache: "reload", headers: { "Cache-Control": "no-cache" } }),
    ]);
  } catch (error) {
    console.error(error);
  }

  try {
    window.sessionStorage.setItem("jbos_last_update_attempt", JSON.stringify({
      requestedAt: stamp,
      targetVersion: targetBuild?.version || null,
      targetSha: targetBuild?.sha || null,
    }));
  } catch (error) {
    console.error(error);
  }

  window.location.replace(targetUrl.toString());
}

export async function ensureNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  const NotificationApi = window.Notification;

  if (NotificationApi.permission === "granted") return "granted";
  if (NotificationApi.permission === "denied") return "denied";

  try {
    return await NotificationApi.requestPermission();
  } catch {
    return "error";
  }
}

export async function sendTestNotification() {
  const permiso = await ensureNotificationPermission();
  if (permiso !== "granted") {
    return { ok: false, permission: permiso };
  }

  const NotificationApi = window.Notification;
  const notification = new NotificationApi("Johnny Blaze OS", {
    body: "Notificacion de prueba. Si ves esto, las alertas del taller estan funcionando.",
    silent: false,
    tag: "jbos-test-notification",
  });

  notification.onclick = () => {
    if (typeof window !== "undefined") window.focus();
  };

  return { ok: true, permission: permiso };
}
