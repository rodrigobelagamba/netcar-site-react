import { useEffect } from "react";
import { ArrowUpRight, MessageCircleMore, Play, Video, X } from "lucide-react";
import {
  normalizeInstagramVideoUrl,
  normalizeVehicleVideoCover,
} from "../lib/vehicleInstagramVideos";

interface VehicleVideoLinkProps {
  permalink: string;
  vehicleName: string;
  displayModel?: string;
  coverImage?: string;
  onOpen?: () => void;
  /** Controle opcional do player inline em modal (usado também pelo botão "Ver vídeo" no Hero). */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  whatsappHref?: string;
}

function VehicleVideoModal({
  href,
  vehicleName,
  onClose,
  whatsappHref,
}: {
  href: string;
  vehicleName: string;
  onClose: () => void;
  whatsappHref?: string;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const embedUrl = `${href}embed/captioned/`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Vídeo de ${vehicleName}`}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#001824]/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-[430px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#23747C]">
              Vídeo do veículo
            </p>
            <p className="truncate text-sm font-bold text-[#00283C]">
              {vehicleName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar vídeo"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[#00283C] transition-colors hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto bg-black">
          <iframe
            src={embedUrl}
            title={`Vídeo de ${vehicleName}`}
            className="h-[540px] w-full border-0 bg-white sm:h-[600px]"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#526974] underline underline-offset-4 hover:text-[#00283C]"
          >
            Abrir no Instagram
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="hero"
              data-wa-intent="vehicle_inquiry"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#087A37] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#065E2B]"
            >
              <MessageCircleMore className="h-3.5 w-3.5" aria-hidden="true" />
              Falar deste carro
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Player leve sob demanda: zero chamada à Meta no carregamento inicial.
 * Quando `onOpenChange` é fornecido, abre player inline em modal na própria página;
 * sem `onOpenChange`, mantém o link leve direto ao Instagram.
 */
export function VehicleVideoLink({
  permalink,
  vehicleName,
  displayModel,
  coverImage,
  onOpen,
  isOpen = false,
  onOpenChange,
  whatsappHref,
}: VehicleVideoLinkProps) {
  const href = normalizeInstagramVideoUrl(permalink);
  if (!href) return null;

  const cover = normalizeVehicleVideoCover(coverImage);
  const title = displayModel?.trim()
    ? `Veja este ${displayModel.trim()} em vídeo`
    : "Ver vídeo deste carro";

  const mediaCover = (
    <span className="relative min-h-0 w-full flex-1 overflow-hidden" aria-hidden="true">
      {cover && (
        <img
          src={cover}
          alt=""
          width={640}
          height={1138}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 !h-full w-full object-cover object-[center_42%] transition-transform duration-500 motion-safe:group-hover:scale-[1.025]"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
      <span className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#00283C]/25 to-transparent" />
      <span className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#00283C] sm:left-4 sm:top-4">
        <Video className="h-3.5 w-3.5 text-[#23747C]" />
        Vídeo do carro
      </span>
    </span>
  );

  if (!onOpenChange) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        aria-label={`${title}: ${vehicleName}, no Instagram (abre em outra aba)`}
        className="group relative isolate flex aspect-[6/5] w-full flex-col overflow-hidden rounded-2xl border border-[#00283C]/10 bg-[#00283C] text-white shadow-[0_4px_18px_rgba(0,40,60,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:h-full sm:aspect-auto sm:min-h-[280px]"
      >
        {mediaCover}
        <span className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-4 text-left sm:gap-5 sm:px-5 sm:py-5">
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight tracking-[-0.02em] text-white sm:text-xl">
              Ver vídeo deste carro
            </span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#B8D5DB] sm:text-xs">
              No Instagram
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </span>
          </span>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#64C5CB] text-[#00283C] transition-colors group-hover:bg-[#8AD6DA] sm:h-14 sm:w-14"
            aria-hidden="true"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current sm:h-6 sm:w-6" />
          </span>
        </span>
      </a>
    );
  }

  const handleOpenInline = () => {
    onOpen?.();
    onOpenChange(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenInline}
        aria-label={`${title}: ${vehicleName} (abre player na página)`}
        className="group relative isolate flex aspect-[6/5] w-full flex-col overflow-hidden rounded-2xl border border-[#00283C]/10 bg-[#00283C] text-left text-white shadow-[0_4px_18px_rgba(0,40,60,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:h-full sm:aspect-auto sm:min-h-[280px]"
      >
        {mediaCover}
        <span className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-4 text-left sm:gap-5 sm:px-5 sm:py-5">
          <span className="min-w-0">
            <span className="block text-lg font-bold leading-tight tracking-[-0.02em] text-white sm:text-xl">
              Ver vídeo deste carro
            </span>
            <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#B8D5DB] sm:text-xs">
              Assistir aqui na página
            </span>
          </span>
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#64C5CB] text-[#00283C] transition-colors group-hover:bg-[#8AD6DA] sm:h-14 sm:w-14"
            aria-hidden="true"
          >
            <Play className="ml-0.5 h-5 w-5 fill-current sm:h-6 sm:w-6" />
          </span>
        </span>
      </button>

      {isOpen && (
        <VehicleVideoModal
          href={href}
          vehicleName={vehicleName}
          onClose={() => onOpenChange(false)}
          whatsappHref={whatsappHref}
        />
      )}
    </>
  );
}
