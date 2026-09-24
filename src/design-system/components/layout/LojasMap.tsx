import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LOJA_COORDS } from "@/lib/formatters";

type LojaMarker = {
  id: 1 | 2;
  nome: string;
  cor: "primary" | "amber-500";
  mapsUrl: string;
};

const MARKER_COLORS = {
  primary: "#6cc4ca",
  "amber-500": "#f59e0b",
} as const;

// O pin ocupa 104px acima da coordenada; sem essa folga no topo a Loja 1 corta.
const FIT_BOUNDS_OPTIONS: L.FitBoundsOptions = {
  paddingTopLeft: [48, 128],
  paddingBottomRight: [48, 48],
};

function createPinIcon(color: string, label: string, delayPing: boolean) {
  const pingDelayClass = delayPing ? " lojas-map-marker__ping--delayed" : "";

  return L.divIcon({
    className: "lojas-map-marker-icon",
    html: `
      <div class="lojas-map-marker" style="--pin-color: ${color};" role="img" aria-label="${label}">
        <div style="background:#fff;padding:4px 10px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.15);border:1px solid #f3f4f6;margin-bottom:6px;white-space:nowrap;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color};margin-right:6px;"></span>
          <span style="font-size:11px;font-weight:700;color:#1f2937;font-family:system-ui,sans-serif;">${label}</span>
        </div>
        <div class="lojas-map-marker__pin-wrap">
          <span class="lojas-map-marker__ping${pingDelayClass}" style="background:${color};"></span>
          <span class="lojas-map-marker__halo"></span>
          <svg class="lojas-map-marker__svg" width="32" height="32" viewBox="0 0 24 24" fill="${color}">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5" fill="#fff"/>
          </svg>
          <div class="lojas-map-marker__stem"></div>
        </div>
      </div>
    `,
    iconSize: [120, 104],
    iconAnchor: [60, 104],
  });
}

export function LojasMap({ lojas }: { lojas: LojaMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = L.map(container, {
        scrollWheelZoom: false,
        zoomControl: true,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;

      const resizeTimer = window.setTimeout(() => map.invalidateSize(), 150);
      return () => {
        window.clearTimeout(resizeTimer);
        map.remove();
        mapRef.current = null;
        markersRef.current = [];
      };
    }
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const bounds: L.LatLng[] = [];

    for (const loja of lojas) {
      const coords = LOJA_COORDS[`Loja${loja.id}`];
      if (!coords) continue;

      const latLng = L.latLng(coords.lat, coords.lng);
      bounds.push(latLng);

      const marker = L.marker(latLng, {
        icon: createPinIcon(MARKER_COLORS[loja.cor], loja.nome, loja.id === 2),
        interactive: true,
        keyboard: true,
        title: `Abrir ${loja.nome} no Google Maps`,
      }).addTo(map);

      marker.on("click", () => {
        window.open(loja.mapsUrl, "_blank", "noopener,noreferrer");
      });

      markersRef.current.push(marker);
    }

    if (bounds.length >= 2) {
      map.fitBounds(L.latLngBounds(bounds), FIT_BOUNDS_OPTIONS);
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 17);
    }

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      if (bounds.length >= 2) {
        map.fitBounds(L.latLngBounds(bounds), FIT_BOUNDS_OPTIONS);
      }
    }, 150);

    return () => window.clearTimeout(resizeTimer);
  }, [lojas]);

  return (
    <>
      {/* Fora do container: o Leaflet apaga o HTML interno ao iniciar. */}
      <svg className="pointer-events-none absolute h-0 w-0" aria-hidden="true">
        <filter id="lojas-map-palette" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            result="base"
            values="0.22 0.48 0.16 0 0.08  0.18 0.46 0.20 0 0.10  0.16 0.42 0.26 0 0.12  0 0 0 1 0"
          />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            result="lum"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0.2126 0.7152 0.0722 0 0"
          />
          <feComponentTransfer in="lum" result="blockMask">
            <feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.15 1 0.35 0 0 0" />
          </feComponentTransfer>
          <feFlood floodColor="#6cbe9d" floodOpacity="0.38" result="blockPaint" />
          <feComposite in="blockPaint" in2="blockMask" operator="in" result="blockLayer" />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            result="roadA"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0.2 -2.6 0 -0.2"
          />
          <feComponentTransfer in="roadA" result="roadMask">
            <feFuncA type="linear" slope="1.8" intercept="0" />
          </feComponentTransfer>
          <feFlood floodColor="#6cc4ca" floodOpacity="0.82" result="roadPaint" />
          <feComposite in="roadPaint" in2="roadMask" operator="in" result="roadLayer" />
          <feMerge>
            <feMergeNode in="base" />
            <feMergeNode in="blockLayer" />
            <feMergeNode in="roadLayer" />
          </feMerge>
        </filter>
      </svg>
      <div
        ref={containerRef}
        className="lojas-map w-full h-full z-0"
        role="region"
        aria-label="Mapa das lojas Netcar — clique no pin para abrir no Google Maps"
      />
    </>
  );
}
