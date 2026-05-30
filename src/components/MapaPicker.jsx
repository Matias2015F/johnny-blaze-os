import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// El marker por defecto de Leaflet tiene paths rotos con Vite — usamos DivIcon
function createPinIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:22px;height:22px;
      background:#ea580c;
      border:3px solid #fff;
      border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -24],
  });
}

/**
 * MapaPicker — selecciona lat/lng con click o GPS.
 *
 * Props:
 *   lat      — latitud actual (number | null)
 *   lng      — longitud actual (number | null)
 *   onChange — callback(lat, lng)
 *   height   — alto del mapa en px (default: 220)
 */
export default function MapaPicker({ lat, lng, onChange, editable = true, height = 220 }) {
  const divRef    = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const tilesRef  = useRef(null);
  const [listo, setListo] = useState(false);

  function r6(n) { return Math.round(n * 1e6) / 1e6; }

  function addOrMoveMarker(map, la, lo) {
    if (markerRef.current) {
      markerRef.current.setLatLng([la, lo]);
    } else {
      const m = L.marker([la, lo], { icon: createPinIcon(), draggable: !!editable }).addTo(map);
      if (editable) {
        m.on("dragend", (e) => {
          const p = e.target.getLatLng();
          onChange(r6(p.lat), r6(p.lng));
        });
      }
      markerRef.current = m;
    }
  }

  // Inicializar mapa una sola vez
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const center = lat && lng ? [lat, lng] : [-38.5, -64.0];
    const zoom   = lat && lng ? 14 : 4;

    const map = L.map(divRef.current, { center, zoom });

    // Nota: algunos dispositivos/redes bloquean tiles de OSM. Usamos Carto (más estable)
    // y fallback automático a OSM si hay errores de carga.
    const CARTO = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
    const OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const baseOpts = {
      attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>",
      maxZoom: 19,
      crossOrigin: true,
    };

    let tileErrors = 0;
    const tiles = L.tileLayer(CARTO, { ...baseOpts, subdomains: "abcd" }).addTo(map);
    tilesRef.current = tiles;
    tiles.on("tileerror", () => {
      tileErrors += 1;
      if (tileErrors === 3) {
        try {
          map.removeLayer(tiles);
          tilesRef.current = L.tileLayer(OSM, { ...baseOpts, subdomains: "abc" }).addTo(map);
        } catch {
          // ignore
        }
      }
    });

    L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>", subdomains: "abc", maxZoom: 19 }
    ); // legacy tiles disabled (Carto + fallback arriba)

    if (lat && lng) addOrMoveMarker(map, lat, lng);

    if (editable) {
      map.on("click", (e) => {
        const la = r6(e.latlng.lat);
        const lo = r6(e.latlng.lng);
        addOrMoveMarker(map, la, lo);
        onChange(la, lo);
      });
    }

    mapRef.current = map;
    // invalidateSize: necesario si el contenedor estaba oculto al montar
    setTimeout(() => mapRef.current?.invalidateSize(), 150);
    setListo(true);

    return () => {
      map.remove();
      mapRef.current  = null;
      markerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincronizar cuando lat/lng cambia externamente (botón GPS)
  useEffect(() => {
    if (!mapRef.current || !lat || !lng) return;
    addOrMoveMarker(mapRef.current, lat, lng);
    mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 14));
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Si cambia el modo editable, ajustamos drag del marker existente.
  useEffect(() => {
    if (!markerRef.current) return;
    if (editable) markerRef.current.dragging?.enable?.();
    else markerRef.current.dragging?.disable?.();
  }, [editable]);

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
