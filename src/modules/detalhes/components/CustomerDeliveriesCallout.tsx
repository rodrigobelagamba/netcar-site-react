import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

// A small selection keeps the vehicle page independent of the gallery dataset.
const DELIVERY_PHOTOS = ["mkt-f70fefc7", "mkt-2769a3fe", "mkt-ed106e87"];

export function CustomerDeliveriesCallout() {
  return (
    <aside
      aria-labelledby="vehicle-deliveries-title"
      className="h-full w-full"
    >
      <Link
        to="/entregas"
        search={{}}
        hash=""
        className="group flex h-full w-full items-center gap-4 rounded-2xl border border-[#23747C]/20 bg-[#F0F7F4] p-4 text-left transition-colors hover:border-[#23747C]/40 hover:bg-[#E6F2ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:gap-5 sm:p-6"
      >
        <div
          aria-hidden="true"
          className="flex shrink-0 -space-x-4"
        >
          {DELIVERY_PHOTOS.map((id) => (
            <div
              key={id}
              className="h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-[#E6EFEC] sm:h-20 sm:w-20"
            >
              <img
                src={`/entregas-media/${id}-320.webp`}
                width={320}
                height={569}
                alt=""
                loading="lazy"
                decoding="async"
                className="!h-full w-full object-cover object-[center_30%]"
              />
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#23747C]">
            Clientes Netcar
          </p>
          <h2
            id="vehicle-deliveries-title"
            className="mt-1.5 text-lg font-bold leading-snug text-[#00283C] sm:text-xl"
          >
            Veja quem já escolheu a Netcar
          </h2>
          <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold leading-snug text-[#075E54] group-hover:underline sm:text-base">
            Conheça nossas entregas
            <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </aside>
  );
}
