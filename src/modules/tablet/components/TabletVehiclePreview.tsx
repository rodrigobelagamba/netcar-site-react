import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";
import type { Vehicle } from "@/catalog/endpoints/vehicles";
import { useVehicleQuery } from "@/catalog/queries/useVehicleQuery";
import { optimizeStockImage, stockGalleryPreviewSource } from "@/lib/images";
import { resolveVehicleCoverImage, VEHICLE_COVER_PLACEHOLDER } from "@/lib/vehicleCoverImage";
import { generateVehicleSlug } from "@/lib/slug";
import "./tabletPreview.css";

interface TabletVehiclePreviewProps {
  vehicle: Vehicle;
  onClose: () => void;
}

const PLACEHOLDER = VEHICLE_COVER_PLACEHOLDER;
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR");

function PreviewImage({
  source,
  alt,
  thumbnail = false,
}: {
  source: string;
  alt: string;
  thumbnail?: boolean;
}) {
  const [attempt, setAttempt] = useState(0);
  const preview = stockGalleryPreviewSource(source);
  const optimized =
    source === PLACEHOLDER
      ? source
      : optimizeStockImage(preview, thumbnail ? 160 : 1280);
  // Only the open photo may fall back to its original; thumbnails stay small.
  const canUseOriginal = !thumbnail && source !== optimized;
  const src =
    attempt === 0
      ? optimized
      : attempt === 1 && canUseOriginal
        ? source
        : PLACEHOLDER;

  return (
    <img
      src={src}
      alt={src === PLACEHOLDER ? "Foto indisponível" : alt}
      width={thumbnail ? 160 : 1280}
      height={thumbnail ? 120 : 960}
      loading={thumbnail ? "lazy" : "eager"}
      decoding="async"
      onError={() => {
        if (src !== PLACEHOLDER) setAttempt((current) => current + 1);
      }}
    />
  );
}

export default function TabletVehiclePreview({
  vehicle: summaryVehicle,
  onClose,
}: TabletVehiclePreviewProps) {
  const detailQuery = useVehicleQuery(generateVehicleSlug(summaryVehicle));
  const vehicle =
    detailQuery.data?.id === summaryVehicle.id
      ? detailQuery.data
      : summaryVehicle;
  const cover = resolveVehicleCoverImage(vehicle);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  const titleId = useId();
  const [selected, setSelected] = useState(0);
  closeRef.current = onClose;

  const photos = useMemo(() => {
    const gallery = vehicle.imagens_site?.galeria?.length
      ? vehicle.imagens_site.galeria
      : (vehicle.fullImages ?? vehicle.fotos ?? vehicle.images).filter(
          (image) => image.toLowerCase().includes(".avif"),
        );
    // A supplied cover is shared with the main site; an empty gallery is not
    // turned into a photograph count merely because a generic banner exists.
    if (!gallery.length && vehicle.imagens_site?.tem_fotos === 0) return [];
    return Array.from(
      new Set(
        [cover, ...gallery].filter(
          (source): source is string =>
            Boolean(source?.trim()) && source !== PLACEHOLDER,
        ),
      ),
    );
  }, [vehicle, cover]);

  const selectedIndex = Math.min(selected, Math.max(0, photos.length - 1));
  const title = vehicle.modelo || vehicle.name;
  const source = photos[selectedIndex] || cover;
  const detailHref = `/veiculo/${generateVehicleSlug(vehicle)}`;
  const movePhoto = (direction: number) => {
    if (photos.length > 1) {
      setSelected(
        (current) => (current + direction + photos.length) % photos.length,
      );
    }
  };

  useEffect(() => setSelected(0), [vehicle.id]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const nativeDialog = typeof dialog.showModal === "function";
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${parseFloat(window.getComputedStyle(document.body).paddingRight) + scrollbarWidth}px`;
    }

    if (nativeDialog) dialog.showModal();
    else {
      dialog.setAttribute("open", "");
      dialog.querySelector<HTMLButtonElement>("button")?.focus();
    }

    const handleFallbackKeys = (event: KeyboardEvent) => {
      if (nativeDialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex="0"]',
        ),
      ).filter((control) => control.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", handleFallbackKeys);

    return () => {
      dialog.removeEventListener("keydown", handleFallbackKeys);
      if (nativeDialog && dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const facts = [
    ["Modelo", vehicle.year > 0 ? String(vehicle.year) : "Não informado"],
    [
      "Quilometragem",
      Number.isFinite(vehicle.km) && vehicle.km >= 0
        ? `${number.format(vehicle.km)} km`
        : "Não informada",
    ],
    ["Câmbio", vehicle.cambio || "Não informado"],
    ["Combustível", vehicle.combustivel || "Não informado"],
    ["Motor", vehicle.motor || "Não informado"],
    ["Cor", vehicle.cor || "Não informada"],
  ];

  return (
    <dialog
      ref={dialogRef}
      className="tablet-preview"
      aria-labelledby={titleId}
      aria-modal="true"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
          return;
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          movePhoto(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <header className="tablet-preview-header">
        <span className="tablet-preview-eyebrow">Conheça este carro</span>
        <button
          type="button"
          className="tablet-preview-close"
          onClick={onClose}
          aria-label="Fechar ficha e voltar ao estoque"
          autoFocus
        >
          <X size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="tablet-preview-content">
        <section
          className="tablet-preview-gallery"
          aria-label="Fotos do veículo"
        >
          <div className="tablet-preview-photo">
            <PreviewImage
              key={source}
              source={source}
              alt={`${title}, foto ${selectedIndex + 1}`}
            />
            {photos.length > 1 && (
              <>
                <button
                  type="button"
                  className="tablet-preview-photo-nav tablet-preview-photo-nav-previous"
                  onClick={() => movePhoto(-1)}
                  aria-label="Foto anterior"
                >
                  <ChevronLeft size={26} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="tablet-preview-photo-nav tablet-preview-photo-nav-next"
                  onClick={() => movePhoto(1)}
                  aria-label="Próxima foto"
                >
                  <ChevronRight size={26} aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          <p
            className="tablet-preview-photo-caption"
            aria-live="polite"
            aria-atomic="true"
          >
            {detailQuery.isFetching && photos.length <= 1
              ? "Carregando fotos..."
              : photos.length > 0
                ? `Foto ${selectedIndex + 1} de ${photos.length}`
                : "Galeria de fotos em preparação"}
          </p>
          {photos.length > 1 && (
            <div
              className="tablet-preview-thumbnails"
              aria-label="Escolha uma foto"
            >
              {photos.map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  className="tablet-preview-thumbnail"
                  aria-label={`Ver foto ${index + 1}`}
                  aria-pressed={index === selectedIndex}
                  onClick={() => setSelected(index)}
                >
                  <PreviewImage source={photo} alt="" thumbnail />
                </button>
              ))}
            </div>
          )}
        </section>

        <section
          className="tablet-preview-details"
          aria-label="Dados do veículo"
        >
          {vehicle.marca && (
            <p className="tablet-preview-brand">{vehicle.marca}</p>
          )}
          <h2 id={titleId} className="tablet-preview-title">
            {title}
          </h2>
          <p className="tablet-preview-reference">Código {vehicle.id}</p>
          <p className="tablet-preview-price">
            {Number.isFinite(vehicle.price) && vehicle.price > 0
              ? currency.format(vehicle.price)
              : "Consulte o valor"}
          </p>
          <dl className="tablet-preview-facts">
            {facts.map(([label, value]) => (
              <div key={label} className="tablet-preview-fact">
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <a
            className="tablet-preview-detail-link"
            href={detailHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Abrir ficha completa
            <ExternalLink size={18} aria-hidden="true" />
            <span className="tablet-preview-sr-only"> (em nova aba)</span>
          </a>
          <p className="tablet-preview-note">
            Seu filtro e sua posição no estoque serão mantidos.
          </p>
        </section>
      </div>
    </dialog>
  );
}
