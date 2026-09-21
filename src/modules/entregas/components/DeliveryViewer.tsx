import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  ExternalLink,
  ImageOff,
  Loader2,
  Share2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Delivery } from "../lib/deliveries";
import { optimizeStockImage } from "@/lib/images";
import {
  clampFocusedPhoto,
  focusPhotoCrop,
  type PhotoArea,
} from "./viewerFocus";
import "./DeliveryViewer.css";

export interface DeliveryViewerProps {
  items: Delivery[];
  activeId: string;
  focusCrop?: readonly number[];
  onClose: () => void;
  onChange: (id: string) => void;
}

const months = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

type Point = { x: number; y: number };
type PhotoTransform = Point & { scale: number };
type PhotoGesture = {
  mode: "swipe" | "pan" | "pinch";
  start: Point;
  transform: PhotoTransform;
  distance: number;
};
const FIT_PHOTO: PhotoTransform = { scale: 1, x: 0, y: 0 };

function archiveLabel(item: Delivery): string {
  if (
    (item.source === "marketing" || item.source === "instagram") &&
    item.date
  ) {
    const [year, month, day] = item.date.split("-");
    return `Foto publicada em ${day}/${month}/${year}`;
  }
  const month = Number(item.month);
  if (item.year && month >= 1 && month <= 12) {
    return `Registro de ${months[month - 1]} de ${item.year}`;
  }
  return item.year ? `Registro de ${item.year}` : "Memórias do acervo Netcar";
}

export function DeliveryViewer({
  items,
  activeId,
  focusCrop,
  onClose,
  onChange,
}: DeliveryViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const copyInputRef = useRef<HTMLInputElement>(null);
  const photoViewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const detailsRef = useRef<HTMLDivElement>(null);
  const focusedGroup = useRef(false);
  const naturalSize = useRef({ width: 0, height: 0 });
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<PhotoGesture | null>(null);
  const lastTap = useRef<(Point & { time: number }) | null>(null);
  const transformRef = useRef<PhotoTransform>(FIT_PHOTO);
  const [photoTransform, setPhotoTransform] = useState(FIT_PHOTO);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [shareState, setShareState] = useState<"idle" | "copied" | "manual">(
    "idle",
  );
  const [shareUrl, setShareUrl] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const activeIndex = items.findIndex((item) => item.id === activeId);
  const item = items[activeIndex];

  const usefulPhotoArea = useCallback((): PhotoArea => {
    const viewport = photoViewportRef.current?.getBoundingClientRect();
    if (!viewport) return { x: 0, y: 0, width: 0, height: 0 };
    const header = headerRef.current?.getBoundingClientRect();
    const details = detailsRef.current?.getBoundingClientRect();
    const top = Math.max(
      0,
      header ? Math.min(viewport.height, header.bottom - viewport.top) : 0,
    );
    const bottom = Math.min(
      viewport.height,
      details ? Math.max(0, details.top - viewport.top) : viewport.height,
    );
    return {
      x: 12,
      y: top + 12,
      width: Math.max(1, viewport.width - 24),
      height: Math.max(1, bottom - top - 24),
    };
  }, []);

  const updateTransform = useCallback(
    (next: PhotoTransform) => {
      const viewport = photoViewportRef.current;
      const size = naturalSize.current;
      const scale = Math.min(4, Math.max(1, next.scale));
      let x = 0;
      let y = 0;
      if (viewport && size.width && size.height && scale > 1) {
        const fit = Math.min(
          viewport.clientWidth / size.width,
          viewport.clientHeight / size.height,
        );
        const limitX = Math.max(
          0,
          (size.width * fit * scale - viewport.clientWidth) / 2,
        );
        const limitY = Math.max(
          0,
          (size.height * fit * scale - viewport.clientHeight) / 2,
        );
        x = Math.max(-limitX, Math.min(limitX, next.x));
        y = Math.max(-limitY, Math.min(limitY, next.y));
      }
      const result =
        focusedGroup.current && viewport && size.width && size.height
          ? clampFocusedPhoto(
              next,
              size,
              { width: viewport.clientWidth, height: viewport.clientHeight },
              usefulPhotoArea(),
            )
          : { scale, x, y };
      transformRef.current = result;
      setPhotoTransform(result);
    },
    [usefulPhotoArea],
  );

  const zoomPhoto = (scale: number, point: Point = { x: 0, y: 0 }) => {
    focusedGroup.current = false;
    const current = transformRef.current;
    const nextScale = Math.min(4, Math.max(1, scale));
    const ratio = nextScale / current.scale;
    updateTransform({
      scale: nextScale,
      x: point.x - (point.x - current.x) * ratio,
      y: point.y - (point.y - current.y) * ratio,
    });
  };

  const isExpanded =
    photoTransform.scale > 1 ||
    photoTransform.x !== 0 ||
    photoTransform.y !== 0;
  const expandPhoto = () => {
    if (isExpanded) {
      zoomPhoto(1);
      return;
    }
    const viewport = photoViewportRef.current;
    const focused = focusPhotoCrop(
      focusCrop,
      naturalSize.current,
      {
        width: viewport?.clientWidth || 0,
        height: viewport?.clientHeight || 0,
      },
      usefulPhotoArea(),
    );
    if (!focused) {
      zoomPhoto(2.25);
      return;
    }
    focusedGroup.current = true;
    updateTransform(focused);
  };

  const pointInPhoto = (point: Point): Point => {
    const rect = photoViewportRef.current?.getBoundingClientRect();
    return rect
      ? {
          x: point.x - rect.left - rect.width / 2,
          y: point.y - rect.top - rect.height / 2,
        }
      : { x: 0, y: 0 };
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    setImageState("loading");
    setShareState("idle");
    setShareMessage("");
    setShareUrl("");
    naturalSize.current = { width: 0, height: 0 };
    pointers.current.clear();
    gesture.current = null;
    lastTap.current = null;
    focusedGroup.current = false;
    updateTransform(FIT_PHOTO);
  }, [activeId, item?.imageUrl, updateTransform]);

  useEffect(() => {
    const viewport = photoViewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() =>
      updateTransform(transformRef.current),
    );
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [updateTransform]);

  useEffect(() => {
    if (shareState === "manual") {
      copyInputRef.current?.focus();
      copyInputRef.current?.select();
    }
  }, [shareState]);

  const navigate = (direction: -1 | 1) => {
    if (items.length < 2) return;
    const nextIndex = (activeIndex + direction + items.length) % items.length;
    onChange(items[nextIndex].id);
  };

  const share = async (copyOnly = false) => {
    if (!item || shareBusy) return;
    const url = new URL("/entregas", window.location.origin);
    url.hash = `foto=${encodeURIComponent(item.id)}`;
    const link = url.toString();
    setShareUrl(link);
    setShareBusy(true);
    setShareMessage("");
    try {
      if (!copyOnly && navigator.share) {
        try {
          await navigator.share({
            title: item.name
              ? `${item.name} · Entregas Netcar`
              : "Uma nova conquista · Netcar",
            text: "Uma conquista para guardar. Veja esta entrega na Netcar.",
            url: link,
          });
          setShareMessage("Compartilhamento concluído.");
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(link);
          setShareState("copied");
          setShareMessage("Link copiado. Agora é só compartilhar.");
          return;
        } catch {
          // Browsers may block clipboard access; expose the actual link instead.
        }
      }
      setShareState("manual");
      setShareMessage("Selecione e copie o link abaixo para compartilhar.");
    } finally {
      setShareBusy(false);
    }
  };

  if (!item) return null;

  const thumbnailStart = Math.max(
    0,
    Math.min(activeIndex - 2, items.length - 5),
  );
  const nearbyItems = items.slice(thumbnailStart, thumbnailStart + 5);
  const name = item.name || "Uma nova conquista";

  return createPortal(
    <dialog
      className="delivery-viewer"
      ref={dialogRef}
      aria-labelledby="delivery-viewer-title"
      aria-describedby="delivery-viewer-date"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.target instanceof HTMLInputElement) return;
        if (
          ["+", "=", "-", "0"].includes(event.key) &&
          imageState === "ready"
        ) {
          event.preventDefault();
          zoomPhoto(
            event.key === "0"
              ? 1
              : transformRef.current.scale *
                  (event.key === "-" ? 1 / 1.5 : 1.5),
          );
          return;
        }
        if (event.key.startsWith("Arrow") && transformRef.current.scale > 1) {
          event.preventDefault();
          updateTransform({
            ...transformRef.current,
            x:
              transformRef.current.x +
              (event.key === "ArrowLeft"
                ? 70
                : event.key === "ArrowRight"
                  ? -70
                  : 0),
            y:
              transformRef.current.y +
              (event.key === "ArrowUp"
                ? 70
                : event.key === "ArrowDown"
                  ? -70
                  : 0),
          });
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          navigate(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
    >
      <header ref={headerRef} className="delivery-viewer__header">
        <div className="delivery-viewer__brand">
          <span className="delivery-viewer__brand-icon">
            <ArrowDownLeft size={19} aria-hidden="true" />
          </span>
          <span>
            <span className="delivery-viewer__brand-prefix">Momentos </span>
            <strong>Netcar</strong>
          </span>
        </div>
        <div className="delivery-viewer__header-right">
          <button
            className="delivery-viewer__zoom"
            type="button"
            disabled={imageState !== "ready"}
            aria-pressed={isExpanded}
            aria-label={isExpanded ? "Mostrar foto inteira" : "Ampliar foto"}
            aria-keyshortcuts="+ - 0"
            onClick={expandPhoto}
          >
            {isExpanded ? (
              <ZoomOut size={18} aria-hidden="true" />
            ) : (
              <ZoomIn size={18} aria-hidden="true" />
            )}
            <span>{isExpanded ? "Foto inteira" : "Ampliar"}</span>
          </button>
          <span className="delivery-viewer__counter" aria-live="polite">
            <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
            <span>/ {items.length.toLocaleString("pt-BR")}</span>
          </span>
          <button
            className="delivery-viewer__icon-button delivery-viewer__close"
            type="button"
            aria-label="Fechar foto"
            onClick={onClose}
            autoFocus
          >
            <X size={23} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="delivery-viewer__stage">
        {items.length > 1 && (
          <button
            className="delivery-viewer__icon-button delivery-viewer__previous"
            type="button"
            aria-label="Foto anterior"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={24} aria-hidden="true" />
          </button>
        )}
        <div
          ref={photoViewportRef}
          className={`delivery-viewer__photo-wrap${photoTransform.scale > 1 ? " is-zoomed" : ""}`}
          aria-busy={imageState === "loading"}
          aria-describedby="delivery-viewer-gestures"
          onPointerDown={(event) => {
            if (
              imageState !== "ready" ||
              (event.pointerType === "mouse" && event.button !== 0)
            )
              return;
            event.currentTarget.setPointerCapture(event.pointerId);
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const points = [...pointers.current.values()];
            if (points.length === 1) {
              gesture.current = {
                mode: transformRef.current.scale > 1 ? "pan" : "swipe",
                start: points[0],
                transform: transformRef.current,
                distance: 0,
              };
            } else if (points.length === 2) {
              focusedGroup.current = false;
              lastTap.current = null;
              gesture.current = {
                mode: "pinch",
                start: pointInPhoto({
                  x: (points[0].x + points[1].x) / 2,
                  y: (points[0].y + points[1].y) / 2,
                }),
                transform: transformRef.current,
                distance: Math.max(
                  1,
                  Math.hypot(
                    points[1].x - points[0].x,
                    points[1].y - points[0].y,
                  ),
                ),
              };
            }
          }}
          onPointerMove={(event) => {
            if (!pointers.current.has(event.pointerId) || !gesture.current)
              return;
            pointers.current.set(event.pointerId, {
              x: event.clientX,
              y: event.clientY,
            });
            const current = gesture.current;
            const points = [...pointers.current.values()];
            if (current.mode === "pinch" && points.length >= 2) {
              const distance = Math.hypot(
                points[1].x - points[0].x,
                points[1].y - points[0].y,
              );
              const scale = Math.min(
                4,
                Math.max(
                  1,
                  (current.transform.scale * distance) / current.distance,
                ),
              );
              const middle = pointInPhoto({
                x: (points[0].x + points[1].x) / 2,
                y: (points[0].y + points[1].y) / 2,
              });
              const ratio = scale / current.transform.scale;
              updateTransform({
                scale,
                x: middle.x - (current.start.x - current.transform.x) * ratio,
                y: middle.y - (current.start.y - current.transform.y) * ratio,
              });
            } else if (current.mode === "pan") {
              updateTransform({
                ...current.transform,
                x: current.transform.x + event.clientX - current.start.x,
                y: current.transform.y + event.clientY - current.start.y,
              });
            }
          }}
          onPointerUp={(event) => {
            const current = gesture.current;
            pointers.current.delete(event.pointerId);
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
            if (!current) return;
            const deltaX = event.clientX - current.start.x;
            const deltaY = event.clientY - current.start.y;
            if (
              current.mode === "swipe" &&
              Math.abs(deltaX) > 60 &&
              Math.abs(deltaX) > Math.abs(deltaY) * 1.5
            ) {
              lastTap.current = null;
              navigate(deltaX < 0 ? 1 : -1);
            } else if (
              current.mode !== "pinch" &&
              Math.hypot(deltaX, deltaY) < 10
            ) {
              const previous = lastTap.current;
              const now = Date.now();
              if (
                previous &&
                now - previous.time < 300 &&
                Math.hypot(
                  event.clientX - previous.x,
                  event.clientY - previous.y,
                ) < 30
              ) {
                zoomPhoto(
                  transformRef.current.scale > 1 ? 1 : 2.25,
                  pointInPhoto({ x: event.clientX, y: event.clientY }),
                );
                lastTap.current = null;
              } else {
                lastTap.current = {
                  time: now,
                  x: event.clientX,
                  y: event.clientY,
                };
              }
            }
            const remaining = [...pointers.current.values()][0];
            gesture.current = remaining
              ? {
                  mode: "pan",
                  start: remaining,
                  transform: transformRef.current,
                  distance: 0,
                }
              : null;
          }}
          onPointerCancel={() => {
            pointers.current.clear();
            gesture.current = null;
            lastTap.current = null;
          }}
        >
          <p id="delivery-viewer-gestures" className="delivery-viewer__sr-only">
            {photoTransform.scale > 1
              ? "Foto ampliada. Arraste ou use as setas para mover. Use Foto inteira ou a tecla zero para restaurar."
              : "Deslize para trocar de foto. Toque duas vezes, faça o gesto de pinça ou use Ampliar para ver os detalhes."}
          </p>
          {imageState === "loading" && (
            <div className="delivery-viewer__image-status" role="status">
              <Loader2
                className="delivery-viewer__spinner"
                size={25}
                aria-hidden="true"
              />
              <span>Carregando a sua história…</span>
            </div>
          )}
          {imageState === "error" ? (
            <div className="delivery-viewer__image-status" role="status">
              <ImageOff size={30} aria-hidden="true" />
              <span>Não foi possível carregar esta foto.</span>
              <a href={item.imageUrl} target="_blank" rel="noopener noreferrer">
                Tentar abrir a imagem original{" "}
                <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          ) : (
            <img
              key={item.id}
              src={item.imageUrl}
              alt={
                item.name
                  ? `${item.name} na entrega do veículo na Netcar`
                  : "Registro de uma entrega de veículo na Netcar"
              }
              className={`delivery-viewer__photo${imageState === "ready" ? " is-ready" : ""}`}
              style={{
                transform: `translate(${photoTransform.x}px, ${photoTransform.y}px) scale(${photoTransform.scale})`,
              }}
              onLoad={(event) => {
                naturalSize.current = {
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                };
                setImageState("ready");
                updateTransform(FIT_PHOTO);
              }}
              onError={() => setImageState("error")}
              draggable={false}
              decoding="async"
            />
          )}
        </div>
        {items.length > 1 && (
          <button
            className="delivery-viewer__icon-button delivery-viewer__next"
            type="button"
            aria-label="Próxima foto"
            onClick={() => navigate(1)}
          >
            <ArrowRight size={24} aria-hidden="true" />
          </button>
        )}
      </div>

      <div ref={detailsRef} className="delivery-viewer__details">
        <div className="delivery-viewer__caption">
          <span className="delivery-viewer__eyebrow">
            A próxima história pode ser a sua
          </span>
          <h2 id="delivery-viewer-title">{name}</h2>
          <p id="delivery-viewer-date">{archiveLabel(item)}</p>
          {item.caption && (
            <p className="delivery-viewer__description">{item.caption}</p>
          )}
        </div>
        <div className="delivery-viewer__actions">
          <button
            className="delivery-viewer__share"
            type="button"
            onClick={() => void share()}
            disabled={shareBusy}
            aria-label={
              shareState === "copied"
                ? "Link copiado"
                : "Compartilhar conquista"
            }
          >
            {shareState === "copied" ? (
              <Check size={19} aria-hidden="true" />
            ) : shareBusy ? (
              <Loader2
                className="delivery-viewer__spinner"
                size={19}
                aria-hidden="true"
              />
            ) : (
              <Share2 size={19} aria-hidden="true" />
            )}
            <span className="delivery-viewer__action-label">
              {shareState === "copied"
                ? "Link copiado"
                : "Compartilhar conquista"}
            </span>
          </button>
          <div className="delivery-viewer__secondary-actions">
            <button
              className="delivery-viewer__original"
              type="button"
              onClick={() => void share(true)}
              disabled={shareBusy}
              aria-label="Copiar link da foto"
            >
              <Copy size={16} aria-hidden="true" />{" "}
              <span className="delivery-viewer__action-label">Copiar link</span>
            </button>
            <a
              className="delivery-viewer__original"
              href={item.imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Abrir foto original em outra aba"
            >
              <span className="delivery-viewer__action-label">
                Foto original
              </span>{" "}
              <ExternalLink size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
      </div>

      <div
        className="delivery-viewer__share-feedback"
        aria-live="polite"
        aria-atomic="true"
      >
        {shareMessage && <p>{shareMessage}</p>}
        {shareState === "manual" && (
          <label className="delivery-viewer__manual-copy">
            <Copy size={16} aria-hidden="true" />
            <span className="delivery-viewer__sr-only">Link desta entrega</span>
            <input
              ref={copyInputRef}
              type="text"
              readOnly
              value={shareUrl}
              onClick={(event) => event.currentTarget.select()}
            />
          </label>
        )}
      </div>

      <footer className="delivery-viewer__footer">
        <div
          className="delivery-viewer__thumbnails"
          aria-label="Fotos próximas"
        >
          {nearbyItems.map((nearby) => (
            <button
              key={nearby.id}
              type="button"
              className={`delivery-viewer__thumbnail${nearby.id === activeId ? " is-active" : ""}`}
              aria-label={`Ver foto: ${nearby.name || "Uma nova conquista"}`}
              aria-pressed={nearby.id === activeId}
              onClick={() => onChange(nearby.id)}
            >
              <img
                src={
                  nearby.previewImageUrl ||
                  optimizeStockImage(nearby.imageUrl, 160)
                }
                alt=""
                loading="lazy"
              />
            </button>
          ))}
        </div>
        <a className="delivery-viewer__stock-link" href="/seminovos">
          Encontre seu próximo carro <ArrowRight size={17} aria-hidden="true" />
        </a>
      </footer>
    </dialog>,
    document.body,
  );
}

export default DeliveryViewer;
