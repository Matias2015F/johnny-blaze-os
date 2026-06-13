const SW_VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const STATIC_CACHE_NAME = `jbos-static-${SW_VERSION}`;
const RUNTIME_CACHE_NAME = `jbos-runtime-${SW_VERSION}`;
const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/brand/motogestion-banner.png",
  "/brand/motogestion-icon.png",
];
const STATIC_EXTENSIONS = [".js", ".mjs", ".css", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf"];

function isStaticAsset(pathname) {
  return pathname.startsWith("/assets/") || pathname.startsWith("/brand/") || STATIC_EXTENSIONS.some((ext) => pathname.endsWith(ext));
}

function isNavigationRequest(request) {
  const accept = request.headers.get("accept") || "";
  return request.mode === "navigate" || accept.includes("text/html");
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const clone = response.clone();
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const clone = response.clone();
      caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => null);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match("/");
    if (fallback) return fallback;
    throw new Error("SW networkFirst fallback unavailable");
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => null),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== STATIC_CACHE_NAME && key !== RUNTIME_CACHE_NAME).map((key) => caches.delete(key))),
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

  if (pathname.startsWith("/api/")) return;

  // Version check y navegación principal deben leer red primero para no quedar ancladas.
  if (pathname === "/version.json" || isNavigationRequest(event.request) || pathname === "/index.html") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (isStaticAsset(pathname)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(
    networkFirst(event.request),
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
