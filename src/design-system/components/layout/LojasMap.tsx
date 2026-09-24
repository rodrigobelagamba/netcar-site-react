import { useEffect, useRef } from "react";
import {
  AttributionControl,
  LngLatBounds,
  MapLibreMap,
  Marker,
  NavigationControl,
  setWorkerUrl,
  type LngLatLike,
  type PaddingOptions,
} from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { LOJA_COORDS } from "@/lib/formatters";

// O MapLibre procura o worker ao lado do próprio arquivo, caminho que some depois do bundle.
setWorkerUrl(maplibreWorkerUrl);

type LojaMarker = {
  id: 1 | 2;
  nome: string;
  cor: "primary" | "amber-500";
  mapsUrl: string;
};

const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

const MARKER_COLORS = {
  primary: "#6cc4ca",
  "amber-500": "#f59e0b",
} as const;

// O pin ocupa 104px acima da coordenada; sem essa folga no topo a Loja 1 corta.
const FIT_PADDING: PaddingOptions = { top: 128, right: 48, bottom: 48, left: 48 };

function createPinElement(color: string, label: string, delayPing: boolean) {
  const pingDelayClass = delayPing ? " lojas-map-marker__ping--delayed" : "";
  const element = document.createElement("button");
  element.type = "button";
  element.className = "lojas-map-marker-icon";
  element.title = `Abrir ${label} no Google Maps`;
  element.setAttribute("aria-label", element.title);
  element.innerHTML = `
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
    `;
  return element;
}

// Zoom arredondado pra baixo deixa o enquadramento mais aberto que o encaixe exato.
function fitLojas(map: MapLibreMap, bounds: LngLatBounds) {
  const camera = map.cameraForBounds(bounds, { padding: FIT_PADDING });
  map.fitBounds(bounds, {
    padding: FIT_PADDING,
    maxZoom: camera?.zoom === undefined ? undefined : Math.floor(camera.zoom),
    animate: false,
  });
}

export function LojasMap({ lojas }: { lojas: LojaMarker[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!mapRef.current) {
      const map = new MapLibreMap({
        container,
        style: MAP_STYLE_URL,
        scrollZoom: false,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new NavigationControl({ showCompass: false }), "top-left");
      // O card "Nossas unidades" cobre o canto direito; a atribuição do OSM precisa ficar visível.
      map.addControl(new AttributionControl({ compact: false }), "bottom-left");

      mapRef.current = map;

      return () => {
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

    const points: LngLatLike[] = [];
    const bounds = new LngLatBounds();

    for (const loja of lojas) {
      const coords = LOJA_COORDS[`Loja${loja.id}`];
      if (!coords) continue;

      const lngLat: LngLatLike = [coords.lng, coords.lat];
      points.push(lngLat);
      bounds.extend(lngLat);

      const element = createPinElement(MARKER_COLORS[loja.cor], loja.nome, loja.id === 2);
      element.addEventListener("click", () => {
        window.open(loja.mapsUrl, "_blank", "noopener,noreferrer");
      });

      markersRef.current.push(new Marker({ element, anchor: "bottom" }).setLngLat(lngLat).addTo(map));
    }

    if (points.length >= 2) {
      fitLojas(map, bounds);
    } else if (points.length === 1) {
      map.jumpTo({ center: points[0], zoom: 16 });
    }

    const resizeTimer = window.setTimeout(() => {
      map.resize();
      if (points.length >= 2) fitLojas(map, bounds);
    }, 150);

    return () => window.clearTimeout(resizeTimer);
  }, [lojas]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full z-0"
      role="region"
      aria-label="Mapa das lojas Netcar — clique no pin para abrir no Google Maps"
    />
  );
}
