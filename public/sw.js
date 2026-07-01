const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const CACHE_NAME = `jbos-static-${SW_VERSION}`;
const APP_SHELL = ["/", "/manifest.json", "/favicon.ico", "/brand/motogestion-banner.png", "/brand/motogestion-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Importante: no interceptar requests cross-origin (ej: tiles de mapas, MP, etc).
  // Si el SW responde con "/" como fallback, rompe imágenes/tiles silenciosamente.
  if (url.origin !== self.location.origin) return;

  const { pathname } = url;

  // Las APIs deben ir siempre a red. Si el SW devuelve "/" como fallback,
  // el frontend intenta parsear HTML como JSON y rompe con "Unexpected token <".
  if (pathname.startsWith("/api/")) return;

  // Never cache these files — always network so version checks get fresh data
  if (pathname === "/version.json" || pathname === "/index.html") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request)),
    );
    return;
  }

  const acceptsHtml = event.request.headers.get("accept")?.includes("text/html");
  const isNavigationRequest = event.request.mode === "navigate" || acceptsHtml;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => null);
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (isNavigationRequest) return caches.match("/");
          return Response.error();
        })
      ),
  );
});

// ── Push notifications ────────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* ignorar */ }

  const titulo = data.titulo || "Moto Gestión";
  const cuerpo = data.cuerpo || "Tenés recordatorios pendientes";

  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "/brand/motogestion-icon.png",
      badge: "/brand/motogestion-icon.png",
      tag: data.tag || "jbos-recordatorio",
      renotify: true,
      vibrate: [300, 100, 300],
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const existing = clientList.find((c) => c.url.startsWith(self.location.origin) && "focus" in c);
      if (existing) {
        return existing.focus().then(() => existing.navigate(url)).catch(() => existing.focus());
      }
      return clients.openWindow(url);
    })
  );
});
