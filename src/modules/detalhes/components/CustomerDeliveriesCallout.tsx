import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Camera } from "lucide-react";

// A small selection keeps the vehicle page independent of the gallery dataset.
const DELIVERY_PHOTOS = [
  "mkt-f70fefc7",
  "instagram/instagram-43c91a37b90fb585124bab7e",
  "mkt-ed106e87",
];

export function CustomerDeliveriesCallout() {
  return (
    <aside
      aria-labelledby="vehicle-deliveries-title"
      className="flex w-full self-stretch"
    >
      <Link
        to="/entregas"
        search={{}}
        hash=""
        className="group flex w-full items-center gap-4 rounded-2xl border border-[#23747C]/15 bg-white p-4 text-left !no-underline shadow-[0_3px_16px_rgba(0,40,60,0.03)] transition-colors hover:border-[#23747C]/35 hover:bg-[#FAFCFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#008B95] sm:gap-6 sm:p-5"
      >
        <div
          aria-hidden="true"
          className="relative h-24 w-24 shrink-0 sm:h-40 sm:w-[36%] sm:max-w-64"
        >
          {DELIVERY_PHOTOS.map((id, index) => (
            <div
              key={id}
              className={`absolute h-20 w-16 overflow-hidden rounded-lg border-[3px] border-white bg-[#E6EFEC] shadow-[0_3px_8px_rgba(0,40,60,0.13)] sm:h-36 sm:w-[48%] ${
                index === 0
                  ? "left-0 top-1 -rotate-6"
                  : index === 1
                    ? "left-7 top-3 z-10 rotate-3 sm:left-[26%]"
                    : "right-0 top-0 z-20 hidden rotate-6 sm:block"
              }`}
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
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#23747C] sm:text-[11px]">
            <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Clientes Netcar
          </p>
          <h2
            id="vehicle-deliveries-title"
            className="mt-2 max-w-[23rem] text-base font-bold leading-snug tracking-[-0.02em] text-[#00283C] sm:text-xl"
          >
            Veja quem já escolheu a Netcar
          </h2>
          <p className="mt-2 hidden max-w-sm text-sm leading-6 text-[#526972] sm:block">
            Cada entrega tem uma história. Veja esses momentos no nosso álbum.
          </p>
          <span className="mt-3 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#23747C]/15 bg-[#F0F7F4] px-3 py-2 text-xs font-semibold leading-5 text-[#075E54] transition-colors group-hover:bg-[#E6F2ED] sm:text-sm">
            Ver álbum de entregas
            <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" aria-hidden="true" />
          </span>
        </div>
      </Link>
    </aside>
  );
}
