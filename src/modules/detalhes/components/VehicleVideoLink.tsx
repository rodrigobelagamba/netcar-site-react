import { ArrowUpRight, Play } from "lucide-react";
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
}

/** Link leve: sem embed, autoplay, thumbnail externa ou pedido prévio à Meta. */
export function VehicleVideoLink({
  permalink,
  vehicleName,
  displayModel,
  coverImage,
  onOpen,
}: VehicleVideoLinkProps) {
  const href = normalizeInstagramVideoUrl(permalink);
  if (!href) return null;
  const cover = normalizeVehicleVideoCover(coverImage);
  const title = displayModel?.trim()
    ? `Veja este ${displayModel.trim()} em vídeo`
    : "Ver vídeo deste carro";

  if (cover) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onOpen}
        aria-label={`${title}: ${vehicleName}, no Instagram (abre em outra aba)`}
        className="group relative isolate block aspect-video w-full max-w-md overflow-hidden rounded-xl bg-[#00283C] text-white ring-1 ring-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95]"
      >
        <span
          className="absolute inset-0"
          aria-hidden="true"
        >
          <img
            src={cover}
            alt=""
            width={640}
            height={1138}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 !h-full w-full object-cover object-[center_40%] transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
            onError={(event) => { event.currentTarget.hidden = true; }}
          />
          <span className="absolute inset-0 bg-gradient-to-t from-[#001820]/95 via-black/10 to-black/5" />
          <span className="absolute left-1/2 top-[38%] flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-white/95 text-[#00283C] shadow-md transition-transform motion-safe:group-hover:scale-105 sm:top-[42%]">
            <Play className="ml-0.5 h-[18px] w-[18px] fill-current" />
          </span>
        </span>
        <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 px-4 pb-4 text-left">
          <span className="min-w-0 text-sm font-semibold leading-snug text-white sm:text-[15px]">
            {title}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium leading-snug text-white/95">
            No Instagram
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        </span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      aria-label={`${title}: ${vehicleName}, no Instagram (abre em outra aba)`}
      className="group inline-flex min-h-[52px] max-w-full items-center gap-3 rounded-full border border-[#00283C]/15 bg-white px-4 py-2.5 text-[#00283C] shadow-sm transition-colors hover:border-[#008B95]/50 hover:bg-[#F0FAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:px-5"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E8F6F6] text-[#007C86]"
        aria-hidden="true"
      >
        <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-sm font-bold leading-tight sm:text-[15px]">
          {title}
        </span>
        <span className="mt-0.5 block text-[11px] font-medium leading-tight text-[#596C76]">
          No Instagram
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-[#596C76]"
        aria-hidden="true"
      />
    </a>
  );
}
