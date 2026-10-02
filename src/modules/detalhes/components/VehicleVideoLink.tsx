import { ArrowUpRight, Play, Video } from "lucide-react";
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

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      aria-label={`${title}: ${vehicleName}, no Instagram (abre em outra aba)`}
      className="group relative isolate flex aspect-[6/5] w-full flex-col overflow-hidden rounded-2xl border border-[#00283C]/10 bg-[#00283C] text-white shadow-[0_4px_18px_rgba(0,40,60,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:h-full sm:aspect-auto sm:min-h-[280px]"
    >
      <span className="relative min-h-0 flex-1 overflow-hidden" aria-hidden="true">
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
