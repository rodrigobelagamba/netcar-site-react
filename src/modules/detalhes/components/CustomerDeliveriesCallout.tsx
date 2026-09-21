import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

// A small selection keeps the vehicle page independent of the gallery dataset.
const DELIVERY_PHOTOS = ["mkt-f70fefc7", "mkt-2769a3fe", "mkt-ed106e87"];

export function CustomerDeliveriesCallout() {
  return (
    <aside
      aria-labelledby="vehicle-deliveries-title"
      className="w-full"
    >
      <Link
        to="/entregas"
        search={{}}
        hash=""
        className="group flex w-full items-center gap-3 rounded-2xl border border-[#23747C]/20 bg-[#F0F7F4] p-3 text-left transition-colors hover:border-[#23747C]/40 hover:bg-[#E6F2ED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95]"
      >
        <div
          aria-hidden="true"
          className="flex shrink-0 -space-x-3"
        >
          {DELIVERY_PHOTOS.map((id) => (
            <div
              key={id}
              className="h-12 w-12 overflow-hidden rounded-full border-2 border-white bg-[#E6EFEC]"
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
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#23747C]">
            Clientes Netcar
          </p>
          <h2
            id="vehicle-deliveries-title"
            className="mt-1 text-sm font-bold leading-snug text-[#00283C]"
          >
            Veja quem já escolheu a Netcar
          </h2>
          <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-bold leading-snug text-[#075E54] group-hover:underline">
            Conheça nossas entregas
            <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </aside>
  );
}
