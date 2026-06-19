export const ADMIN_HOSTS = ["admin.motogestion.ar"];
const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

export function getCurrentSurfaceLocation() {
  if (typeof window === "undefined") return { hostname: "", pathname: "", search: "" };
  return {
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    search: window.location.search,
  };
}

export function isAdminSurface(loc = getCurrentSurfaceLocation()) {
  const hostname = String(loc.hostname || "").toLowerCase();
  const pathname = String(loc.pathname || "");
  const search = String(loc.search || "");

  if (ADMIN_HOSTS.includes(hostname)) return true;

  if (LOCAL_HOSTS.includes(hostname)) {
    const params = new URLSearchParams(search);
    return pathname === "/admin" || params.get("surface") === "admin";
  }

  return false;
}
