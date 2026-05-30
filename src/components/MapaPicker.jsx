import { useEffect, useRef, useState } from "react";

/**
 * MapaPicker — elige lat/lng con click en el mapa o GPS.
 *
 * Props:
 *   lat      — latitud actual (number | null)
 *   lng      — longitud actual (number | null)
 *   onChange — callback(lat, lng) cuando cambia la posición
 *   height   — alto del mapa en px (default: 220)
 */
export default function MapaPicker({ lat, lng, onChange, height = 220 }) {
  const divRef    = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const [listo, setListo] = useState(false);

  function r6(n) { return Math.round(n * 1e6) / 1e6; }

  function buildMarker(L, map, la, lo) {
    const m = L.marker([la, lo], { draggable: true }).addTo(map);
    m.on("dragend", (e) => {
      const p = e.target.getLatLng();
      onChange(r6(p.lat), r6(p.lng));
    });
    return m;
  }

  // Inicializar mapa una sola vez al montar
  useEffect(() => {
    let vivo = true;

    function iniciar() {
      if (!vivo || !divRef.current || mapRef.current) return;
      const L = window.L;
      const center = lat && lng ? [lat, lng] : [-38.5, -64.0];
      const zoom   = lat && lng ? 14 : 4;

      const map = L.map(divRef.current, { center, zoom });

      // CartoDB Voyager — mismo tile que MOTOENLACE, sin necesitar API key
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { attribution: "© OpenStreetMap © CARTO", subdomains: "abcd", maxZoom: 19 }
      ).addTo(map);

      if (lat && lng) {
        markerRef.current = buildMarker(L, map, lat, lng);
      }

      map.on("click", (e) => {
        const la = r6(e.latlng.lat);
        const lo = r6(e.latlng.lng);
        if (markerRef.current) {
          markerRef.current.setLatLng([la, lo]);
        } else {
          markerRef.current = buildMarker(L, map, la, lo);
        }
        onChange(la, lo);
      });

      mapRef.current = map;
      // invalidateSize: necesario cuando el contenedor estaba oculto al montar
      setTimeout(() => { if (vivo && mapRef.current) mapRef.current.invalidateSize(); }, 120);
      if (vivo) setListo(true);
    }

    function cargar() {
      if (window.L) { iniciar(); return; }

      if (!document.getElementById("lf-css")) {
        const link = document.createElement("link");
        link.id = "lf-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      if (!document.getElementById("lf-js")) {
        const s  = document.createElement("script");
        s.id     = "lf-js";
        s.src    = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        s.onload = () => { if (vivo) iniciar(); };
        document.head.appendChild(s);
      } else {
        const t = setInterval(() => {
          if (window.L) { clearInterval(t); if (vivo) iniciar(); }
        }, 80);
      }
    }

    cargar();

    return () => {
      vivo = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current  = null;
        markerRef.current = null;
        setListo(false);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar cuando lat/lng cambia externamente (botón GPS)
  useEffect(() => {
    if (!mapRef.current || !window.L || !lat || !lng) return;
    const L = window.L;
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = buildMarker(L, mapRef.current, lat, lng);
    }
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 14));
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: "relative", height, borderRadius: "1rem", overflow: "hidden", background: "#18181b" }}>
      {!listo && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          color: "#71717a", fontSize: 11, fontWeight: 900,
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>
          Cargando mapa…
        </div>
      )}
      <div ref={divRef} style={{ height: "100%", width: "100%" }} />
    </div>
  );
}
