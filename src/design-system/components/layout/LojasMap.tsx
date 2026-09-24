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

const NEUTRAL = 0;
const ROAD = 1;
const GREEN = 2;
const WATER = 3;

const TILE_TONES: ReadonlyArray<readonly [number, number, number]> = [
  [80, 90, 95], // Cinza Estrada #505a5f
  [108, 196, 202], // Azul Céu #6cc4ca
  [108, 190, 157], // Apoio 1 #6cbe9d
  [0, 91, 102], // Azul Noite #005b66
];

// Para cada tom, a cor em cada luminosidade: o desenho do OSM continua legível, só muda a cor.
const TONE_RAMPS = (() => {
  const ramps = new Uint8ClampedArray(TILE_TONES.length * 256 * 3);
  TILE_TONES.forEach(([r, g, b], tone) => {
    const baseL = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    for (let l = 0; l < 256; l += 1) {
      const target = l / 255;
      const offset = (tone * 256 + l) * 3;
      const toWhite = target >= baseL ? (target - baseL) / (1 - baseL) : 0;
      const toBlack = target < baseL ? target / baseL : 1;
      ramps[offset] = (r + (255 - r) * toWhite) * toBlack;
      ramps[offset + 1] = (g + (255 - g) * toWhite) * toBlack;
      ramps[offset + 2] = (b + (255 - b) * toWhite) * toBlack;
    }
  });
  return ramps;
})();

// Faixas calibradas nas cores do OSM Carto: vias laranja/amarelo/rosa forte, parques verdes, água azul.
// Rosa claro de comércio/indústria e bege de prédio têm pouco croma e caem no neutro.
function toneFor(r: number, g: number, b: number, lightness: number) {
  const max = Math.max(r, g, b);
  const chroma = max - Math.min(r, g, b);
  if (chroma < 30 || lightness < 102) return NEUTRAL;

  let hue: number;
  if (max === r) hue = (((g - b) / chroma + 6) % 6) * 60;
  else if (max === g) hue = ((b - r) / chroma + 2) * 60;
  else hue = ((r - g) / chroma + 4) * 60;

  if (hue >= 20 && hue < 70) return ROAD;
  if (hue >= 70 && hue < 170) return GREEN;
  if (hue >= 170 && hue < 230) return WATER;
  if ((hue >= 330 || hue < 20) && chroma >= 60) return ROAD;
  return NEUTRAL;
}

function recolorTile(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) >> 1;
    const offset = (toneFor(r, g, b, lightness) * 256 + lightness) * 3;
    data[i] = TONE_RAMPS[offset];
    data[i + 1] = TONE_RAMPS[offset + 1];
    data[i + 2] = TONE_RAMPS[offset + 2];
  }
}

// Recolore no canvas porque o Safari ignora filtro SVG em camada com transform, e o Leaflet move os tiles com translate3d.
class PaletteTileLayer extends L.GridLayer {
  protected createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement("canvas");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const context = tile.getContext("2d", { willReadFrequently: true });
      if (context) {
        context.drawImage(image, 0, 0, size.x, size.y);
        try {
          const pixels = context.getImageData(0, 0, size.x, size.y);
          recolorTile(pixels.data);
          context.putImageData(pixels, 0, 0);
        } catch {
          // Sem CORS o canvas fica bloqueado para leitura; o tile segue com a cor original.
        }
      }
      done(undefined, tile);
    };
    image.onerror = () => done(new Error(`Tile ${coords.z}/${coords.x}/${coords.y} falhou`), tile);
    image.src = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
    return tile;
  }
}

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

      new PaletteTileLayer({
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
    <div
      ref={containerRef}
      className="lojas-map w-full h-full z-0"
      role="region"
      aria-label="Mapa das lojas Netcar — clique no pin para abrir no Google Maps"
    />
  );
}
